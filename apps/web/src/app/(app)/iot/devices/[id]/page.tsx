'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, KeyRound, Pencil, Plus, Power, Server, Trash2, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { LABELS } from '@agrogenius/shared';
import { Badge, statusTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ErrorState, Notice, PageLoader } from '@/components/ui/feedback';
import { Toggle } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { ActuatorControl } from '@/features/iot/actuator-control';
import { CredentialsDialog, type Credentials } from '@/features/iot/credentials-dialog';
import { SensorTile } from '@/features/iot/device-card';
import { AddActuatorDialog, AddSensorDialog, EditSensorDialog } from '@/features/iot/device-dialogs';
import { fmtDuration, useDevice, useIotRealtime } from '@/features/iot/hooks';
import { SensorChart } from '@/features/iot/sensor-chart';
import { api } from '@/lib/api';
import type { Device, Sensor } from '@/lib/types';
import { fmtDate, fmtRelative } from '@/lib/utils';

type Confirm = 'disable' | 'delete' | 'rotate' | null;

export default function DevicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useDevice(id);
  useIotRealtime(q.data?.farmId ?? null);
  const [editSensor, setEditSensor] = React.useState<Sensor | null>(null);
  const [addSensor, setAddSensor] = React.useState(false);
  const [addActuator, setAddActuator] = React.useState(false);
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [creds, setCreds] = React.useState<Credentials | null>(null);

  const patch = useMutation({
    mutationFn: (body: Partial<Pick<Device, 'mode' | 'localRules'>> & { status?: 'DISABLED' | 'OFFLINE' }) => api(`/iot/devices/${id}`, { method: 'PATCH', body }),
    onSuccess: (_d, v) => {
      toast.success(
        v.mode ? `Modo ${v.mode === 'AUTO' ? 'automático' : 'manual'} ativo` : v.status === 'DISABLED' ? 'Dispositivo desativado' : v.status ? 'Dispositivo reativado' : 'Configuração atualizada',
        { description: v.mode || v.status === 'DISABLED' ? 'Por segurança, os atuadores ligados receberam ordem para desligar.' : undefined },
      );
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ['iot'] });
    },
  });
  const rotate = useMutation({
    mutationFn: () => api<Credentials>(`/iot/devices/${id}/rotate-secret`, { method: 'POST' }),
    onSuccess: (c) => {
      setConfirm(null);
      setCreds(c);
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/iot/devices/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Dispositivo removido');
      qc.invalidateQueries({ queryKey: ['iot'] });
      router.replace('/iot');
    },
  });

  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const disabled = d.status === 'DISABLED';

  const confirmCfg = {
    disable: { title: 'Desativar dispositivo?', text: 'Os atuadores recebem ordem para desligar e o dispositivo deixa de autenticar-se e de aceitar comandos até ser reativado.', action: () => patch.mutate({ status: 'DISABLED' }), label: 'Desativar', loading: patch.isPending },
    delete: { title: 'Remover dispositivo?', text: 'Remove o dispositivo, os seus sensores, leituras e regras associadas. Esta ação não pode ser desfeita.', action: () => remove.mutate(), label: 'Remover definitivamente', loading: remove.isPending },
    rotate: { title: 'Rodar segredo?', text: 'O segredo atual deixa de funcionar imediatamente. Terás de atualizar o firmware com o novo segredo.', action: () => rotate.mutate(), label: 'Gerar novo segredo', loading: rotate.isPending },
  } as const;

  return (
    <div>
      <Link href="/iot" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> AgroControl
      </Link>
      <PageHeader
        eyebrow={`${LABELS.deviceType[d.type as keyof typeof LABELS.deviceType] ?? d.type} · ${d.hardware}`}
        title={d.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(d.status)}>
              {d.status === 'ONLINE' ? <Wifi /> : <WifiOff />} {LABELS.deviceStatus[d.status]}
            </Badge>
            <span>Última comunicação {fmtRelative(d.lastSeenAt)}</span>
            {d.field && <span>· Zona {d.field.name}</span>}
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setConfirm('rotate')}>
              <KeyRound /> Rodar segredo
            </Button>
            {disabled ? (
              <Button variant="outline" loading={patch.isPending} onClick={() => patch.mutate({ status: 'OFFLINE' })}>
                <Power /> Reativar
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setConfirm('disable')}>
                <Ban /> Desativar
              </Button>
            )}
            <Button variant="destructive" onClick={() => setConfirm('delete')}>
              <Trash2 /> Remover
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {d.sensors.length ? (
            d.sensors.map((s) => <SensorChart key={s.id} sensor={s} />)
          ) : (
            <Notice>Este dispositivo não tem sensores registados.</Notice>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Modo de operação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="inline-flex w-full rounded-md border p-1">
                {(['AUTO', 'MANUAL'] as const).map((m) => (
                  <button
                    key={m}
                    disabled={patch.isPending || disabled}
                    onClick={() => m !== d.mode && patch.mutate({ mode: m })}
                    className={`flex-1 rounded-sm px-3 py-1.5 text-sm ${d.mode === m ? 'bg-primary/15 font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                    aria-pressed={d.mode === m}
                  >
                    {m === 'AUTO' ? 'Automático' : 'Manual'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {d.mode === 'AUTO' ? 'As regras decidem. Manualmente só é possível desligar.' : 'As regras do servidor ficam suspensas e podes ligar atuadores com duração definida.'} Mudar de modo desliga os atuadores por segurança.
              </p>
              <Toggle
                checked={d.localRules}
                onChange={(v) => patch.mutate({ localRules: v })}
                label="Regras executadas no firmware"
                description={d.localRules ? 'O dispositivo decide localmente; o servidor envia a configuração e monitoriza.' : 'O servidor avalia as regras a cada leitura e envia comandos.'}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Atuadores</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setAddActuator(true)}>
                <Plus /> Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.actuators.length ? d.actuators.map((a) => <ActuatorControl key={a.id} actuator={a} device={d} />) : <p className="text-xs text-muted-foreground">Sem atuadores.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Sensores e limites</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setAddSensor(true)}>
                <Plus /> Adicionar
              </Button>
            </CardHeader>
            <CardContent className="grid gap-2">
              {d.sensors.map((s) => (
                <div key={s.id} className="relative">
                  <SensorTile s={s} />
                  <Button size="icon" variant="ghost" className="absolute right-1 top-6 size-7" aria-label={`Editar limites de ${s.key}`} onClick={() => setEditSensor(s)}>
                    <Pencil />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="size-4" /> Ligação e configuração
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={d.broker.connected ? 'green' : d.broker.configured ? 'red' : 'amber'}>
                  Broker MQTT: {d.broker.connected ? 'ligado' : d.broker.configured ? 'desligado' : 'não configurado'}
                </Badge>
                <Badge>
                  Utilizador <span className="font-mono">{d.mqttUsername}</span>
                </Badge>
              </div>
              {!d.broker.configured && (
                <p className="text-xs text-muted-foreground">Sem broker configurado no servidor, os comandos são entregues por polling HTTP (GET /iot/device/commands) e a telemetria chega por POST /iot/ingest.</p>
              )}
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Configuração enviada ao firmware {d.localRules ? '(tópico config, retained)' : '(não usada: regras no servidor)'}</div>
                {d.config.zones.length ? (
                  <ul className="space-y-1 text-xs">
                    {d.config.zones.map((z) => (
                      <li key={z.valve} className="rounded-md border px-2 py-1.5">
                        <span className="font-mono">{z.valve}</span> ← <span className="font-mono">{z.sensor}</span>: liga &lt; {z.start}, para ≥ {z.stop}, máx. {fmtDuration(z.maxSec)}, intervalo {fmtDuration(z.cooldownSec)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem regras ativas para os atuadores deste dispositivo.</p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Registado em {fmtDate((d as Device & { createdAt?: string }).createdAt ?? null)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <EditSensorDialog sensor={editSensor} onClose={() => setEditSensor(null)} />
      <AddSensorDialog deviceId={id} open={addSensor} onOpenChange={setAddSensor} />
      <AddActuatorDialog deviceId={id} open={addActuator} onOpenChange={setAddActuator} />
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        {confirm && (
          <DialogContent title={confirmCfg[confirm].title} description={confirmCfg[confirm].text}>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Cancelar
              </Button>
              <Button variant={confirm === 'rotate' ? 'default' : 'destructive'} loading={confirmCfg[confirm].loading} onClick={confirmCfg[confirm].action}>
                {confirmCfg[confirm].label}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
