'use client';
import * as T from '@radix-ui/react-tabs';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ className, ...p }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn('inline-flex h-10 max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-muted/40 p-1', className)} {...p} />;
}
export function TabsTrigger({ className, ...p }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-sm px-3 text-sm text-muted-foreground transition-all hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-soft [&_svg]:size-4',
        className,
      )}
      {...p}
    />
  );
}
