'use client';
/**
 * Tokens de visualização (validados com o validador de paleta dataviz):
 *  - série 1 / receitas: #1baf7a (claro) · #199e70 (escuro)
 *  - série 2 / despesas: #eb6834 (claro) · #d95926 (escuro)
 * No modo claro a série 1 fica abaixo de 3:1 de contraste → há sempre legenda e vista em tabela.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export const VIZ = {
  s1: 'var(--viz-s1)',
  s2: 'var(--viz-s2)',
  grid: 'hsl(var(--border))',
  axis: 'hsl(var(--muted-foreground))',
};

export function VizRoot({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('[--viz-s1:#1baf7a] [--viz-s2:#eb6834] dark:[--viz-s1:#199e70] dark:[--viz-s2:#d95926]', className)}>{children}</div>;
}

export const axisProps = {
  stroke: VIZ.axis,
  tick: { fill: VIZ.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

interface TipPayload {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/** Tooltip consistente: texto em tinta normal, cor só no marcador. */
export function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: TipPayload[];
  label?: string | number;
  format: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-soft">
      {label !== undefined && <div className="mb-1 font-medium">{label}</div>}
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="size-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="num ml-auto pl-3 font-medium">{format(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

/** Alterna entre gráfico e tabela (acessibilidade e leitura exata). */
export function ChartOrTable({ chart, table }: { chart: React.ReactNode; table: React.ReactNode }) {
  const [mode, setMode] = React.useState<'chart' | 'table'>('chart');
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <div className="inline-flex rounded-md border p-0.5 text-xs">
          {(['chart', 'table'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn('rounded-sm px-2 py-1', mode === m ? 'bg-muted text-foreground' : 'text-muted-foreground')}
            >
              {m === 'chart' ? 'Gráfico' : 'Tabela'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'chart' ? chart : table}
    </div>
  );
}
