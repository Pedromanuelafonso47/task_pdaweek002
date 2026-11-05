'use client';
import * as DM from '@radix-ui/react-dropdown-menu';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Bot,
  ChevronDown,
  CloudOff,
  Cpu,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Moon,
  Shield,
  Sprout,
  Sun,
  Wallet,
  Wand2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import * as React from 'react';
import { toast } from 'sonner';
import { LABELS } from '@agrogenius/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFarm } from '@/lib/farm-context';
import { offlineQueue, type QueuedOp } from '@/lib/offline-queue';
import { useRealtime } from '@/lib/realtime';
import type { Notification } from '@/lib/types';
import { cn, fmtRelative } from '@/lib/utils';
import { Logo } from './brand';
import { Button } from './ui/button';

const NAV = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/farms', label: 'Propriedades', icon: Map },
  { href: '/production', label: 'Produção', icon: Sprout },
  { href: '/recommendations', label: 'Recomendações', icon: Wand2 },
  { href: '/lab', label: 'AgroTech Lab', icon: FlaskConical },
  { href: '/iot', label: 'AgroControl', icon: Cpu },
  { href: '/ai', label: 'Agro AI', icon: Bot },
  { href: '/finance', label: 'Finanças', icon: Wallet, roles: ['FARMER', 'ADMIN'] },
  { href: '/reports', label: 'Relatórios', icon: FileText },
  { href: '/admin', label: 'Administração', icon: Shield, roles: ['ADMIN'] },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { user } = useAuth();
  return (
    <nav className="grid gap-0.5">
      {NAV.filter((n) => !('roles' in n) || (user && (n.roles as readonly string[]).includes(user.role))).map((n) => {
        const active = path === n.href || path.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn(
              'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              active ? 'bg-primary/10 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary" />}
            <n.icon className={cn('size-4', active && 'text-primary')} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function FarmSwitcher() {
  const { farms, farm, setFarmId } = useFarm();
  if (!farms.length) return null;
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <button className="flex h-9 max-w-[220px] items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted/60">
          <Map className="size-4 text-primary" />
          <span className="truncate">{farm?.name ?? 'Propriedade'}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="start" sideOffset={6} className="z-50 min-w-[220px] rounded-md border bg-card p-1 shadow-soft">
          {farms.map((f) => (
            <DM.Item key={f.id} onSelect={() => setFarmId(f.id)} className={cn('cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted', f.id === farm?.id && 'text-primary')}>
              <div className="font-medium">{f.name}</div>
              <div className="text-xs text-muted-foreground">
                {f.province} · {Number(f.totalAreaHa)} ha
              </div>
            </DM.Item>
          ))}
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item asChild>
            <Link href="/farms/new" className="block rounded-sm px-2 py-1.5 text-sm text-primary outline-none data-[highlighted]:bg-muted">
              + Nova propriedade
            </Link>
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

function Notifications() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api<Notification[]>('/notifications'), refetchInterval: 60_000 });
  useRealtime<Notification>('notification', (n) => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    (n.severity === 'CRITICAL' ? toast.error : n.severity === 'WARNING' ? toast.warning : toast.info)(n.title, { description: n.body });
  });
  const unread = data?.filter((n) => !n.readAt).length ?? 0;
  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const markOne = async (id: string) => {
    await api(`/notifications/${id}/read`, { method: 'POST' });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notificações (${unread} por ler)`} className="relative">
          <Bell />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread > 9 ? '9+' : unread}</span>
          )}
        </Button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={6} className="z-50 w-[min(92vw,380px)] rounded-lg border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-display text-sm font-semibold">Notificações</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-primary hover:underline">
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {!data?.length && <p className="p-6 text-center text-sm text-muted-foreground">Sem notificações.</p>}
            {data?.slice(0, 30).map((n) => (
              <DM.Item key={n.id} onSelect={() => !n.readAt && markOne(n.id)} className="flex cursor-pointer gap-3 border-b px-4 py-3 outline-none last:border-0 data-[highlighted]:bg-muted/50">
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : n.severity === 'CRITICAL' ? 'bg-destructive' : n.severity === 'WARNING' ? 'bg-warning' : 'bg-primary')} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.body}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground/70">{fmtRelative(n.createdAt)}</span>
                </span>
              </DM.Item>
            ))}
          </div>
          <DM.Item asChild>
            <Link href="/notifications" className="block border-t px-4 py-2.5 text-center text-xs text-primary outline-none data-[highlighted]:bg-muted/50">
              Ver todas as notificações
            </Link>
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

function OfflineIndicator() {
  const [queue, setQueue] = React.useState<QueuedOp[]>([]);
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const unsub = offlineQueue.subscribe(setQueue);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      unsub();
    };
  }, []);
  if (online && !queue.length) return null;
  return (
    <button
      onClick={() => offlineQueue.flush().then((r) => r.sent && toast.success(`${r.sent} registo(s) sincronizados`))}
      className="flex h-8 items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 text-xs text-warning"
      title="Registos guardados localmente à espera de ligação"
    >
      <CloudOff className="size-3.5" />
      {online ? `${queue.length} por sincronizar` : `Offline${queue.length ? ` · ${queue.length} pendente(s)` : ''}`}
    </button>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" aria-label="Alternar tema" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <button className="grid size-9 place-items-center rounded-full bg-accent font-display text-xs font-bold text-accent-foreground" aria-label="Conta">
          {initials}
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={6} className="z-50 min-w-[220px] rounded-md border bg-card p-1 shadow-soft">
          <div className="px-2 py-2">
            <div className="text-sm font-medium">{user.fullName}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
            <div className="mt-1 text-[11px] text-primary">{LABELS.role[user.role]}</div>
          </div>
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item onSelect={logout} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted">
            <LogOut className="size-4" /> Terminar sessão
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const path = usePathname();
  React.useEffect(() => setOpen(false), [path]);

  return (
    <div className="min-h-dvh bg-background">
      {/* Barra lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card/40 backdrop-blur lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavLinks />
        </div>
        <div className="border-t p-4 text-[11px] leading-relaxed text-muted-foreground">
          Valores em Kwanza (Kz). Custos de projetos são estimativas de referência.
        </div>
      </aside>

      {/* Navegação móvel */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-night/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 border-r bg-card p-4 animate-fade-up">
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X />
              </Button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu />
          </Button>
          <Link href="/dashboard" className="lg:hidden">
            <Logo compact />
          </Link>
          <FarmSwitcher />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <OfflineIndicator />
            <ThemeToggle />
            <Notifications />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
