'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, ShieldCheck, Trash2, Workflow } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { LABELS, ruleCreateSchema } from '@agrogenius/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Notice, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Select, Toggle } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { Device } from '@/lib/types';
import { fmtRelative } from '@/lib/utils';
import { fmtDuration, useRules, type Rule } from './hooks';

type In = z.input<typeof ruleCreateSchema>;
type Out = z.output<typeof ruleCreateSchema>;
const num = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v));
const numOrNull = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v));
const strOrNull = (v: unknown) => (v ? String(v) : null);

function RuleForm({ farmId, devices, rule, onDone }: { farmId: string; devices: Device[]; rule?: Rule; onDone: () => void }) {
  const qc = useQueryClient();
  const sensors = devices.flatMap((d) => d.sensors.map((s) => ({ ...s, deviceName: d.name })));
  const actuators = devices.flatMap((d) => d.actuators.map((a) => ({ ...a, deviceName: d.name })));
  const levelSensors = sensors.filter((s) => s.kind === 'WATER_LEVEL');

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(ruleCreateSchema),
    defaultValues: rule
      ? {
          name: rule.name,
          enabled: rule.enabled,
          sensorId: rule.sensorId,
          operator: rule.operator,
          threshold: rule.threshold,
          stopThreshold: rule.stopThreshold,
          actuatorId: rule.actuatorId,
          maxDurationSec: rule.maxDurationSec,
          cooldownSec: rule.cooldownSec,
          waterLevelSensorId: rule.waterLevelSensorId,
          minWaterLevel: rule.minWaterLevel,
          activeFrom: rule.activeFrom,
          activeTo: rule.activeTo,
        }
      : {
          name: '',
          enabled: true,
          sensorId: sensors.find((s) => s.kind === 'SOIL_MOISTURE')?.id ?? sensors[0]?.id ?? '',
          operator: 'LT',
          threshold: 30,
          stopThreshold: 45,
          actuatorId: actuators[0]?.id ?? '',
          maxDurationSec: 900,
          cooldownSec: 1800,
          waterLevelSensorId: levelSensors[0]?.id ?? null,
          minWaterLevel: levelSensors.length ? 1 : null,
          activeFrom: null,
          activeTo: null,
        },
  });
  const v = form.watch();
  const errors = form.formState.errors;
  const sensor = sensors.find((s) => s.id === v.sensorId);
  const actuator = actuators.find((a) => a.id === v.actuatorId);
  const isPump = actuator?.kind === 'PUMP';

  const save = useMutation({
    mutationFn: (body: Out) =>
      rule ? api(`/iot/rules/${rule.id}`, { method: 'PUT', body }) : api(`/iot/farms/${farmId}/rules`, { method: 'POST', body }),
    onSuccess: () => {
      toast.success(rule ? 'Regra atualizada' : 'Regra criada', { description: 'A configuração foi enviada aos dispositivos com regras locais.' });
      qc.invalidateQueries({ queryKey: ['iot'] });
      onDone();
    },
  });

  if (!sensors.length || !actuators.length) {
    return <Notice tone="warn">Para criar regras é preciso pelo menos um sensor e um atuador registados nesta propriedade.</Notice>;
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit((b) => save.mutate(b))}>
      <Field label="Nome da regra" error={errors.name?.message}>
        <Input placeholder="Rega da zona norte" {...form.register('name')} />
      </Field>

      <div className="space-y-3 rounded-lg border bg-background/40 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">Se</div>
        <div className="grid gap-2 sm:grid-cols-[1fr_140px_110px]">
          <Select aria-label="Sensor" {...form.register('sensorId')}>
            {sensors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.deviceName} · {LABELS.sensorKind[s.kind as keyof typeof LABELS.sensorKind]} ({s.key})
              </option>
            ))}
          </Select>
          <Select aria-label="Condição" {...form.register('operator')}>
            <option value="LT">for menor que</option>
            <option value="GT">for maior que</option>
          </Select>
          <Input aria-label="Limite de ativação" type="number" step="any" {...form.register('threshold', { setValueAs: num })} />
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">Então ligar</div>
        <Select aria-label="Atuador" {...form.register('actuatorId')}>
          {actuators.map((a) => (
            <option key={a.id} value={a.id}>
              {a.deviceName} · {a.name} ({LABELS.actuatorKind[a.kind]}, máx. {fmtDuration(a.maxRuntimeSec)})
            </option>
          ))}
        </Select>
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">Até</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={`${sensor ? LABELS.sensorKind[sensor.kind as keyof typeof LABELS.sensorKind] : 'Valor'} ${v.operator === 'LT' ? '≥' : '≤'} (${sensor?.unit ?? ''})`} error={errors.stopThreshold?.message}>
            <Input type="number" step="any" {...form.register('stopThreshold', { setValueAs: num })} aria-invalid={!!errors.stopThreshold} />
          </Field>
          <Field label="ou tempo máximo (segundos)" error={errors.maxDurationSec?.message} hint={actuator ? `Limite do atuador: ${actuator.maxRuntimeSec} s` : undefined}>
            <Input type="number" {...form.register('maxDurationSec', { setValueAs: num })} />
          </Field>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Intervalo mínimo entre ativações (s)" error={errors.cooldownSec?.message}>
          <Input type="number" {...form.register('cooldownSec', { setValueAs: num })} />
        </Field>
        <Field label="Ativa a partir de (opcional)" error={errors.activeFrom?.message}>
          <Input type="time" {...form.register('activeFrom', { setValueAs: strOrNull })} />
        </Field>
        <Field label="Até às (opcional)" error={errors.activeTo?.message}>
          <Input type="time" {...form.register('activeTo', { setValueAs: strOrNull })} />
        </Field>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-primary" /> Proteção contra funcionamento a seco {isPump && <Badge tone="amber">obrigatória para bombas</Badge>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select aria-label="Sensor de nível de água" {...form.register('waterLevelSensorId', { setValueAs: strOrNull })}>
            <option value="">Sem sensor de nível</option>
            {levelSensors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.deviceName} · {s.key}
              </option>
            ))}
          </Select>
          <Input aria-label="Nível mínimo" type="number" step="any" placeholder="nível mínimo" {...form.register('minWaterLevel', { setValueAs: numOrNull })} />
        </div>
        {errors.minWaterLevel && <p className="text-xs text-destructive">{errors.minWaterLevel.message}</p>}
        {isPump && !v.waterLevelSensorId && (
          <p className="text-xs text-warning">{levelSensors.length ? 'Escolhe um sensor de nível: a plataforma não aceita regras de bomba sem esta proteção.' : 'Não há sensores de nível registados. Adiciona um (tipo "Nível de água") antes de automatizar a bomba.'}</p>
        )}
      </div>

      <Toggle checked={!!v.enabled} onChange={(x) => form.setValue('enabled', x)} label="Regra ativa" />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={save.isPending}>
          {rule ? 'Guardar alterações' : 'Criar regra'}
        </Button>
      </div>
    </form>
  );
}

export function RulesPanel({ farmId, devices }: { farmId: string; devices: Device[] }) {
  const qc = useQueryClient();
  const q = useRules(farmId);
  const [editing, setEditing] = React.useState<Rule | 'new' | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Rule | null>(null);

  const toggle = useMutation({
    mutationFn: (r: Rule) =>
      api(`/iot/rules/${r.id}`, {
        method: 'PUT',
        body: {
          name: r.name,
          enabled: !r.enabled,
          sensorId: r.sensorId,
          operator: r.operator,
          threshold: r.threshold,
          stopThreshold: r.stopThreshold,
          actuatorId: r.actuatorId,
          maxDurationSec: r.maxDurationSec,
          cooldownSec: r.cooldownSec,
          waterLevelSensorId: r.waterLevelSensorId,
          minWaterLevel: r.minWaterLevel,
          activeFrom: r.activeFrom,
          activeTo: r.activeTo,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iot'] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/iot/rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Regra removida');
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ['iot'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Regras com histerese: liga abaixo do limite e só desliga quando atinge a condição de paragem ou o tempo máximo. Em dispositivos com regras no firmware, são executadas no campo mesmo sem internet.
        </p>
        <Button onClick={() => setEditing('new')}>
          <Plus /> Nova regra
        </Button>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-40" />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={Workflow} title="Sem regras de automação" description="Cria uma regra para regar com base na humidade do solo, ventilar por temperatura ou proteger reservatórios." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {q.data.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display font-semibold">{r.name}</span>
                    <Badge tone={r.enabled ? 'green' : 'neutral'}>{r.enabled ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">
                    <b className="text-primary">SE</b> {LABELS.sensorKind[r.sensor.kind as keyof typeof LABELS.sensorKind]} ({r.sensor.key}) {r.operator === 'LT' ? '<' : '>'} {r.threshold} {r.sensor.unit}{' '}
                    <b className="text-primary">ENTÃO</b> ligar {r.actuator.name} <b className="text-primary">ATÉ</b> {r.operator === 'LT' ? '≥' : '≤'} {r.stopThreshold} {r.sensor.unit} ou {fmtDuration(r.maxDurationSec)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    <Badge>intervalo {fmtDuration(r.cooldownSec)}</Badge>
                    {r.activeFrom && r.activeTo && (
                      <Badge>
                        {r.activeFrom}–{r.activeTo}
                      </Badge>
                    )}
                    {r.waterLevelSensor ? (
                      <Badge tone="green">
                        <ShieldCheck /> nível ≥ {r.minWaterLevel} ({r.waterLevelSensor.key})
                      </Badge>
                    ) : (
                      <Badge tone="amber">sem proteção de nível</Badge>
                    )}
                    <Badge>{r.actuator.device.name}</Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Última ativação pelo servidor: {r.lastTriggeredAt ? fmtRelative(r.lastTriggeredAt) : 'nunca'}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button size="icon" variant="ghost" aria-label="Editar regra" onClick={() => setEditing(r)}>
                    <Pencil />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Remover regra" onClick={() => setConfirmDel(r)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="mt-3 border-t pt-3">
                <Button size="sm" variant="outline" loading={toggle.isPending && toggle.variables?.id === r.id} onClick={() => toggle.mutate(r)}>
                  {r.enabled ? 'Desativar' : 'Ativar'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing === 'new' ? 'Nova regra de automação' : 'Editar regra'} className="max-w-2xl">
          {editing && <RuleForm farmId={farmId} devices={devices} rule={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <DialogContent title="Remover regra?" description={`A regra "${confirmDel?.name}" deixa de ser executada e é retirada da configuração do dispositivo.`}>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" loading={del.isPending} onClick={() => confirmDel && del.mutate(confirmDel.id)}>
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
