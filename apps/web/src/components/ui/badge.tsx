import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const badge = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 [&_svg]:size-3', {
  variants: {
    tone: {
      neutral: 'border-border bg-muted/60 text-muted-foreground',
      green: 'border-primary/30 bg-primary/10 text-primary',
      amber: 'border-warning/30 bg-warning/10 text-warning',
      red: 'border-destructive/30 bg-destructive/10 text-destructive',
      blue: 'border-sky-500/30 bg-sky-500/10 text-sky-500',
      solid: 'border-transparent bg-accent text-accent-foreground',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type BadgeTone = NonNullable<VariantProps<typeof badge>['tone']>;

export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...p} />;
}

export function priorityTone(p: string): BadgeTone {
  return p === 'CRITICAL' ? 'red' : p === 'HIGH' ? 'amber' : p === 'MEDIUM' ? 'blue' : 'neutral';
}

export function statusTone(s: string): BadgeTone {
  return (
    ({ ONLINE: 'green', OFFLINE: 'red', PENDING: 'amber', DISABLED: 'neutral', ACKED: 'green', SENT: 'blue', REJECTED: 'red', FAILED: 'red', EXPIRED: 'neutral', ACCEPTED: 'green', IMPLEMENTED: 'solid', DISMISSED: 'neutral', GROWING: 'green', PLANNED: 'blue', HARVESTED: 'solid' } as Record<string, BadgeTone>)[s] ?? 'neutral'
  );
}
