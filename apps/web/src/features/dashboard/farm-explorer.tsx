'use client';
import { LABELS } from '@agrogenius/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Cpu, Droplets, Map as MapIcon, MousePointerClick } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { FarmMap } from '@/components/maps';
import { FarmView, type SceneSelection } from '@/components/three';
import { sensorState } from '@/components/three/farm-scene';
import { Badge, statusTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import type { Device, Field, FarmSummary } from '@/lib/types';
import { fmtDate, fmtNum, fmtRelative } from '@/lib/utils';

export interface FarmDetail extends FarmSummary {
  fields: Field[];
  plantings: {
    id: string;
    areaHa: string;
    status: string;
    plantedAt: string | null;
    expectedHarvestAt: string | null;
    crop: { name: string };
    field: { id: string; name: string } | null;
  }[];
}

const kindLabel = (k: string) => LABELS.sensorKind[k as keyof typeof LABELS.sensorKind] ?? k;

/** Visualização interativa da propriedade (3D / mapa) com painel de detalhe. */
export function FarmExplorer({ farmId }: { farmId: string }) {
  const qc = useQueryClient();
  const farm = useQuery({ queryKey: ['farm', farmId], queryFn: () => api<FarmDetail>(`/farms/${farmId}`) });
  const devices = useQuery({ queryKey: ['devices', farmId], queryFn: () => api<Device[]>(`/iot/devices?farmId=${farmId}`) });
  const [sel, setSel] = React.useState<SceneSelection>(null);
  React.useEffect(() => setSel(null), [farmId]);

  useRealtime('readings', () => qc.invalidateQueries({ queryKey: ['devices', farmId] }), farmId);
  useRealtime('device-status', () => qc.invalidateQueries({ queryKey: ['devices', farmId] }), farmId);

  if (farm.isError) return <ErrorState error={farm.error} retry={() => farm.refetch()} />;
  if (!farm.data) return <Skeleton className="h-[480px]" />;

  const f = farm.data;
  const devs = devices.data ?? [];
  const center: [number, number] = [f.longitude ?? 17.5, f.latitude ?? -12.3];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <Tabs defaultValue="3d">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="3d">
              <Box /> Vista 3D
            </TabsTrigger>
            <TabsTrigger value="map">
              <MapIcon /> Mapa
            </TabsTrigger>
          </TabsList>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/farms/${f.id}?tab=map`}>Editar zonas</Link>
          </Button>
        </div>
        <TabsContent value="3d">
          <FarmView boundary={f.boundary} totalAreaHa={Number(f.totalAreaHa)} fields={f.fields} devices={devs} selection={sel} onSelect={setSel} />
        </TabsContent>
        <TabsContent value="map">
          <FarmMap
            boundary={f.boundary}
            center={center}
            fields={f.fields}
            devices={devs}
            selectedFieldId={sel?.type === 'field' ? sel.id : null}
            onSelectField={(id) => setSel({ type: 'field', id })}
            onSelectDevice={(id) => setSel({ type: 'device', id })}
          />
          {!f.boundary && f.latitude === null && <p className="mt-2 text-xs text-muted-foreground">Sem coordenadas registadas: o mapa mostra a região de referência.</p>}
        </TabsContent>
      </Tabs>
      <DetailPanel farm={f} devices={devs} sel={sel} />
    </div>
  );
}

function DetailPanel({ farm, devices, sel }: { farm: FarmDetail; devices: Device[]; sel: SceneSelection }) {
  const sensors = devices.flatMap((d) => d.sensors.map((s) => ({ ...s, device: d })));

  if (!sel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{farm.name}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {farm.province}
            {farm.municipality ? ` · ${farm.municipality}` : ''} · {fmtNum(farm.totalAreaHa)} ha
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            <MousePointerClick className="size-4 shrink-0" /> Seleciona uma zona ou sensor para ver os dados.
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">Zonas</dt>
              <dd className="num font-medium">{farm.fields.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sensores</dt>
              <dd className="num font-medium">{sensors.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Solo</dt>
              <dd>{LABELS.soil[farm.soilType as keyof typeof LABELS.soil]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rega</dt>
              <dd>{LABELS.irrigation[farm.irrigationSystem as keyof typeof LABELS.irrigation]}</dd>
            </div>
          </dl>
          {farm.fields.length === 0 && (
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/farms/${farm.id}?tab=map`}>Dividir a propriedade em zonas</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (sel.type === 'field') {
    const field = farm.fields.find((x) => x.id === sel.id);
    if (!field) return null;
    const plantings = farm.plantings.filter((p) => p.field?.id === field.id && (p.status === 'GROWING' || p.status === 'PLANNED'));
    const fieldSensors = sensors.filter((s) => s.fieldId === field.id);
    return (
      <Card className="animate-fade-up">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{field.name}</CardTitle>
            {field.isIrrigationZone && (
              <Badge tone="blue">
                <Droplets /> Irrigação
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {fmtNum(field.areaHa, 2)} ha{field.soilType ? ` · ${LABELS.soil[field.soilType as keyof typeof LABELS.soil]}` : ''}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Culturas</p>
            {plantings.length ? (
              <ul className="space-y-1">
                {plantings.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.crop.name}</span>
                    <span className="text-xs text-muted-foreground">colheita {fmtDate(p.expectedHarvestAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma plantação ativa associada a esta zona.</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Sensores na zona</p>
            {fieldSensors.length ? (
              <ul className="space-y-1">
                {fieldSensors.map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span>{kindLabel(s.kind)}</span>
                    <span className="num font-medium">{s.last ? `${s.last.value} ${s.unit}` : '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Sem sensores. Consulta as recomendações para monitorizar esta zona.</p>
            )}
          </div>
          {field.notes && <p className="text-xs text-muted-foreground">{field.notes}</p>}
        </CardContent>
      </Card>
    );
  }

  if (sel.type === 'sensor') {
    const s = sensors.find((x) => x.id === sel.id);
    if (!s) return null;
    const st = sensorState(s);
    const field = farm.fields.find((x) => x.id === s.fieldId);
    return (
      <Card className="animate-fade-up">
        <CardHeader>
          <CardTitle>{kindLabel(s.kind)}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {s.device.name} · chave <code>{s.key}</code>
            {field ? ` · ${field.name}` : ''}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="num font-display text-3xl font-semibold">{s.last ? `${s.last.value} ${s.unit}` : '—'}</p>
            <p className="text-xs text-muted-foreground">{s.last ? `Última leitura ${fmtRelative(s.last.recordedAt)}` : 'Ainda sem leituras recebidas.'}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Limite mínimo</dt>
              <dd className="num">{s.minThreshold ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Limite máximo</dt>
              <dd className="num">{s.maxThreshold ?? '—'}</dd>
            </div>
          </dl>
          {st === 'low' && <Badge tone="amber">Abaixo do limite mínimo</Badge>}
          {st === 'high' && <Badge tone="red">Acima do limite máximo</Badge>}
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/iot/devices/${s.device.id}`}>
              <Cpu /> Histórico e regras no AgroControl
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const d = devices.find((x) => x.id === sel.id);
  if (!d) return null;
  return (
    <Card className="animate-fade-up">
      <CardHeader>
        <CardTitle>{d.name}</CardTitle>
        <Badge tone={statusTone(d.status)} className="w-fit">
          {LABELS.deviceStatus[d.status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">Última comunicação: {fmtRelative(d.lastSeenAt)}</p>
        <ul className="space-y-1">
          {d.sensors.map((s) => (
            <li key={s.id} className="flex justify-between">
              <span>{kindLabel(s.kind)}</span>
              <span className="num">{s.last ? `${s.last.value} ${s.unit}` : '—'}</span>
            </li>
          ))}
        </ul>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/iot/devices/${d.id}`}>Abrir no AgroControl</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
