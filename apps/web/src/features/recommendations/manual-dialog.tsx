'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PenLine } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { LABELS } from '@agrogenius/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Select, Textarea, Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { ProjectListItem } from '@/lib/types';

const schema = z.object({
  projectSlug: z.string().min(1, 'Escolhe um projeto'),
  problem: z.string().trim().min(3, 'Descreve o problema').max(200),
  justification: z.string().trim().min(10, 'Justifica com pelo menos 10 caracteres').max(2000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
});
type Form = z.infer<typeof schema>;

/** Técnico agrícola cria uma recomendação própria; o custo é sempre dimensionado pelo motor. */
export function ManualRecommendationDialog({ farmId }: { farmId: string }) {
  const [open, setOpen] = React.useState(false);
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ['projects', ''], queryFn: () => api<ProjectListItem[]>('/projects'), enabled: open });
  const f = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { priority: 'MEDIUM', projectSlug: '', problem: '', justification: '' } });
  const m = useMutation({
    mutationFn: (v: Form) => api(`/farms/${farmId}/recommendations/manual`, { method: 'POST', body: v }),
    onSuccess: () => {
      toast.success('Recomendação técnica criada');
      qc.invalidateQueries({ queryKey: ['recommendations', farmId] });
      setOpen(false);
      f.reset();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PenLine /> Recomendação técnica
        </Button>
      </DialogTrigger>
      <DialogContent title="Nova recomendação técnica" description="A justificação fica registada com o teu nome. O custo é calculado pelo motor para esta propriedade.">
        <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="grid gap-4">
          <Field label="Projeto" error={f.formState.errors.projectSlug?.message}>
            <Select {...f.register('projectSlug')}>
              <option value="">{projects.isLoading ? 'A carregar…' : 'Escolher…'}</option>
              {projects.data?.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Problema identificado" error={f.formState.errors.problem?.message}>
            <Input {...f.register('problem')} placeholder="ex.: Encharcamento na zona baixa" />
          </Field>
          <Field label="Justificação técnica" error={f.formState.errors.justification?.message}>
            <Textarea rows={4} {...f.register('justification')} placeholder="Observações de campo que suportam a recomendação…" />
          </Field>
          <Field label="Prioridade">
            <Select {...f.register('priority')}>
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((p) => (
                <option key={p} value={p}>
                  {LABELS.priority[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" loading={m.isPending}>
            Criar recomendação
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
