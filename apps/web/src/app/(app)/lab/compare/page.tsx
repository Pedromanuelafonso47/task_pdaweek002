'use client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, GitCompare, Minus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { LABELS, formatKz } from '@agrogenius/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { DifficultyBadge, labelList } from '@/features/lab/project-meta';
import { api } from '@/lib/api';
import type { ProjectDetail } from '@/lib/types';

type P = ProjectDetail & { baseCostKz: number };

const Yes = ({ v }: { v: boolean }) => (v ? <Check className="size-4 text-primary" /> : <Minus className="size-4 text-muted-foreground" />);

function CompareInner() {
  const slugs = (useSearchParams().get('slugs') ?? '').split(',').filter(Boolean).slice(0, 4);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['compare', slugs.join(',')],
    queryFn: () => api<P[]>(`/projects/compare?slugs=${slugs.join(',')}`),
    enabled: slugs.length > 0,
  });

  if (slugs.length < 2) {
    return (
      <EmptyState
        icon={GitCompare}
        title="Seleciona pelo menos 2 projetos"
        description="Na biblioteca, marca «Comparar» em 2 a 4 projetos."
        action={
          <Button asChild>
            <Link href="/lab">Ir para a biblioteca</Link>
          </Button>
        }
      />
    );
  }
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState error={error} retry={refetch} />;

  const minCost = Math.min(...data.map((p) => p.baseCostKz));
  const rows: { label: string; render: (p: P) => React.ReactNode }[] = [
    { label: 'Categoria', render: (p) => LABELS.projectCategory[p.category as keyof typeof LABELS.projectCategory] },
    { label: 'Custo base (referência)', render: (p) => <span className={p.baseCostKz === minCost ? 'font-semibold text-primary' : ''}>{formatKz(p.baseCostKz)}</span> },
    { label: 'Complexidade', render: (p) => <DifficultyBadge value={p.difficulty} /> },
    { label: 'Tempo de implementação', render: (p) => `${p.implementationDays} dia(s)` },
    { label: 'Funciona sem internet', render: (p) => <Yes v={p.worksOffline} /> },
    { label: 'Precisa de energia', render: (p) => <Yes v={p.requiresElectricity} /> },
    { label: 'Código ESP32 incluído', render: (p) => <Yes v={!!p.firmware} /> },
    { label: 'N.º de materiais', render: (p) => p.components.length },
    { label: 'Resolve', render: (p) => <div className="flex flex-wrap gap-1">{labelList(p.solves, LABELS.problem).map((l) => <Badge key={l}>{l}</Badge>)}</div> },
    { label: 'Objetivos', render: (p) => <div className="flex flex-wrap gap-1">{labelList(p.supportsGoals, LABELS.goal).map((l) => <Badge key={l} tone="green">{l}</Badge>)}</div> },
    { label: 'Principal limitação', render: (p) => <span className="text-muted-foreground">{p.limitations[0] ?? '—'}</span> },
  ];

  return (
    <div>
      <Link href="/lab" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> AgroTech Lab
      </Link>
      <PageHeader title="Comparar projetos" description="Custos de referência para 1 zona com eletricidade. Para valores dimensionados à tua propriedade, consulta as Recomendações." />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b">
              <th className="w-48 p-4" />
              {data.map((p) => (
                <th key={p.slug} className="p-4 text-left align-top">
                  <Link href={`/lab/${p.slug}`} className="font-display font-semibold hover:text-primary">
                    {p.title}
                  </Link>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">{p.tagline}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b last:border-0">
                <td className="p-4 text-xs font-medium text-muted-foreground">{r.label}</td>
                {data.map((p) => (
                  <td key={p.slug} className="p-4 align-top">
                    {r.render(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <React.Suspense fallback={<PageLoader />}>
      <CompareInner />
    </React.Suspense>
  );
}
