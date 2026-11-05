'use client';
import { useQuery } from '@tanstack/react-query';
import { LineChart as LineIcon, Table2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import * as React from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LABELS } from '@agrogenius/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { api } from '@/lib/api';
import type { Sensor } from '@/lib/types';
import { cn, fmtDate, fmtNum } from '@/lib/utils';

type Range = '24h' | '7d' | '30d';
const RANGES: Record<Range, { ms: number; bucket: 'raw' | 'hour' | 'day'; label: string }> = {
  '24h': { ms: 86_400_000, bucket: 'raw', label: '24 h' },
  '7d': { ms: 7 * 86_400_000, bucket: 'hour', label: '7 dias' },
  '30d': { ms: 30 * 86_400_000, bucket: 'day', label: '30 dias' },
};

interface Point {
  t: string;
  avg: number;
  min: number;
  max: number;
  n?: number;
}

/** Lê os tokens HSL do tema (atributos SVG não resolvem var() de forma fiável). */
function useTokens() {
  const { resolvedTheme } = useTheme();
  const [t, setT] = React.useState({ primary: '#27C77B', muted: '#89958E', grid: 'rgba(137,149,142,0.18)', warning: '#F59E0B', card: '#0f1d17' });
  React.useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const hsl = (v: string, a = 1) => `hsl(${cs.getPropertyValue(v).trim()} / ${a})`;
    setT({ primary: hsl('--primary'), muted: hsl('--muted-foreground'), grid: hsl('--border', 0.7), warning: hsl('--warning'), card: hsl('--card') });
  }, [resolvedTheme]);
  return t;
}

export function SensorChart({ sensor }: { sensor: Sensor }) {
  const [range, setRange] = React.useState<Range>('24h');
  const [asTable, setAsTable] = React.useState(false);
  const tokens = useTokens();
  const cfg = RANGES[range];
  const q = useQuery({
    queryKey: ['iot', 'readings', sensor.id, range],
    queryFn: () => {
      const to = new Date();
      const from = new Date(to.getTime() - cfg.ms);
      return api<{ points: Point[] }>(`/iot/sensors/${sensor.id}/readings?from=${from.toISOString()}&to=${to.toISOString()}&bucket=${cfg.bucket}`);
    },
    refetchInterval: 60_000,
  });
  const points = (q.data?.points ?? []).map((p) => ({ ...p, ts: new Date(p.t).getTime(), band: [p.min, p.max] as [number, number] }));
  const title = LABELS.sensorKind[sensor.kind as keyof typeof LABELS.sensorKind] ?? sensor.kind;
  const tickFmt = (ts: number) => fmtDate(new Date(ts), range === '24h' ? { timeStyle: 'short' } : { day: '2-digit', month: 'short' });

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-[15px] font-semibold">
            {title} <span className="font-mono text-xs font-normal text-muted-foreground">{sensor.key}</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            {cfg.bucket === 'raw' ? 'Leituras individuais' : `Média por ${cfg.bucket === 'hour' ? 'hora' : 'dia'} com faixa mínimo–máximo`} · {sensor.unit}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className="inline-flex rounded-md border p-0.5">
            {(Object.keys(RANGES) as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn('rounded-sm px-2.5 py-1 text-xs', r === range ? 'bg-primary/15 font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}
                aria-pressed={r === range}
              >
                {RANGES[r].label}
              </button>
            ))}
          </div>
          <Button size="icon" variant="ghost" className="size-8" onClick={() => setAsTable((x) => !x)} aria-label={asTable ? 'Ver gráfico' : 'Ver tabela'}>
            {asTable ? <LineIcon /> : <Table2 />}
          </Button>
        </div>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-56" />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !points.length ? (
        <EmptyState title="Sem leituras neste período" description="Este sensor ainda não enviou dados no intervalo escolhido. Não são mostrados valores estimados." className="py-8" />
      ) : asTable ? (
        <div className="max-h-64 overflow-y-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">Data</th>
                <th className="px-3 py-1.5 text-right font-medium">Média</th>
                <th className="px-3 py-1.5 text-right font-medium">Mín</th>
                <th className="px-3 py-1.5 text-right font-medium">Máx</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.t} className="num border-t">
                  <td className="px-3 py-1">{fmtDate(p.t, { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-3 py-1 text-right">{fmtNum(p.avg)}</td>
                  <td className="px-3 py-1 text-right">{fmtNum(p.min)}</td>
                  <td className="px-3 py-1 text-right">{fmtNum(p.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-56" role="img" aria-label={`Gráfico de ${title} nos últimos ${cfg.label}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={tokens.grid} vertical={false} />
              <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tickFmt} tick={{ fill: tokens.muted, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={32} />
              <YAxis tick={{ fill: tokens.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} />
              <Tooltip
                cursor={{ stroke: tokens.muted, strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof points)[number];
                  return (
                    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-soft">
                      <div className="mb-1 text-muted-foreground">{fmtDate(p.t, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                      <div className="num font-medium">
                        {cfg.bucket === 'raw' ? 'Valor' : 'Média'}: {fmtNum(p.avg)} {sensor.unit}
                      </div>
                      {cfg.bucket !== 'raw' && (
                        <div className="num text-muted-foreground">
                          mín {fmtNum(p.min)} · máx {fmtNum(p.max)} · {p.n} leituras
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              {cfg.bucket !== 'raw' && <Area dataKey="band" stroke="none" fill={tokens.primary} fillOpacity={0.14} isAnimationActive={false} activeDot={false} />}
              {sensor.minThreshold !== null && (
                <ReferenceLine y={sensor.minThreshold} stroke={tokens.warning} strokeDasharray="4 4" label={{ value: `mín ${sensor.minThreshold}`, position: 'insideBottomLeft', fill: tokens.muted, fontSize: 10 }} />
              )}
              {sensor.maxThreshold !== null && (
                <ReferenceLine y={sensor.maxThreshold} stroke={tokens.warning} strokeDasharray="4 4" label={{ value: `máx ${sensor.maxThreshold}`, position: 'insideTopLeft', fill: tokens.muted, fontSize: 10 }} />
              )}
              <Line
                dataKey="avg"
                stroke={tokens.primary}
                strokeWidth={2}
                dot={points.length < 40 ? { r: 3, fill: tokens.primary, stroke: tokens.card, strokeWidth: 2 } : false}
                activeDot={{ r: 5, fill: tokens.primary, stroke: tokens.card, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
