'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { registerSchema } from '@agrogenius/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { api } from '@/lib/api';

const schema = registerSchema.extend({ phone: z.string().trim().max(20).optional() });
type In = z.input<typeof schema>;
type Out = z.output<typeof schema>;

export function TechnicianDialog() {
  const [open, setOpen] = React.useState(false);
  const qc = useQueryClient();
  const f = useForm<In, unknown, Out>({ resolver: zodResolver(schema) });
  const m = useMutation({
    mutationFn: (v: Out) => api('/admin/technicians', { method: 'POST', body: { ...v, phone: v.phone || undefined } }),
    onSuccess: () => {
      toast.success('Técnico criado. Os agricultores podem agora autorizá-lo nas suas propriedades.');
      qc.invalidateQueries({ queryKey: ['admin'] });
      f.reset();
      setOpen(false);
    },
  });
  const e = f.formState.errors;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Novo técnico
        </Button>
      </DialogTrigger>
      <DialogContent title="Criar conta de técnico agrícola" description="O técnico só vê propriedades cujo agricultor lhe dê acesso.">
        <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="grid gap-4">
          <Field label="Nome completo" error={e.fullName?.message}>
            <Input {...f.register('fullName')} />
          </Field>
          <Field label="Email" error={e.email?.message}>
            <Input type="email" {...f.register('email')} />
          </Field>
          <Field label="Telefone">
            <Input {...f.register('phone')} placeholder="+244 …" />
          </Field>
          <Field label="Palavra-passe inicial" error={e.password?.message} hint="Mínimo 8 caracteres, com letras e números.">
            <Input type="password" autoComplete="new-password" {...f.register('password')} />
          </Field>
          <Button type="submit" loading={m.isPending}>
            Criar técnico
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
