'use client';
import { LABELS, formatKz } from '@agrogenius/shared';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Cpu, Droplets, Layers, Map, MapPin, Plus, Sprout } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { FarmSummary } from '@/lib/types';
import { fmtNum } from '@/lib/utils';

export default function FarmsPage() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/farms') });
  const canCreate = user?.role !== 'TECHNICIAN';

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Propriedades"
        description={user?.role === 'TECHNICIAN' ? 'Propriedades que os agricultores te autorizaram a acompanhar.' : 'Todas as propriedades da tua conta ou cooperativa.'}
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/farms/new">
                <Plus /> Nova propriedade
              </Link>
            </Button>
          )
        }
      />
      {q.isLoading ? (
        <PageLoader />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={Map} title="Sem propriedades" description="Regista uma propriedade para começar." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((f, i) => {
            const pct = Number(f.totalAreaHa) ? (Number(f.cultivatedAreaHa) / Number(f.totalAreaHa)) * 100 : 0;
            return (
              <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={`/farms/${f.id}`} className="group block h-full rounded-lg border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-semibold group-hover:text-primary">{f.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {f.province}
                        {f.municipality ? ` · ${f.municipality}` : ''}
                      </p>
                    </div>
                    {f.isDemo && <Badge tone="blue">Demo</Badge>}
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Cultivado</span>
                      <span className="num">
                        {fmtNum(f.cultivatedAreaHa)} / {fmtNum(f.totalAreaHa)} ha
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="size-3.5" /> {f._count?.fields ?? 0} zonas
                    </span>
                    <span className="flex items-center gap-1">
                      <Cpu className="size-3.5" /> {f._count?.devices ?? 0} dispositivos
                    </span>
                    <span className="flex items-center gap-1">
                      <Droplets className="size-3.5" /> {LABELS.irrigation[f.irrigationSystem as keyof typeof LABELS.irrigation]}
                    </span>
                  </div>
                  {!!f.plantings?.length && (
                    <p className="mt-3 flex items-center gap-1 text-xs">
                      <Sprout className="size-3.5 text-primary" /> {[...new Set(f.plantings.map((p) => p.crop.name))].join(', ')}
                    </p>
                  )}
                  {f.budgetKz && <p className="mt-1 text-xs text-muted-foreground">Orçamento tecnologia: {formatKz(f.budgetKz)}</p>}
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}
