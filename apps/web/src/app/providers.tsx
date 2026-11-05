'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import * as React from 'react';
import { Toaster, toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { offlineQueue } from '@/lib/offline-queue';

function OfflineSync() {
  React.useEffect(() => {
    const sync = async () => {
      const { sent } = await offlineQueue.flush();
      if (sent) toast.success(`${sent} registo(s) feitos offline foram sincronizados.`);
    };
    const onOffline = () => toast.warning('Sem ligação. Os registos essenciais ficam guardados e serão sincronizados.');
    window.addEventListener('online', sync);
    window.addEventListener('offline', onOffline);
    sync();
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && count < 2,
          },
          mutations: {
            onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro inesperado'),
          },
        },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <OfflineSync />
          {children}
        </AuthProvider>
        <Toaster richColors position="top-right" closeButton theme="system" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
