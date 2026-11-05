'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { ACTUATOR_KINDS, LABELS, SENSOR_KINDS, deviceCreateSchema } from '@agrogenius/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, Select, Toggle } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { Device, Field as FarmField } from '@/lib/types';
import { CredentialsDialog, type Credentials } from './credentials-dialog';
import { DEFAULT_UNITS } from './hooks';

type In = z.input<typeof deviceCreateSchema>;
type Out = z.output<typeof deviceCreateSchema>;

const num = (v: unknown) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

export function RegisterDeviceDialog({ farmId, fields, open, onOpenChange }: { farmId: string; fields: FarmField[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [creds, setCreds] = React.useState<Credentials | null>(null);
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(deviceCreateSchema),
    defaultValues: {
      farmId,
      name: '',
      type: 'CONTROLLER',
      hardware: 'ESP32',
      fieldId: null,
      localRules: true,
      sensors: [
        { key: 'sm1', kind: 'SOIL_MOISTURE', unit: '%', minThreshold: null, maxThreshold: null },
        { key: 'water', kind: 'WATER_LEVEL', unit: 'nível', minThreshold: 1, maxThreshold: null },
      ],
      actuators: [{ key: 'v1', kind: 'VALVE', name: 'Válvula zona 1', maxRuntimeSec: 900 }],
    },
  });
  const sensors = useFieldArray({ control: form.control, name: 'sensors' });
  const actuators = useFieldArray({ control: form.control, name: 'actuators' });
  const localRules = form.watch('localRules');
  const errors = form.formState.errors;

  const create = useMutation({
    mutationFn: (body: Out) => api<{ device: Device; credentials: Credentials }>('/iot/devices', { method: 'POST', body }),
    onSuccess: (r) => {
      toast.success(`Dispositivo "${r.device.name}" registado`);
      qc.invalidateQueries({ queryKey: ['iot'] });
      qc.invalidateQueries({ queryKey: ['farms'] });
      onOpenChange(false);
      form.reset();
      setCreds(r.credentials);
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title="Registar dispositivo" description="Cada dispositivo recebe credenciais próprias. Indica os sensores e atuadores ligados ao controlador." className="max-w-2xl">
          <form className="space-y-5" onSubmit={form.handleSubmit((v) => create.mutate({ ...v, farmId }))}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome" error={errors.name?.message}>
                <Input placeholder="Controlador de rega — zona norte" {...form.register('name')} />
              </Field>
              <Field label="Tipo">
                <Select {...form.register('type')}>
                  {(['CONTROLLER', 'SENSOR_NODE', 'GATEWAY', 'WEATHER_STATION'] as const).map((t) => (
                    <option key={t} value={t}>
                      {LABELS.deviceType[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Hardware">
                <Input {...form.register('hardware')} />
              </Field>
              <Field label="Zona (opcional)">
                <Select {...form.register('fieldId', { setValueAs: (v) => v || null })}>
                  <option value="">Sem zona</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Toggle
              checked={!!localRules}
              onChange={(v) => form.setValue('localRules', v)}
              label={localRules ? 'Regras executadas no firmware (recomendado)' : 'O servidor decide e envia comandos'}
              description={
                localRules
                  ? 'O ESP32 recebe as regras e decide localmente: continua a regar corretamente sem internet. O servidor só monitoriza.'
                  : 'Útil para dispositivos simples sem lógica própria. Requer ligação constante; sem rede, não há automação.'
              }
            />

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Sensores</h4>
                <Button type="button" size="sm" variant="outline" onClick={() => sensors.append({ key: `s${sensors.fields.length + 1}`, kind: 'SOIL_MOISTURE', unit: '%', minThreshold: null, maxThreshold: null })}>
                  <Plus /> Sensor
                </Button>
              </div>
              {sensors.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-2 gap-2 rounded-md border p-2 sm:grid-cols-[90px_1fr_80px_80px_80px_auto]">
                  <Input aria-label="Chave" placeholder="sm1" {...form.register(`sensors.${i}.key`)} aria-invalid={!!errors.sensors?.[i]?.key} />
                  <Select
                    aria-label="Tipo de sensor"
                    {...form.register(`sensors.${i}.kind`, { onChange: (e) => form.setValue(`sensors.${i}.unit`, DEFAULT_UNITS[e.target.value] ?? '') })}
                  >
                    {SENSOR_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {LABELS.sensorKind[k]}
                      </option>
                    ))}
                  </Select>
                  <Input aria-label="Unidade" placeholder="%" {...form.register(`sensors.${i}.unit`)} />
                  <Input aria-label="Mínimo" type="number" step="any" placeholder="mín." {...form.register(`sensors.${i}.minThreshold`, { setValueAs: num })} />
                  <Input aria-label="Máximo" type="number" step="any" placeholder="máx." {...form.register(`sensors.${i}.maxThreshold`, { setValueAs: num })} />
                  <Button type="button" size="icon" variant="ghost" aria-label="Remover sensor" onClick={() => sensors.remove(i)}>
                    <Trash2 />
                  </Button>
                  {errors.sensors?.[i]?.key && <p className="col-span-full text-xs text-destructive">{errors.sensors[i]?.key?.message}</p>}
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Atuadores</h4>
                <Button type="button" size="sm" variant="outline" onClick={() => actuators.append({ key: `v${actuators.fields.length + 1}`, kind: 'VALVE', name: `Válvula ${actuators.fields.length + 1}`, maxRuntimeSec: 900 })}>
                  <Plus /> Atuador
                </Button>
              </div>
              {!actuators.fields.length && <p className="text-xs text-muted-foreground">Sem atuadores (dispositivo só de monitorização).</p>}
              {actuators.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-2 gap-2 rounded-md border p-2 sm:grid-cols-[90px_1fr_1fr_110px_auto]">
                  <Input aria-label="Chave" placeholder="v1" {...form.register(`actuators.${i}.key`)} />
                  <Select aria-label="Tipo de atuador" {...form.register(`actuators.${i}.kind`)}>
                    {ACTUATOR_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {LABELS.actuatorKind[k]}
                      </option>
                    ))}
                  </Select>
                  <Input aria-label="Nome" {...form.register(`actuators.${i}.name`)} />
                  <Input aria-label="Tempo máximo (s)" type="number" title="Tempo máximo por ativação (segundos)" {...form.register(`actuators.${i}.maxRuntimeSec`, { valueAsNumber: true })} />
                  <Button type="button" size="icon" variant="ghost" aria-label="Remover atuador" onClick={() => actuators.remove(i)}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Tempo máximo por ativação em segundos (10–3600). Bombas: associa um sensor de nível de água para proteção contra funcionamento a seco.</p>
            </section>

            {(errors.sensors?.root || errors.actuators?.root) && <p className="text-xs text-destructive">{errors.sensors?.root?.message ?? errors.actuators?.root?.message}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={create.isPending}>
                Registar e gerar credenciais
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
    </>
  );
}
