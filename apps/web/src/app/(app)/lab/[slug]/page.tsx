'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Heart, ListChecks, Wrench, Zap } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { LABELS, formatKz } from '@agrogenius/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, Notice, PageLoader } from '@/components/ui/feedback';
import { Stat } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArchitectureDiagram } from '@/features/lab/architecture-diagram';
import { FirmwareViewer } from '@/features/lab/firmware-viewer';
import { CATEGORY_ICON, DifficultyBadge, OfflineBadge, PowerBadge, RULE_LABEL, labelList } from '@/features/lab/project-meta';
import { api } from '@/lib/api';
import type { ProjectDetail } from '@/lib/types';
import { cn } from '@/lib/utils';

const CONDITION_LABEL: Record<string, string> = {
  NO_PUMP: 'só se não houver bomba',
  NO_ELECTRICITY: 'só sem eletricidade (solar)',
  HAS_ELECTRICITY: 'só com eletricidade',
  NO_INTERNET: 'só com internet limitada',
  HAS_INTERNET: 'só com boa internet',
};

function List({ items, icon: Icon, tone = 'text-primary' }: { items: string[]; icon: React.ElementType; tone?: string }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <Icon className={cn('mt-0.5 size-4 shrink-0', tone)} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const { data: p, isLoading, error, refetch } = useQuery({ queryKey: ['project', slug], queryFn: () => api<ProjectDetail & { baseCostKz: number }>(`/projects/${slug}`) });
  const fav = useMutation({
    mutationFn: () => api<{ isFavorite: boolean }>(`/projects/${slug}/favorite`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', slug] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  if (isLoading) return <PageLoader />;
  if (error || !p) return <ErrorState error={error} retry={refetch} />;
  const Icon = CATEGORY_ICON[p.category];

  return (
    <div className="space-y-6">
      <Link href="/lab" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> AgroTech Lab
      </Link>

      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-accent/20 via-card to-card p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-sm text-primary">
              {Icon && <Icon className="size-4" />} {LABELS.projectCategory[p.category as keyof typeof LABELS.projectCategory]}
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{p.title}</h1>
            <p className="text-muted-foreground">{p.tagline}</p>
            <div className="flex flex-wrap gap-1.5">
              <DifficultyBadge value={p.difficulty} />
              <OfflineBadge offline={p.worksOffline} />
              <PowerBadge requires={p.requiresElectricity} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fav.mutate()} loading={fav.isPending}>
              <Heart className={cn(p.isFavorite && 'fill-primary text-primary')} /> {p.isFavorite ? 'Nos favoritos' : 'Guardar'}
            </Button>
            <Button asChild>
              <Link href={`/lab/compare?slugs=${p.slug}`}>Comparar</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Custo base de referência" value={formatKz(p.baseCostKz)} sub="1 zona, com eletricidade — o custo real é dimensionado por propriedade" />
        <Stat label="Tempo de implementação" value={`${p.implementationDays} dia(s)`} icon={Clock} />
        <Stat label="Complexidade" value={LABELS.difficulty[p.difficulty as keyof typeof LABELS.difficulty]} icon={Wrench} />
        <Stat label="Materiais" value={`${p.components.length} itens`} sub={`${p.components.filter((c) => c.optional).length} opcionais`} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="architecture">Arquitetura</TabsTrigger>
          <TabsTrigger value="materials">Materiais</TabsTrigger>
          <TabsTrigger value="wiring">Ligações</TabsTrigger>
          {p.firmware && <TabsTrigger value="code">Código ESP32</TabsTrigger>}
          <TabsTrigger value="build">Montagem</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Descrição técnica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm leading-relaxed text-muted-foreground">{p.description}</p>
              <div>
                <h4 className="mb-3 text-sm font-semibold">Como funciona</h4>
                <ol className="space-y-3">
                  {p.howItWorks.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-xs text-primary">{i + 1}</span>
                      <span className="pt-0.5">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Resolve</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {labelList(p.solves, LABELS.problem).map((l) => (
                  <Badge key={l}>{l}</Badge>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Casos de utilização</CardTitle>
              </CardHeader>
              <CardContent>
                <List items={p.useCases} icon={CheckCircle2} />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Benefícios esperados</CardTitle>
            </CardHeader>
            <CardContent>
              <List items={p.benefits} icon={Zap} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Limitações</CardTitle>
            </CardHeader>
            <CardContent>
              <List items={p.limitations} icon={AlertTriangle} tone="text-warning" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Manutenção</CardTitle>
            </CardHeader>
            <CardContent>
              <List items={p.maintenance} icon={Wrench} tone="text-muted-foreground" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="architecture" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Diagrama de funcionamento</CardTitle>
            </CardHeader>
            <CardContent>
              <ArchitectureDiagram nodes={p.architecture.nodes} edges={p.architecture.edges} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de materiais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 pr-3 font-medium">Componente</th>
                      <th className="py-2 pr-3 font-medium">Quantidade</th>
                      <th className="py-2 pr-3 text-right font-medium">Preço unitário</th>
                      <th className="py-2 font-medium">Condição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.components.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">
                            {c.name} {c.optional && <Badge className="ml-1">opcional</Badge>}
                          </div>
                          {c.spec && <div className="text-xs text-muted-foreground">{c.spec}</div>}
                        </td>
                        <td className="num py-2.5 pr-3">
                          {c.quantity} <span className="text-xs text-muted-foreground">{RULE_LABEL[c.quantityRule]}</span>
                          {c.maxQuantity && <span className="text-xs text-muted-foreground"> (máx. {c.maxQuantity})</span>}
                        </td>
                        <td className="num py-2.5 pr-3 text-right">{formatKz(Number(c.unitPriceKz))}</td>
                        <td className="py-2.5 text-xs text-muted-foreground">{c.condition ? CONDITION_LABEL[c.condition] ?? c.condition : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Notice>
                Preços unitários de referência ({p.components[0]?.priceSource ?? 'estimativa AGROGENIUS'}). As quantidades &quot;por zona&quot; e &quot;por hectare&quot; são
                dimensionadas para cada propriedade nas Recomendações.
              </Notice>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wiring" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Esquema de ligação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {p.wiring.map((w, i) => (
                  <div key={i} className="grid gap-2 rounded-md border bg-background/40 p-3 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <span className="font-mono text-xs">{w.from}</span>
                    <span className="hidden h-px w-16 bg-gradient-to-r from-primary/20 via-primary to-primary/20 sm:block" />
                    <span className="font-mono text-xs text-primary">{w.to}</span>
                    {w.note && <span className="text-xs text-muted-foreground sm:col-span-3">⚠ {w.note}</span>}
                  </div>
                ))}
              </div>
              <Notice tone="warn" className="mt-4">
                Ligações em 220 V (bombas, contactores) devem ser feitas por um eletricista qualificado. Desliga sempre a alimentação antes de trabalhar.
              </Notice>
            </CardContent>
          </Card>
        </TabsContent>

        {p.firmware && (
          <TabsContent value="code" className="mt-4 space-y-3">
            <Notice>
              Código de referência para Arduino core 3.x (ESP32). Preenche as credenciais Wi-Fi e MQTT obtidas ao registar o dispositivo em AgroControl. Bibliotecas: PubSubClient e ArduinoJson 7.
            </Notice>
            <FirmwareViewer code={p.firmware} filename={`${p.slug}.ino`} />
          </TabsContent>
        )}

        <TabsContent value="build" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Passos de montagem</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l pl-6">
                {p.assemblySteps.map((s, i) => (
                  <li key={i} className="relative text-sm">
                    <span className="absolute -left-[35px] grid size-6 place-items-center rounded-full border bg-card font-mono text-xs">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <ListChecks className="size-4 text-primary" /> Depois de montado, regista o dispositivo em{' '}
                <Link href="/iot" className="text-primary hover:underline">
                  AgroControl
                </Link>
                .
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
