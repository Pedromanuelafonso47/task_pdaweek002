'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Power, PowerOff, ShieldAlert } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { LABELS } from '@agrogenius/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Notice } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import type { Actuator, Device } from '@/lib/types';
import { cn } from '@/lib/utils';
import { fmtDuration } from './hooks';

interface CommandResult {
  id: string;
  status: string;
  delivery: 'MQTT' | 'POLLING';
  warnings: string[];
}

/** Controlo manual com validação de segurança no servidor. Desligar está sempre disponível. */
export function ActuatorControl({ actuator, device }: { actuator: Actuator; device: Pick<Device, 'mode' | 'status'> }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [minutes, setMinutes] = React.useState(Math.min(5, Math.floor(actuator.maxRuntimeSec / 60)) || 1);
  const [rejection, setRejection] = React.useState<string | null>(null);
  const maxMin = Math.max(1, Math.floor(actuator.maxRuntimeSec / 60));

  const send = useMutation({
    mutationFn: (body: { action: 'ON' | 'OFF'; durationSec?: number }) =>
      api<CommandResult>(`/iot/actuators/${actuator.id}/command`, { method: 'POST', body }),
    onSuccess: (r, vars) => {
      setOpen(false);
      setRejection(null);
      toast.success(vars.action === 'ON' ? `${actuator.name}: comando de ligar enviado` : `${actuator.name}: comando de desligar enviado`, {
        description:
          (r.delivery === 'MQTT' ? 'Entregue por MQTT; a aguardar confirmação do dispositivo.' : 'Broker MQTT indisponível: o dispositivo recebe o comando na próxima consulta (polling).') +
          (r.warnings?.length ? ` ${r.warnings.join(' ')}` : ''),
      });
      qc.invalidateQueries({ queryKey: ['iot'] });
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Erro ao enviar o comando';
      setRejection(msg);
      toast.error('Comando recusado por segurança', { description: msg });
      qc.invalidateQueries({ queryKey: ['iot', 'commands'] });
    },
  });

  const autoMode = device.mode === 'AUTO';
  const disabled = device.status === 'DISABLED';

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-background/40 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn('relative grid size-8 shrink-0 place-items-center rounded-full', actuator.isOn ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
          {actuator.isOn && <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />}
          <Power className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{actuator.name}</div>
          <div className="text-xs text-muted-foreground">
            {LABELS.actuatorKind[actuator.kind]} · <span className="font-mono">{actuator.key}</span> · {actuator.isOn ? 'Ligado' : 'Desligado'} · máx. {fmtDuration(actuator.maxRuntimeSec)}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          loading={send.isPending && send.variables?.action === 'OFF'}
          onClick={() => send.mutate({ action: 'OFF' })}
          title="Desligar é sempre permitido"
        >
          <PowerOff /> Desligar
        </Button>
        <Button
          size="sm"
          disabled={disabled || autoMode}
          onClick={() => {
            setRejection(null);
            setOpen(true);
          }}
          title={autoMode ? 'Em modo automático só é possível desligar. Muda para modo manual.' : 'Ligar com duração definida'}
        >
          <Power /> Ligar
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={`Ligar ${actuator.name}`}
          description="Nenhum atuador é ligado sem tempo máximo. A plataforma verifica ligação, modo, frequência e (para bombas) o nível de água antes de enviar."
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              send.mutate({ action: 'ON', durationSec: Math.round(minutes * 60) });
            }}
          >
            <Field label={`Duração (minutos, máximo ${maxMin})`} hint="O dispositivo desliga sozinho ao fim deste tempo, mesmo sem ligação.">
              <Input type="number" min={0.5} step={0.5} max={maxMin} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} required />
            </Field>
            {actuator.kind === 'PUMP' && (
              <Notice tone="warn" className="flex gap-2">
                <ShieldAlert className="size-4 shrink-0 text-warning" />
                Vais ligar uma bomba. Confirma que há água no poço/reservatório e que as válvulas a jusante estão abertas. Se existir sensor de nível, a plataforma recusa o arranque com nível baixo.
              </Notice>
            )}
            {rejection && <Notice tone="warn">Recusado: {rejection}</Notice>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={send.isPending} disabled={!(minutes > 0 && minutes <= maxMin)}>
                Confirmar e ligar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
