'use client';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { api } from './api';
import { useAuth } from './auth';
import type { FarmSummary } from './types';

interface FarmCtx {
  farms: FarmSummary[];
  farmId: string | null;
  farm: FarmSummary | null;
  setFarmId: (id: string) => void;
  isLoading: boolean;
}

const Ctx = React.createContext<FarmCtx | null>(null);
const KEY = 'agrogenius.farm';

/** Propriedade ativa (seleção do utilizador guardada apenas como conveniência local). */
export function FarmProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const q = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/farms'), enabled: status === 'authenticated' });
  const [farmId, setFarmIdState] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      setFarmIdState(localStorage.getItem(KEY));
    } catch {
      /* armazenamento indisponível */
    }
  }, []);

  const farms = q.data ?? [];
  const valid = farms.find((f) => f.id === farmId) ? farmId : (farms[0]?.id ?? null);

  const setFarmId = React.useCallback((id: string) => {
    setFarmIdState(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignorar */
    }
  }, []);

  return (
    <Ctx.Provider value={{ farms, farmId: valid, farm: farms.find((f) => f.id === valid) ?? null, setFarmId, isLoading: q.isLoading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFarm() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error('useFarm fora do FarmProvider');
  return c;
}
