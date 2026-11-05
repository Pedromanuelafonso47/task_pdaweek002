'use client';
import { registerSchema, type RegisterInput } from '@agrogenius/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useAuth, homeFor } from '@/lib/auth';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
  const { register: signUp, user, status } = useAuth();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState, watch } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), mode: 'onTouched' });
  const pw = watch('password') ?? '';

  React.useEffect(() => {
    if (status === 'authenticated' && user) router.replace(homeFor(user));
  }, [status, user, router]);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await signUp(v);
      router.replace('/onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar a conta');
    }
  });

  const rules = [
    { ok: pw.length >= 8, label: '8+ caracteres' },
    { ok: /[A-Za-z]/.test(pw), label: 'uma letra' },
    { ok: /[0-9]/.test(pw), label: 'um número' },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Criar conta de agricultor</h1>
        <p className="text-sm text-muted-foreground">A seguir, analisamos a tua propriedade em 5 passos curtos.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Nome completo" htmlFor="fullName" error={formState.errors.fullName?.message}>
          <Input id="fullName" autoComplete="name" aria-invalid={!!formState.errors.fullName} {...register('fullName')} />
        </Field>
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!formState.errors.email} {...register('email')} />
        </Field>
        <Field label="Palavra-passe" htmlFor="password" error={formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!formState.errors.password} {...register('password')} />
        </Field>
        <ul className="flex flex-wrap gap-3 text-xs">
          {rules.map((r) => (
            <li key={r.label} className={cn('flex items-center gap-1', r.ok ? 'text-primary' : 'text-muted-foreground')}>
              <Check className="size-3" /> {r.label}
            </li>
          ))}
        </ul>
        {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Criar conta
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Já tens conta?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
      <p className="text-center text-[11px] text-muted-foreground">Contas de técnicos agrícolas são criadas pela administração da plataforma.</p>
    </div>
  );
}
