'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, BadgeCheck, CheckCircle2, CircleDashed, Hammer, Layers, TrendingUp, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { LABELS, formatKz } from '@agrogenius/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, Notice, PageLoader } from '@/components/ui/feedback';
import { ArchitectureDiagram } from '@/features/lab/architecture-diagram';
import { PriorityBadge, ScoreRing, StatusBadge, WeightBar } from '@/features/recommendations/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ProjectDetail, Recommendation } from '@/lib/types';
import { fmtDate } from '@/lib/utils';

type Detail = Omit<Recommendation, 'project'> & {
  project: ProjectDetail;
  farm: { id: string; name: string; budgetKz: string | null; province: string };
  farmProject: { id: string; status: string; startedAt: string | null; completedAt: string | null; actualCostKz: string | null } | null;
};

export default function RecommendationDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: r, isLoading, error, refetch } = useQuery({ queryKey: ['recommendation', id], queryFn: () => api<Detail>(`/recommendations/${id}`) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['recommendation', id] });
    qc.invalidateQueries({ queryKey: ['recommendations'] });
  };
  const setStatus = useMutation({
    mutationFn: (status: Recommendation['status']) => api(`/recommendations/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: (_d, s) => {
      toast.success(`Recomendação marcada como ${LABELS.recommendationStatus[s].toLowerCase()}`);
      refresh();
    },
  });
  const validate = useMutation({
    mutationFn: () => api(`/recommendations/${id}/validate`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Recomendação validada');
      refresh();
    },
  });

  if (isLoading) return <PageLoader />;
  if (error || !r) return <ErrorState error={error} retry={refetch} />;

  const canDecide = user?.role === 'FARMER' || user?.role === 'ADMIN';
  const canValidate = (user?.role === 'TECHNICIAN' || user?.role === 'ADMIN') && !r.validatedAt;
  const required = r.bom.filter((b) => !b.optional);
  const optional = r.bom.filter((b) => b.optional);
  const budget = r.farm.budgetKz ? Number(r.farm.budgetKz) : null;

  return (
    <div className="space-y-6">
      <Link href="/recommendations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Recomendações
      </Link>

      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <ScoreRing score={r.score} size={64} />
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <PriorityBadge value={r.priority} />
                <StatusBadge value={r.status} />
                {r.source === 'TECHNICIAN' && <Badge tone="solid">Recomendação técnica</Badge>}
                {r.validatedBy && (
                  <Badge tone="green">
                    <BadgeCheck /> Validada por {r.validatedBy.fullName} {r.validatedAt && `· ${fmtDate(r.validatedAt)}`}
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{r.project.title}</h1>
              <p className="text-sm text-muted-foreground">
                {r.farm.name} · {r.farm.province} · Problema identificado: <span className="text-foreground">{r.problem}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canValidate && (
              <Button variant="outline" onClick={() => validate.mutate()} loading={validate.isPending}>
                <BadgeCheck /> Validar
              </Button>
            )}
            {canDecide && r.status === 'PENDING' && (
              <>
                <Button variant="ghost" onClick={() => setStatus.mutate('DISMISSED')} disabled={setStatus.isPending}>
                  <XCircle /> Descartar
                </Button>
                <Button onClick={() => setStatus.mutate('ACCEPTED')} loading={setStatus.isPending}>
                  <CheckCircle2 /> Aceitar
                </Button>
              </>
            )}
            {canDecide && r.status === 'ACCEPTED' && (
              <Button onClick={() => setStatus.mutate('IMPLEMENTED')} loading={setStatus.isPending}>
                <Hammer /> Marcar como implementada
              </Button>
            )}
            {canDecide && (r.status === 'DISMISSED' || r.status === 'IMPLEMENTED') && (
              <Button variant="outline" onClick={() => setStatus.mutate('PENDING')} disabled={setStatus.isPending}>
                <CircleDashed /> Reabrir
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Porquê esta recomendação</CardTitle>
              <CardDescription>Cada fator está ligado a um dado da tua propriedade. O peso mostra quanto contribuiu para a pontuação.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {r.reasons.map((x) => (
                  <li key={x.code} className="flex items-start justify-between gap-4 py-3 text-sm">
                    <span>{x.text}</span>
                    {x.code !== 'TECHNICIAN' && <WeightBar weight={x.weight} />}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lista de materiais dimensionada</CardTitle>
              <CardDescription>Quantidades calculadas para esta propriedade (zonas, hectares e infraestrutura existente).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 pr-3 font-medium">Componente</th>
                      <th className="py-2 pr-3 text-right font-medium">Qtd</th>
                      <th className="py-2 pr-3 text-right font-medium">Preço unit.</th>
                      <th className="py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...required, ...optional].map((b, i) => (
                      <tr key={i} className={b.optional ? 'border-b text-muted-foreground last:border-0' : 'border-b last:border-0'}>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">
                            {b.name} {b.optional && <Badge className="ml-1">opcional</Badge>}
                          </div>
                          {(b.spec || b.note) && <div className="text-xs text-muted-foreground">{[b.spec, b.note].filter(Boolean).join(' · ')}</div>}
                        </td>
                        <td className="num py-2.5 pr-3 text-right">{b.quantity}</td>
                        <td className="num py-2.5 pr-3 text-right">{formatKz(b.unitPriceKz)}</td>
                        <td className="num py-2.5 text-right">{formatKz(b.totalKz)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="pt-3 text-right text-sm font-medium">
                        Total estimado (sem opcionais)
                      </td>
                      <td className="num pt-3 text-right font-display text-base font-semibold">{formatKz(r.estimatedCostKz)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <Notice>Preços de referência AGROGENIUS — confirmar com fornecedores locais. Não inclui mão de obra de instalação nem transporte.</Notice>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Arquitetura técnica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ArchitectureDiagram nodes={r.project.architecture.nodes} edges={r.project.architecture.edges} />
              <Button variant="outline" asChild>
                <Link href={`/lab/${r.project.slug}`}>
                  <Layers /> Esquema de ligações, código ESP32 e passos de montagem
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custo e orçamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="num font-display text-3xl font-semibold">{formatKz(r.estimatedCostKz)}</div>
              {budget !== null ? (
                <>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={r.withinBudget ? 'h-full bg-primary' : 'h-full bg-warning'} style={{ width: `${Math.min(100, (budget / Number(r.estimatedCostKz)) * 100)}%` }} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Orçamento indicado: <span className="num text-foreground">{formatKz(budget)}</span>{' '}
                    {r.withinBudget ? '— cobre o projeto completo.' : '— não cobre o projeto completo.'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem orçamento indicado na propriedade.</p>
              )}
            </CardContent>
          </Card>

          {!!r.phases?.length && (
            <Card>
              <CardHeader>
                <CardTitle>Implementação faseada</CardTitle>
                <CardDescription>Começar pequeno, medir resultados reais, depois expandir.</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  {r.phases.map((p, i) => (
                    <li key={i} className="rounded-md border p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="num text-sm font-semibold">{formatKz(p.costKz)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                      {i === 0 && budget !== null && p.costKz <= budget && <Badge tone="green" className="mt-2">Cabe no orçamento</Badge>}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" /> Retorno do investimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {r.roi?.kind === 'ESTIMATE' ? (
                <>
                  <Badge tone="amber">ESTIMATIVA — não é um resultado comprovado</Badge>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Poupança anual estimada</div>
                      <div className="num font-display text-lg font-semibold">{formatKz(r.roi.annualSavingsKz)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Recuperação</div>
                      <div className="num font-display text-lg font-semibold">~{r.roi.paybackMonths} meses</div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium">Pressupostos</div>
                    <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      {r.roi.assumptions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">Não calculado: não há dados suficientes para uma estimativa honesta.</p>
                  {r.roi?.missing?.length ? (
                    <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      {r.roi.missing.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  ) : null}
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/finance">Registar despesas</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {!!r.warnings.length && (
            <Card className="border-warning/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-warning" /> Atenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {r.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {r.farmProject && (
            <Card>
              <CardHeader>
                <CardTitle>Implementação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <div>
                  Estado: <span className="text-foreground">{r.farmProject.status}</span>
                </div>
                {r.farmProject.completedAt && <div>Concluído em {fmtDate(r.farmProject.completedAt)}</div>}
                {r.farmProject.actualCostKz && <div>Custo real: {formatKz(r.farmProject.actualCostKz)}</div>}
              </CardContent>
            </Card>
          )}
          <p className="text-xs text-muted-foreground">Motor: {r.engineVersion ?? 'técnico'} · atualizado pela última análise da propriedade.</p>
        </div>
      </div>
    </div>
  );
}
