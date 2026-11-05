'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { ACTUATOR_KINDS, LABELS, SENSOR_KINDS, actuatorCreateSchema, sensorCreateSchema, sensorUpdateSchema } from '@agrogenius/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { Sensor } from '@/lib/types';
import { DEFAULT_UNITS } from './hooks';

const numOrNull = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v));

export function EditSensorDialog({ sensor, onClose }: { sensor: Sensor | null; onClose: () => void }) {
  const qc = useQueryClient();
  type In = z.input<typeof sensorUpdateSchema>;
  type Out = z.output<typeof sensorUpdateSchema>;
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(sensorUpdateSchema),
    values: sensor ? { unit: sensor.unit, minThreshold: sensor.minThreshold, maxThreshold: sensor.maxThreshold } : undefined,
  });
  const save = useMutation({
    mutationFn: (body: Out) => api(`/iot/sensors/${sensor!.id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success('Limites atualizados');
      qc.invalidateQueries({ queryKey: ['iot'] });
      onClose();
    },
  });
  return (
    <Dialog open={!!sensor} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Limites de ${sensor?.key ?? ''}`} description="Os alertas (ex.: humidade baixa, reservatório baixo, temperatura elevada) são gerados quando uma leitura recente sai destes limites.">
        <form className="space-y-4" onSubmit={form.handleSubmit((b) => save.mutate(b))}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Unidade">
              <Input {...form.register('unit')} />
            </Field>
            <Field label="Mínimo">
              <Input type="number" step="any" {...form.register('minThreshold', { setValueAs: numOrNull })} />
            </Field>
            <Field label="Máximo">
              <Input type="number" step="any" {...form.register('maxThreshold', { setValueAs: numOrNull })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddSensorDialog({ deviceId, open, onOpenChange }: { deviceId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  type In = z.input<typeof sensorCreateSchema>;
  type Out = z.output<typeof sensorCreateSchema>;
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(sensorCreateSchema),
    defaultValues: { key: '', kind: 'SOIL_MOISTURE', unit: '%', minThreshold: null, maxThreshold: null },
  });
  const errors = form.formState.errors;
  const save = useMutation({
    mutationFn: (body: Out) => api(`/iot/devices/${deviceId}/sensors`, { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Sensor adicionado');
      qc.invalidateQueries({ queryKey: ['iot'] });
      form.reset();
      onOpenChange(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Adicionar sensor" description="A chave tem de coincidir com a usada no payload de telemetria do firmware.">
        <form className="space-y-4" onSubmit={form.handleSubmit((b) => save.mutate(b))}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Chave" error={errors.key?.message} hint="ex.: sm2, temp1">
              <Input {...form.register('key')} />
            </Field>
            <Field label="Tipo">
              <Select {...form.register('kind', { onChange: (e) => form.setValue('unit', DEFAULT_UNITS[e.target.value] ?? '') })}>
                {SENSOR_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LABELS.sensorKind[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unidade" error={errors.unit?.message}>
              <Input {...form.register('unit')} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Mínimo">
                <Input type="number" step="any" {...form.register('minThreshold', { setValueAs: numOrNull })} />
              </Field>
              <Field label="Máximo">
                <Input type="number" step="any" {...form.register('maxThreshold', { setValueAs: numOrNull })} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              Adicionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddActuatorDialog({ deviceId, open, onOpenChange }: { deviceId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  type In = z.input<typeof actuatorCreateSchema>;
  type Out = z.output<typeof actuatorCreateSchema>;
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(actuatorCreateSchema),
    defaultValues: { key: '', kind: 'VALVE', name: '', maxRuntimeSec: 900 },
  });
  const errors = form.formState.errors;
  const save = useMutation({
    mutationFn: (body: Out) => api(`/iot/devices/${deviceId}/actuators`, { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Atuador adicionado');
      qc.invalidateQueries({ queryKey: ['iot'] });
      form.reset();
      onOpenChange(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Adicionar atuador" description="O tempo máximo por ativação é um limite de segurança que nenhum comando ou regra pode ultrapassar.">
        <form className="space-y-4" onSubmit={form.handleSubmit((b) => save.mutate(b))}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Chave" error={errors.key?.message} hint="ex.: v2, pump1">
              <Input {...form.register('key')} />
            </Field>
            <Field label="Tipo">
              <Select {...form.register('kind')}>
                {ACTUATOR_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LABELS.actuatorKind[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nome" error={errors.name?.message}>
              <Input {...form.register('name')} />
            </Field>
            <Field label="Tempo máximo (segundos)" error={errors.maxRuntimeSec?.message}>
              <Input type="number" {...form.register('maxRuntimeSec', { valueAsNumber: true })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              Adicionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
