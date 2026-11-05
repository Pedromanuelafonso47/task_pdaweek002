'use client';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { AppShell } from '@/components/app-shell';
import { Logo } from '@/components/brand';
import { useAuth } from '@/lib/auth';
import { FarmProvider } from '@/lib/farm-context';

/** Área autenticada: exige sessão e onboarding concluído (agricultores). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const path = usePathname();

  React.useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (user && user.role === 'FARMER' && !user.onboardingCompleted) router.replace('/onboarding');
  }, [status, user, router, path]);

  if (status !== 'authenticated' || !user || (user.role === 'FARMER' && !user.onboardingCompleted)) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <Logo compact className="animate-pulse2" />A carregar…
        </div>
      </div>
    );
  }
  return (
    <FarmProvider>
      <AppShell>{children}</AppShell>
    </FarmProvider>
  );
}
