'use client';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center', className)}>
      <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-display font-semibold">{title}</p>
        {description && <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-start">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex-1">
        <p className="font-medium">Não foi possível carregar os dados</p>
        <p className="text-muted-foreground">{msg}</p>
      </div>
      {retry && (
        <Button size="sm" variant="outline" onClick={retry}>
          <RefreshCw /> Tentar de novo
        </Button>
      )}
    </div>
  );
}

/** Aviso explícito: estimativas, dados de demonstração, limitações. */
export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warn' | 'demo'; children: React.ReactNode; className?: string }) {
  const styles = { info: 'border-primary/25 bg-primary/5', warn: 'border-warning/30 bg-warning/5', demo: 'border-sky-500/30 bg-sky-500/5' }[tone];
  return <div className={cn('rounded-md border px-3 py-2 text-xs leading-relaxed text-muted-foreground', styles, className)}>{children}</div>;
}

export function PageLoader() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
