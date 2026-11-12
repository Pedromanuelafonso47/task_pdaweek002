'use client';
import { LABELS, formatKz } from '@agrogenius/shared';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CalendarClock, Cpu, Layers, Map, Plus, Sprout, Wand2, Wheat } from 'lucide-react';
import Link from 'next/link';
import { Badge, priorityTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/ui/feedback';
import { Photo } from '@/components/photo';
import { PageHeader, Stat } from '@/components/ui/page-header';
import { CropAreaChart } from '@/features/dashboard/crop-area-chart';
import { FarmExplorer } from '@/features/dashboard/farm-explorer';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFarm } from '@/lib/farm-context';
import type { Notification } from '@/lib/types';
import { cn, fmtDate, fmtNum, fmtRelative } from '@/lib/utils';

interface Dashboard {
  farms: { id: string; name: string; isDemo: boolean }[];
  kpis: {
    farmCount: number;
    totalAreaHa: number;
    cultivatedAreaHa: number;
    activeCrops: number;
    estimatedProductionKg: number | null;
    estimateCoverage: number;
    incomeYtd: number;
    expenseYtd: number;
    unreadNotifications: number;
  };
  cropAreas: { crop: string; areaHa: number }[];
  upcomingHarvests: { id: string; expectedHarvestAt: string; areaHa: string; crop: { name: string }; farm: { id: string; name: string } }[];
  devices: Partial<Record<'ONLINE' | 'OFFLINE' | 'PENDING' | 'DISABLED', number>>;
  alerts: Notification[];
  pendingRecommendations: { id: string; score: number; priority: string; problem: string; estimatedCostKz: string; project: { slug: string; title: string }; farm: { id: string; name: string } }[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { farmId, farm } = useFarm();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard'), refetchInterval: 60_000 });

  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data!;
  const k = d.kpis;
  const devTotal = Object.values(d.devices).reduce((s, n) => s + (n ?? 0), 0);
  const firstName = user?.fullName.split(' ')[0];

  if (k.farmCount === 0) {
    return (
      <>
        <PageHeader eyebrow="Painel" title={`Olá, ${firstName}`} />
        <EmptyState
          icon={Map}
          title={user?.role === 'TECHNICIAN' ? 'Ainda não tens propriedades atribuídas' : 'Ainda não tens propriedades'}
          description={user?.role === 'TECHNICIAN' ? 'Um agricultor tem de te autorizar o acesso à propriedade dele, indicando o teu email.' : 'Regista a tua primeira propriedade para receberes recomendações personalizadas.'}
          action={
            user?.role !== 'TECHNICIAN' && (
              <Button asChild>
                <Link href="/farms/new">
                  <Plus /> Registar propriedade
                </Link>
              </Button>
            )
          }
        />
      </>
    );
  }

  return (
    <>
      <section className="dark relative isolate mb-6 overflow-hidden rounded-2xl text-snow">
        <Photo k="angola-namibe-campo" priority sizes="(min-width:1024px) 75vw, 100vw" className="absolute inset-0 -z-10" imgClassName="object-[center_45%]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-night via-night/80 to-night/10" />
        <div className="flex flex-col gap-4 px-6 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-10">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-tech">Painel</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Olá, {firstName}</h1>
            <p className="text-sm text-snow/75">
              {k.farmCount} propriedade(s) · {fmtNum(k.cultivatedAreaHa)} de {fmtNum(k.totalAreaHa)} ha cultivados
            </p>
          </div>
          <Button asChild variant="outline" className="border-white/25 bg-black/30 text-snow backdrop-blur hover:bg-white/10">
            <Link href="/recommendations">
              <Wand2 /> Recomendações
            </Link>
          </Button>
        </div>
      </section>
      {farm?.isDemo && (
        <Notice tone="demo" className="mb-4">
          <b>Dados de demonstração.</b> Esta propriedade foi criada para demonstração; os valores não correspondem a uma exploração real.
        </Notice>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Área total" value={`${fmtNum(k.totalAreaHa)} ha`} sub={`${k.farmCount} propriedade(s)`} icon={Layers} />
        <Stat label="Culturas ativas" value={k.activeCrops} sub={d.cropAreas.map((c) => c.crop).slice(0, 3).join(', ') || 'nenhuma registada'} icon={Sprout} />
        <Stat
          label="Produção estimada"
          value={k.estimatedProductionKg !== null ? `${fmtNum(k.estimatedProductionKg / 1000, 1)} t` : '—'}
          sub={
            k.estimatedProductionKg !== null
              ? `Declarada pelo agricultor · cobre ${Math.round(k.estimateCoverage * 100)}% das plantações`
              : 'Sem estimativas registadas'
          }
          icon={Wheat}
        />
        <Stat
          label="Dispositivos IoT"
          value={devTotal ? `${d.devices.ONLINE ?? 0}/${devTotal}` : '0'}
          sub={devTotal ? `online${d.devices.OFFLINE ? ` · ${d.devices.OFFLINE} offline` : ''}` : 'Nenhum dispositivo registado'}
          icon={Cpu}
          className={cn(d.devices.OFFLINE && 'border-warning/40')}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat label="Receitas (ano)" value={formatKz(k.incomeYtd)} />
        <Stat label="Despesas (ano)" value={formatKz(k.expenseYtd)} />
        <Stat
          label="Resultado (ano)"
          value={<span className={k.incomeYtd - k.expenseYtd < 0 ? 'text-destructive' : 'text-primary'}>{formatKz(k.incomeYtd - k.expenseYtd)}</span>}
          sub="Com base nas transações registadas"
        />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">{farm?.name ?? 'Propriedade'}</h2>
            <p className="text-xs text-muted-foreground">Terreno, zonas, irrigação e sensores com as leituras mais recentes</p>
          </div>
        </div>
        {farmId && <FarmExplorer farmId={farmId} />}
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" /> Alertas importantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.alerts.length ? (
              <ul className="space-y-3">
                {d.alerts.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', a.severity === 'CRITICAL' ? 'bg-destructive' : 'bg-warning')} />
                    <div>
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.body}</p>
                      <p className="text-[11px] text-muted-foreground/70">{fmtRelative(a.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem alertas por ler.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="size-4 text-primary" /> Recomendações pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.pendingRecommendations.length ? (
              <ul className="space-y-2">
                {d.pendingRecommendations.map((r) => (
                  <li key={r.id}>
                    <Link href={`/recommendations/${r.id}`} className="group flex items-start justify-between gap-2 rounded-md p-2 -mx-2 hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium group-hover:text-primary">{r.project.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.problem} · {formatKz(r.estimatedCostKz)}
                        </p>
                      </div>
                      <Badge tone={priorityTone(r.priority)}>{LABELS.priority[r.priority as keyof typeof LABELS.priority]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma recomendação pendente.</p>
            )}
            <Button asChild variant="link" className="mt-2">
              <Link href="/recommendations">
                Ver todas <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" /> Próximas colheitas
            </CardTitle>
            <CardDescription>Próximos 60 dias, a partir da data de plantação e ciclo</CardDescription>
          </CardHeader>
          <CardContent>
            {d.upcomingHarvests.length ? (
              <ul className="space-y-2">
                {d.upcomingHarvests.map((h) => (
                  <li key={h.id} className="flex items-center justify-between text-sm">
                    <span>
                      {h.crop.name} <span className="text-xs text-muted-foreground">· {h.farm.name}</span>
                    </span>
                    <span className="num text-xs">{fmtDate(h.expectedHarvestAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem colheitas previstas. Regista a data de plantação em Produção para obter previsões.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Área ativa por cultura</CardTitle>
          <CardDescription>Plantações planeadas e em crescimento, em todas as propriedades</CardDescription>
        </CardHeader>
        <CardContent>
          {d.cropAreas.length ? <CropAreaChart data={d.cropAreas} /> : <p className="text-sm text-muted-foreground">Sem plantações ativas.</p>}
        </CardContent>
      </Card>
    </>
  );
}
