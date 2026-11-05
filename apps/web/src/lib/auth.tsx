'use client';
import type { LoginInput, RegisterInput } from '@agrogenius/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { api, refreshSession, session } from './api';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: 'FARMER' | 'TECHNICIAN' | 'ADMIN';
  organizationId: string;
  onboardingCompleted: boolean;
  province?: string | null;
  phone?: string | null;
}

interface AuthState {
  user: SessionUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (input: LoginInput) => Promise<SessionUser>;
  register: (input: RegisterInput) => Promise<SessionUser>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [status, setStatus] = React.useState<AuthState['status']>('loading');
  const router = useRouter();
  const qc = useQueryClient();

  React.useEffect(() => {
    let alive = true;
    refreshSession().then((s) => {
      if (!alive) return;
      if (s) {
        setUser(s.user as SessionUser);
        setStatus('authenticated');
      } else setStatus('anonymous');
    });
    session.onLost(() => {
      setUser(null);
      setStatus('anonymous');
      qc.clear();
      router.replace('/login?expired=1');
    });
    return () => {
      alive = false;
    };
  }, [qc, router]);

  const value: AuthState = {
    user,
    status,
    async login(input) {
      const r = await api<{ user: SessionUser; accessToken: string }>('/auth/login', { method: 'POST', body: input });
      session.set(r.accessToken);
      setUser(r.user);
      setStatus('authenticated');
      return r.user;
    },
    async register(input) {
      const r = await api<{ user: SessionUser; accessToken: string }>('/auth/register', { method: 'POST', body: input });
      session.set(r.accessToken);
      setUser(r.user);
      setStatus('authenticated');
      return r.user;
    },
    async logout() {
      await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
      session.set(null);
      setUser(null);
      setStatus('anonymous');
      qc.clear();
      router.replace('/login');
    },
    async reload() {
      const me = await api<SessionUser>('/auth/me');
      setUser(me);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}

/** Destino após login, conforme perfil e estado do onboarding. */
export function homeFor(u: SessionUser) {
  if (u.role === 'FARMER' && !u.onboardingCompleted) return '/onboarding';
  if (u.role === 'ADMIN') return '/admin';
  return '/dashboard';
}
