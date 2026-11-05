'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ACTIVITY_TYPES, LABELS, activityCreateSchema, harvestCreateSchema, plantingCreateSchema } from '@agrogenius/shared';
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import { offlineQueue } from '@/lib/offline-queue';
import type { Crop, Field as FarmField } from '@/lib/types';
import { uuid } from '@/lib/utils';

export interface Planting {
  id: string;
  farmId: string;
  cropId: string;
  fieldId: string | null;
  areaHa: string;
  seedVariety: string | null;
  seedQuantityKg: string | null;
  season: string | null;
  harvestFrequency: string | null;
  plantedAt: string | null;
  expectedHarvestAt: string | null;
  status: 'PLANNED' | 'GROWING' | 'HARVESTED' | 'FAILED';
  estimatedYieldKg: string | null;
  crop: Crop;
  field: { id: string; name: string } | null;
  harvests: { id: string; date: string; quantityKg: string; quality: string | null }[];
  activities: { id: string; type: string; date: string; product: string | null; quantity: string | null; unit: string | null; notes: string | null }[];
}

const today = () => new Date().toISOString().slice(0, 10);
const num = (v: unknown) => (v === '' || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v));
const dateOrNull = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');

/** Converte campos vazios do formulário para null/undefined antes de validar. */
function clean<T extends Record<string, unknown>>(v: T): T {
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === '' || (typeof x === 'number' && Number.isNaN(x)) ? undefined : x])) as T;
}

// ─────────────── Plantação ───────────────

const plantingForm = plantingCreateSchema.omit({ clientId: true });
type PlantingIn = z.input<typeof plantingForm>;
type PlantingOut = z.output<typeof plantingForm>;

export function PlantingDialog({ farmId, planting, onDone }: { farmId: string; planting?: Planting; onDone: () => void }) {
  const qc = useQueryClient();
  const crops = useQuery({ queryKey: ['crops'], queryFn: () => api<Crop[]>('/crops'), staleTime: Infinity });
  const fields = useQuery({ queryKey: ['fields', farmId], queryFn: () => api<FarmField[]>(`/farms/${farmId}/fields`) });
  const f = useForm<PlantingIn, unknown, PlantingOut>({
    resolver: zodResolver(plantingForm),
    defaultValues: planting
      ? {
          cropId: planting.cropId,
          fieldId: planting.fieldId ?? '',
          areaHa: Number(planting.areaHa),
          seedVariety: planting.seedVariety ?? '',
          seedQuantityKg: planting.seedQuantityKg ? Number(planting.seedQuantityKg) : undefined,
          season: planting.season ?? '',
          plantedAt: dateOrNull(planting.plantedAt) || undefined,
          expectedHarvestAt: dateOrNull(planting.expectedHarvestAt) || undefined,
          status: planting.status,
          estimatedYieldKg: planting.estimatedYieldKg ? Number(planting.estimatedYieldKg) : undefined,
        }
      : { status: 'PLANNED', cropId: '', fieldId: '', plantedAt: today() },
  });
  const m = useMutation({
    mutationFn: (v: PlantingOut) =>
      planting ? api(`/plantings/${planting.id}`, { method: 'PATCH', body: v }) : api(`/farms/${farmId}/plantings`, { method: 'POST', body: { ...v, clientId: uuid() } }),
    onSuccess: () => {
      toast.success(planting ? 'Plantação atualizada' : 'Plantação registada');
      qc.invalidateQueries({ queryKey: ['plantings', farmId] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['productivity'] });
      onDone();
    },
  });
  const cropId = f.watch('cropId');
  const crop = crops.data?.find((c) => c.id === cropId);
  const e = f.formState.errors;

  return (
    <DialogContent title={planting ? 'Editar plantação' : 'Nova plantação'} description="Se não indicares a colheita prevista, é calculada pelo ciclo da cultura.">
      <form
        onSubmit={f.handleSubmit((v) => m.mutate(v))}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label="Cultura" error={e.cropId?.message} className="sm:col-span-2">
          <Select {...f.register('cropId')}>
            <option value="">{crops.isLoading ? 'A carregar…' : 'Escolher cultura…'}</option>
            {crops.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — ciclo ~{c.cycleDays} dias
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Zona" hint={!fields.data?.length ? 'Sem zonas registadas' : undefined}>
          <Select {...f.register('fieldId', { setValueAs: (v) => (v ? v : null) })}>
            <option value="">Sem zona específica</option>
            {fields.data?.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} ({Number(z.areaHa)} ha)
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Área (ha)" error={e.areaHa?.message}>
          <Input type="number" step="0.01" inputMode="decimal" {...f.register('areaHa', { valueAsNumber: true })} />
        </Field>
        <Field label="Data de plantação" error={e.plantedAt?.message}>
          <Input type="date" {...f.register('plantedAt', { setValueAs: (v) => (v ? v : null) })} />
        </Field>
        <Field label="Colheita prevista" hint={crop ? `Por omissão: +${crop.cycleDays} dias` : undefined}>
          <Input type="date" {...f.register('expectedHarvestAt', { setValueAs: (v) => (v ? v : null) })} />
        </Field>
        <Field label="Variedade da semente">
          <Input {...f.register('seedVariety')} placeholder="ex.: ZM 523" />
        </Field>
        <Field label="Semente (kg)">
          <Input type="number" step="0.1" {...f.register('seedQuantityKg', { setValueAs: num })} />
        </Field>
        <Field label="Época">
          <Input {...f.register('season')} placeholder="ex.: Época A (Set–Jan)" />
        </Field>
        <Field label="Estado">
          <Select {...f.register('status')}>
            {(['PLANNED', 'GROWING', 'HARVESTED', 'FAILED'] as const).map((s) => (
              <option key={s} value={s}>
                {LABELS.plantingStatus[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Produção estimada (kg)" hint="A tua estimativa — distinta da produção real registada." className="sm:col-span-2">
          <Input type="number" step="1" {...f.register('estimatedYieldKg', { setValueAs: num })} />
        </Field>
        <Button type="submit" loading={m.isPending} className="sm:col-span-2">
          {planting ? 'Guardar alterações' : 'Registar plantação'}
        </Button>
      </form>
    </DialogContent>
  );
}

// ─────────────── Atividade (funciona offline) ───────────────

const activityForm = activityCreateSchema.omit({ clientId: true });
type ActIn = z.input<typeof activityForm>;
type ActOut = z.output<typeof activityForm>;

export function ActivityDialog({ planting, onDone }: { planting: Planting; onDone: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const f = useForm<ActIn, unknown, ActOut>({ resolver: zodResolver(activityForm), defaultValues: { type: 'FERTILIZER', date: today() } });
  const submit = async (v: ActOut) => {
    setBusy(true);
    try {
      const body = { ...clean(v as Record<string, unknown>), date: v.date.toISOString(), clientId: uuid() };
      const r = await offlineQueue.submit({ path: `/plantings/${planting.id}/activities`, method: 'POST', body, label: `${LABELS.activity[v.type]} · ${planting.crop.name}` });
      if (r.queued) toast.warning('Sem ligação: atividade guardada offline. Será sincronizada automaticamente.');
      else {
        toast.success('Atividade registada');
        qc.invalidateQueries({ queryKey: ['plantings', planting.farmId] });
        if (v.costKz) qc.invalidateQueries({ queryKey: ['finance'] });
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registar');
    } finally {
      setBusy(false);
    }
  };
  const e = f.formState.errors;
  return (
    <DialogContent title={`Registar atividade — ${planting.crop.name}`} description="Fertilização, tratamentos, rega, sacha… Funciona sem internet.">
      <form onSubmit={f.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <Select {...f.register('type')}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {LABELS.activity[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data" error={e.date?.message}>
          <Input type="date" {...f.register('date')} />
        </Field>
        <Field label="Produto" className="sm:col-span-2">
          <Input {...f.register('product')} placeholder="ex.: NPK 12-24-12" />
        </Field>
        <Field label="Quantidade">
          <Input type="number" step="0.01" {...f.register('quantity', { setValueAs: num })} />
        </Field>
        <Field label="Unidade">
          <Input {...f.register('unit')} placeholder="kg, L, sacos…" />
        </Field>
        <Field label="Custo (Kz)" hint="Se indicado, cria a despesa correspondente." className="sm:col-span-2">
          <Input type="number" step="1" {...f.register('costKz', { setValueAs: num })} />
        </Field>
        <Field label="Notas" className="sm:col-span-2">
          <Textarea rows={2} {...f.register('notes')} />
        </Field>
        <Button type="submit" loading={busy} className="sm:col-span-2">
          Registar atividade
        </Button>
      </form>
    </DialogContent>
  );
}

// ─────────────── Colheita (funciona offline) ───────────────

const harvestForm = harvestCreateSchema.omit({ clientId: true });
type HarIn = z.input<typeof harvestForm>;
type HarOut = z.output<typeof harvestForm>;

export function HarvestDialog({ planting, onDone }: { planting: Planting; onDone: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const f = useForm<HarIn, unknown, HarOut>({ resolver: zodResolver(harvestForm), defaultValues: { date: today() } });
  const submit = async (v: HarOut) => {
    setBusy(true);
    try {
      const body = { ...clean(v as Record<string, unknown>), date: v.date.toISOString(), clientId: uuid() };
      const r = await offlineQueue.submit({ path: `/plantings/${planting.id}/harvests`, method: 'POST', body, label: `Colheita · ${planting.crop.name}` });
      if (r.queued) toast.warning('Sem ligação: colheita guardada offline. Será sincronizada automaticamente.');
      else {
        toast.success('Colheita registada');
        qc.invalidateQueries({ queryKey: ['plantings', planting.farmId] });
        qc.invalidateQueries({ queryKey: ['productivity'] });
        if (v.saleAmountKz) qc.invalidateQueries({ queryKey: ['finance'] });
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registar');
    } finally {
      setBusy(false);
    }
  };
  const e = f.formState.errors;
  return (
    <DialogContent title={`Registar colheita — ${planting.crop.name}`} description="Produção real colhida. Funciona sem internet.">
      <form onSubmit={f.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2">
        <Field label="Data" error={e.date?.message}>
          <Input type="date" {...f.register('date')} />
        </Field>
        <Field label="Quantidade (kg)" error={e.quantityKg?.message}>
          <Input type="number" step="0.1" {...f.register('quantityKg', { valueAsNumber: true })} />
        </Field>
        <Field label="Qualidade">
          <Input {...f.register('quality')} placeholder="ex.: 1.ª, boa, com perdas…" />
        </Field>
        <Field label="Valor de venda (Kz)" hint="Se indicado, cria a receita.">
          <Input type="number" step="1" {...f.register('saleAmountKz', { setValueAs: num })} />
        </Field>
        <Field label="Notas" className="sm:col-span-2">
          <Textarea rows={2} {...f.register('notes')} />
        </Field>
        <Button type="submit" loading={busy} className="sm:col-span-2">
          Registar colheita
        </Button>
      </form>
    </DialogContent>
  );
}
