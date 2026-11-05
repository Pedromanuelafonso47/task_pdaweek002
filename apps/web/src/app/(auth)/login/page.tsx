'use client';
import { loginSchema, type LoginInput } from '@agrogenius/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/input';
import { useAuth, homeFor } from '@/lib/auth';

function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

function LoginForm() {
  const { login, user, status } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  React.useEffect(() => {
    if (status === 'authenticated' && user) router.replace(user.role === 'FARMER' && !user.onboardingCompleted ? '/onboarding' : (next ?? homeFor(user)));
  }, [status, user, router, next]);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await login(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível iniciar sessão');
    }
  });

  return (
    <div className="animate-fade-up space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-sm text-muted-foreground">Acede à gestão inteligente da tua propriedade.</p>
      </div>
      {params.get('expired') && <Notice tone="warn">A tua sessão terminou. Inicia sessão novamente.</Notice>}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!formState.errors.email} {...register('email')} />
        </Field>
        <Field label="Palavra-passe" htmlFor="password" error={formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register('password')} />
        </Field>
        {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Entrar
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Ainda não tens conta?{' '}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  );
}
