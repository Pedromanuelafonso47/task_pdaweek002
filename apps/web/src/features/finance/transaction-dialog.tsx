'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { LABELS, TRANSACTION_CATEGORIES, transactionCreateSchema } from '@agrogenius/shared';
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { api } from '@/lib/api';
import { offlineQueue } from '@/lib/offline-queue';
import type { FarmSummary } from '@/lib/types';
import { uuid } from '@/lib/utils';

export interface Transaction {
  id: string;
  farmId: string | null;
  plantingId: string | null;
  type: 'EXPENSE' | 'INCOME';
  category: (typeof TRANSACTION_CATEGORIES)[number];
  amount: string;
  currency: string;
  date: string;
  description: string | null;
  farm: { id: string; name: string } | null;
  planting: { id: string; crop: { name: string } } | null;
}

const form = transactionCreateSchema.omit({ clientId: true });
type In = z.input<typeof form>;
type Out = z.output<typeof form>;

const INCOME_CATS = ['SALES', 'SUBSIDY', 'OTHER'] as const;
export const CURRENCIES = ['AOA', 'USD', 'EUR'] as const;

export function TransactionDialog({ farms, defaultFarmId, tx, onDone }: { farms: FarmSummary[]; defaultFarmId: string | null; tx?: Transaction; onDone: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const f = useForm<In, unknown, Out>({
    resolver: zodResolver(form),
    defaultValues: tx
      ? {
          farmId: tx.farmId,
          type: tx.type,
          category: tx.category,
          amount: Number(tx.amount),
          currency: tx.currency,
          date: tx.date.slice(0, 10),
          description: tx.description ?? '',
        }
      : { farmId: defaultFarmId, type: 'EXPENSE', category: 'SEEDS', currency: 'AOA', date: new Date().toISOString().slice(0, 10) },
  });
  const type = f.watch('type');
  const cats = type === 'INCOME' ? INCOME_CATS : TRANSACTION_CATEGORIES.filter((c) => c !== 'SALES' && c !== 'SUBSIDY');

  React.useEffect(() => {
    const cur = f.getValues('category');
    if (!(cats as readonly string[]).includes(cur)) f.setValue('category', cats[0]);
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['finance'] });
    qc.invalidateQueries({ queryKey: ['recommendations'] });
  };

  const update = useMutation({
    mutationFn: (v: Out) => api(`/finance/transactions/${tx!.id}`, { method: 'PATCH', body: v }),
    onSuccess: () => {
      toast.success('Transação atualizada');
      invalidate();
      onDone();
    },
  });

  const submit = async (v: Out) => {
    if (tx) return update.mutate(v);
    setBusy(true);
    try {
      const body = { ...v, farmId: v.farmId || null, date: v.date.toISOString(), description: v.description || undefined, clientId: uuid() };
      const r = await offlineQueue.submit({
        path: '/finance/transactions',
        method: 'POST',
        body,
        label: `${v.type === 'INCOME' ? 'Receita' : 'Despesa'} · ${LABELS.transactionCategory[v.category]}`,
      });
      if (r.queued) toast.warning('Sem ligação: transação guardada offline. Será sincronizada automaticamente.');
      else {
        toast.success('Transação registada');
        invalidate();
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao registar');
    } finally {
      setBusy(false);
    }
  };

  const e = f.formState.errors;
  return (
    <DialogContent title={tx ? 'Editar transação' : 'Nova transação'} description={tx ? undefined : 'Funciona sem internet: é sincronizada quando houver ligação.'}>
      <form onSubmit={f.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-2 gap-1 rounded-md border p-1 sm:col-span-2">
          {(['EXPENSE', 'INCOME'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => f.setValue('type', t)}
              className={type === t ? 'rounded-sm bg-muted py-1.5 text-sm font-medium' : 'rounded-sm py-1.5 text-sm text-muted-foreground'}
            >
              {t === 'EXPENSE' ? 'Despesa' : 'Receita'}
            </button>
          ))}
        </div>
        <Field label="Categoria">
          <Select {...f.register('category')}>
            {cats.map((c) => (
              <option key={c} value={c}>
                {LABELS.transactionCategory[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Propriedade">
          <Select {...f.register('farmId', { setValueAs: (v) => (v ? v : null) })}>
            <option value="">Geral (sem propriedade)</option>
            {farms.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valor" error={e.amount?.message}>
          <Input type="number" step="0.01" inputMode="decimal" {...f.register('amount', { valueAsNumber: true })} />
        </Field>
        <Field label="Moeda" hint="Kwanza é a moeda principal.">
          <Select {...f.register('currency')}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c === 'AOA' ? 'Kz (AOA)' : c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data" error={e.date?.message}>
          <Input type="date" {...f.register('date')} />
        </Field>
        <Field label="Descrição">
          <Input {...f.register('description')} placeholder="ex.: Sacos de NPK" />
        </Field>
        <Button type="submit" loading={busy || update.isPending} className="sm:col-span-2">
          {tx ? 'Guardar' : 'Registar'}
        </Button>
      </form>
    </DialogContent>
  );
}
