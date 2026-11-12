'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, EyeOff, Info, Map, Sparkles, Wand2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { formatKz } from '@agrogenius/shared';
import { Photo } from '@/components/photo';
import { Badge } from '@/components/ui/badge';
import { mediaFor } from '@/content/project-media';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { ManualRecommendationDialog } from '@/features/recommendations/manual-dialog';
import { PriorityBadge, ScoreRing, StatusBadge, missingLink } from '@/features/recommendations/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFarm } from '@/lib/farm-context';
import type { Recommendation } from '@/lib/types';
import { cn } from '@/lib/utils';

interface RecResponse {
  items: Recommendation[];
  analysis: { version: string; excluded: { projectSlug: string; title?: string; reason: string }[]; missingData: string[] };
}

const FILTERS = [
  { key: 'ACTIVE', label: 'Ativas' },
  { key: 'ACCEPTED', label: 'Aceites' },
  { key: 'IMPLEMENTED', label: 'Implementadas' },
  { key: 'DISMISSED', label: 'Descartadas' },
] as const;

export default function RecommendationsPage() {
  const { farmId, farm, isLoading: farmsLoading } = useFarm();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]['key']>('ACTIVE');
  const [showExcluded, setShowExcluded] = React.useState(false);

  const q = useQuery({
    queryKey: ['recommendations', farmId],
    queryFn: () => api<RecResponse>(`/farms/${farmId}/recommendations`),
    enabled: !!farmId,
  });
  const gen = useMutation({
    mutationFn: () => api<RecResponse>(`/farms/${farmId}/recommendations/generate`, { method: 'POST' }),
    onSuccess: (d) => {
      qc.setQueryData(['recommendations', farmId], d);
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(`Análise concluída: ${d.items.filter((i) => i.source === 'ENGINE').length} projeto(s) adequado(s).`);
    },
  });

  if (farmsLoading) return <PageLoader />;
  if (!farmId || !farm) {
    return (
      <EmptyState
        icon={Map}
        title="Ainda não há propriedades"
        description="Regista uma propriedade para receber recomendações de automação ajustadas à tua realidade."
        action={
          <Button asChild>
            <Link href="/farms/new">Registar propriedade</Link>
          </Button>
        }
      />
    );
  }

  const items = q.data?.items ?? [];
  const visible = items.filter((r) => (filter === 'ACTIVE' ? r.status === 'PENDING' || r.status === 'ACCEPTED' : r.status === filter));
  const top = visible[0];
  const canTech = user?.role === 'TECHNICIAN' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Motor de Inteligência Agrícola"
        title="Recomendações de automação"
        description={
          <>
            Projetos IoT escolhidos e dimensionados para <strong className="text-foreground">{farm.name}</strong> com base nos dados registados — cultura, solo,
            água, infraestrutura e orçamento.
          </>
        }
        actions={
          <>
            {canTech && <ManualRecommendationDialog farmId={farmId} />}
            <Button onClick={() => gen.mutate()} loading={gen.isPending}>
              <Wand2 /> Analisar propriedade
            </Button>
          </>
        }
      />

      {q.error ? (
        <ErrorState error={q.error} retry={q.refetch} />
      ) : q.isLoading ? (
        <PageLoader />
      ) : (
        <>
          {!!q.data?.analysis.missingData.length && (
            <Card className="border-warning/30">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <Info className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="flex-1 space-y-2 text-sm">
                  <p className="font-medium">A análise melhora com mais dados</p>
                  <div className="flex flex-wrap gap-2">
                    {q.data.analysis.missingData.map((m) => (
                      <Link key={m} href={missingLink(m, farmId)} className="rounded-full border px-3 py-1 text-xs hover:border-primary hover:text-primary">
                        + {m}
                      </Link>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const n = items.filter((r) => (f.key === 'ACTIVE' ? r.status === 'PENDING' || r.status === 'ACCEPTED' : r.status === f.key)).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn('rounded-full border px-3 py-1.5 text-sm', filter === f.key ? 'border-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground')}
                >
                  {f.label} <span className="num ml-1 text-xs opacity-70">{n}</span>
                </button>
              );
            })}
          </div>

          {!items.length ? (
            <EmptyState
              icon={Sparkles}
              title="Ainda sem recomendações"
              description="Clica em «Analisar propriedade» para o motor avaliar os projetos da AgroTech Lab face às condições desta propriedade."
              action={
                <Button onClick={() => gen.mutate()} loading={gen.isPending}>
                  <Wand2 /> Analisar agora
                </Button>
              }
            />
          ) : !visible.length ? (
            <EmptyState title="Nada nesta categoria" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {visible.map((r) => (
                <Link
                  key={r.id}
                  href={`/recommendations/${r.id}`}
                  className={cn(
                    'group flex flex-col overflow-hidden rounded-xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow',
                    r === top && filter === 'ACTIVE' && 'border-primary/40 bg-gradient-to-br from-primary/[0.07] to-card lg:col-span-2',
                  )}
                >
                  <Photo
                    k={mediaFor(r.project.slug).photo}
                    sizes="(min-width:1024px) 50vw, 100vw"
                    className={cn(r === top && filter === 'ACTIVE' ? 'aspect-[21/5]' : 'aspect-[16/5]')}
                    imgClassName="transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start gap-4">
                    <ScoreRing score={r.score} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap gap-1.5">
                        <PriorityBadge value={r.priority} />
                        {r.status !== 'PENDING' && <StatusBadge value={r.status} />}
                        {r.source === 'TECHNICIAN' && <Badge tone="solid">Técnico</Badge>}
                        {r.validatedBy && <Badge tone="green">Validada por {r.validatedBy.fullName}</Badge>}
                      </div>
                      <h3 className="font-display text-lg font-semibold leading-snug">{r.project.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Problema: <span className="text-foreground">{r.problem}</span>
                      </p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                    {r.reasons
                      .filter((x) => x.weight > 0 || x.code === 'TECHNICIAN')
                      .slice(0, r === top && filter === 'ACTIVE' ? 4 : 2)
                      .map((x) => (
                        <li key={x.code} className="flex gap-2">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                          {x.text}
                        </li>
                      ))}
                  </ul>
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t pt-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Custo estimado</div>
                      <div className="num font-display text-lg font-semibold">{formatKz(r.estimatedCostKz)}</div>
                      {r.withinBudget ? (
                        <span className="text-xs text-primary">Dentro do orçamento</span>
                      ) : r.phases?.length ? (
                        <span className="text-xs text-warning">Excede o orçamento · piloto {formatKz(r.phases[0].costKz)}</span>
                      ) : (
                        <span className="text-xs text-warning">Excede o orçamento</span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-sm text-primary">
                      Ver plano completo <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <Notice>
            Custos calculados com preços de referência — confirmar com fornecedores locais. Motor {q.data?.analysis.version}: regras determinísticas e explicáveis; nenhuma
            recomendação é mostrada sem ligação a um problema ou objetivo que declaraste.
          </Notice>

          {!!q.data?.analysis.excluded.length && (
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => setShowExcluded((s) => !s)}>
                <CardTitle className="flex items-center gap-2">
                  <EyeOff className="size-4 text-muted-foreground" /> Transparência: {q.data.analysis.excluded.length} projeto(s) não recomendados
                  <ChevronDown className={cn('ml-auto size-4 transition-transform', showExcluded && 'rotate-180')} />
                </CardTitle>
              </CardHeader>
              {showExcluded && (
                <CardContent>
                  <ul className="divide-y text-sm">
                    {q.data.analysis.excluded.map((e) => (
                      <li key={e.projectSlug} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <Link href={`/lab/${e.projectSlug}`} className="font-medium hover:text-primary">
                          {e.title ?? e.projectSlug}
                        </Link>
                        <span className="text-muted-foreground sm:max-w-[60%] sm:text-right">{e.reason}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
