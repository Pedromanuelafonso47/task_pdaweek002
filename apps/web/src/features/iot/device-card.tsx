'use client';
import { ArrowRight, Cpu, Radio, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { LABELS } from '@agrogenius/shared';
import { Badge, statusTone } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Device, Sensor } from '@/lib/types';
import { cn, fmtNum, fmtRelative } from '@/lib/utils';
import { ActuatorControl } from './actuator-control';

export function sensorState(s: Sensor): 'low' | 'high' | 'ok' | 'none' {
  if (!s.last) return 'none';
  if (s.minThreshold !== null && s.last.value < s.minThreshold) return 'low';
  if (s.maxThreshold !== null && s.last.value > s.maxThreshold) return 'high';
  return 'ok';
}

export function SensorTile({ s }: { s: Sensor }) {
  const st = sensorState(s);
  return (
    <div className={cn('rounded-md border p-3', st === 'low' || st === 'high' ? 'border-warning/40 bg-warning/5' : 'bg-background/40')}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{LABELS.sensorKind[s.kind as keyof typeof LABELS.sensorKind] ?? s.kind}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{s.key}</span>
      </div>
      <div className="num mt-1 font-display text-xl font-semibold">
        {s.last ? fmtNum(s.last.value) : '—'} <span className="text-xs font-normal text-muted-foreground">{s.unit}</span>
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {s.last ? fmtRelative(s.last.recordedAt) : 'sem leituras'}
        {(s.minThreshold !== null || s.maxThreshold !== null) && (
          <>
            {' · '}limites {s.minThreshold ?? '—'}–{s.maxThreshold ?? '—'}
          </>
        )}
      </div>
      {st === 'low' && <div className="mt-1 text-[11px] font-medium text-warning">Abaixo do mínimo</div>}
      {st === 'high' && <div className="mt-1 text-[11px] font-medium text-warning">Acima do máximo</div>}
    </div>
  );
}

export function DeviceCard({ device }: { device: Device }) {
  const online = device.status === 'ONLINE';
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn('grid size-10 shrink-0 place-items-center rounded-md', online ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
            <Cpu className="size-5" />
          </div>
          <div className="min-w-0">
            <Link href={`/iot/devices/${device.id}`} className="block truncate font-display font-semibold hover:text-primary">
              {device.name}
            </Link>
            <div className="text-xs text-muted-foreground">
              {LABELS.deviceType[device.type as keyof typeof LABELS.deviceType] ?? device.type} · {device.hardware}
              {device.field ? ` · ${device.field.name}` : ''}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={statusTone(device.status)}>
            {online ? <Wifi /> : <WifiOff />}
            {LABELS.deviceStatus[device.status]}
          </Badge>
          <span className="text-[11px] text-muted-foreground">visto {fmtRelative(device.lastSeenAt)}</span>
        </div>
      </div>
      <div className="flex-1 space-y-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={device.mode === 'AUTO' ? 'green' : 'amber'}>Modo {device.mode === 'AUTO' ? 'automático' : 'manual'}</Badge>
          <Badge>
            <Radio /> {device.localRules ? 'Regras no firmware' : 'Regras no servidor'}
          </Badge>
        </div>
        {device.sensors.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {device.sensors.map((s) => (
              <SensorTile key={s.id} s={s} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sem sensores registados.</p>
        )}
        {device.actuators.length > 0 && (
          <div className="space-y-2">
            {device.actuators.map((a) => (
              <ActuatorControl key={a.id} actuator={a} device={device} />
            ))}
            {device.mode === 'AUTO' && <p className="text-[11px] text-muted-foreground">Em modo automático só é possível desligar manualmente. Muda para modo manual no detalhe para ligar.</p>}
          </div>
        )}
      </div>
      <Link href={`/iot/devices/${device.id}`} className="flex items-center justify-between border-t px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground">
        Histórico, configuração e credenciais <ArrowRight className="size-4" />
      </Link>
    </Card>
  );
}
