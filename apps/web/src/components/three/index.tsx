'use client';
import { LABELS } from '@agrogenius/shared';
import dynamic from 'next/dynamic';
import * as React from 'react';
import { Notice, Skeleton } from '@/components/ui/feedback';
import type { Device, Field, GeoPolygon } from '@/lib/types';
import { fmtNum } from '@/lib/utils';
import type { SceneSelection } from './farm-scene';
import { useWebGL } from './webgl';

export type { SceneSelection } from './farm-scene';

const FarmScene = dynamic(() => import('./farm-scene'), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });
export const Globe = dynamic(() => import('./globe'), { ssr: false });

/** Vista 3D da propriedade com legenda e alternativa acessível quando não há WebGL. */
export function FarmView(props: {
  boundary: GeoPolygon | null;
  totalAreaHa: number;
  fields: Field[];
  devices: Device[];
  selection: SceneSelection;
  onSelect: (s: SceneSelection) => void;
  className?: string;
}) {
  const webgl = useWebGL();
  const noShape = !props.boundary;
  const approxDevices = props.devices.some((d) => d.latitude === null || d.longitude === null);

  if (webgl === false) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <Notice tone="warn">O teu dispositivo não suporta WebGL. Mostramos a informação da propriedade em lista.</Notice>
        <ul className="divide-y text-sm">
          {props.fields.map((f) => (
            <li key={f.id}>
              <button className="flex w-full justify-between py-2 text-left hover:text-primary" onClick={() => props.onSelect({ type: 'field', id: f.id })}>
                <span>{f.name}</span>
                <span className="text-muted-foreground">
                  {fmtNum(f.areaHa)} ha{f.isIrrigationZone ? ' · rega' : ''}
                </span>
              </button>
            </li>
          ))}
          {props.devices.flatMap((d) =>
            d.sensors.map((s) => (
              <li key={s.id}>
                <button className="flex w-full justify-between py-2 text-left hover:text-primary" onClick={() => props.onSelect({ type: 'sensor', id: s.id })}>
                  <span>
                    {d.name} · {LABELS.sensorKind[s.kind as keyof typeof LABELS.sensorKind] ?? s.kind}
                  </span>
                  <span className="num text-muted-foreground">{s.last ? `${s.last.value} ${s.unit}` : 'sem leitura'}</span>
                </button>
              </li>
            )),
          )}
        </ul>
      </div>
    );
  }

  return (
    <div className={props.className}>
      <div className="relative h-[420px] overflow-hidden rounded-lg border bg-night">
        {webgl === null ? <Skeleton className="h-full w-full" /> : <FarmScene {...props} />}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-2 rounded-md bg-night/75 px-2 py-1.5 text-[11px] text-snow backdrop-blur">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-tech" /> Leitura normal
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-400" /> Abaixo do limite
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-red-500" /> Acima do limite
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-stone" /> Sem leitura
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 border-t-2 border-dashed border-sky-400" /> Irrigação
          </span>
        </div>
        <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-night/70 px-2 py-1 text-[10px] text-snow/70">Arrasta para rodar · roda para aproximar</div>
      </div>
      {(noShape || approxDevices || props.fields.some((f) => !f.boundary)) && (
        <Notice tone="warn" className="mt-2">
          {noShape && 'A forma do terreno é ilustrativa (proporcional à área) porque ainda não desenhaste o limite no mapa. '}
          {props.fields.some((f) => !f.boundary) && 'Zonas sem polígono aparecem como faixas proporcionais à área. '}
          {approxDevices && 'Dispositivos sem coordenadas aparecem em posição aproximada.'}
        </Notice>
      )}
    </div>
  );
}
