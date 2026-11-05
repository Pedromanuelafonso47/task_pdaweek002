'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Map, MoreHorizontal, Pencil, Plus, Sprout, Tractor, Trash2, Wheat } from 'lucide-react';
import * as DM from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { LABELS } from '@agrogenius/shared';
import { Badge, statusTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Notice, PageLoader, Skeleton } from '@/components/ui/feedback';
import { PageHeader, Stat } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityDialog, HarvestDialog, PlantingDialog, type Planting } from '@/features/production/forms';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFarm } from '@/lib/farm-context';
import { fmtDate, fmtNum } from '@/lib/utils';

type DialogState = { kind: 'new' } | { kind: 'edit' | 'activity' | 'harvest'; planting: Planting } | null;

interface CalendarItem {
  id: string;
  farm: { id: string; name: string };
  crop: string;
  status: string;
  plantedAt: string | null;
  expectedHarvestAt: string | null;
  daysSincePlanting: number | null;
  currentStage: string | null;
  progress: number;
}
interface ProductivityRow {
  crop: string;
  areaHa: number;
  harvestedKg: number;
  estimatedKg: number;
  plantings: number;
  yieldKgHa: number | null;
}

function PlantingCard({ p, onAction, canEdit }: { p: Planting; onAction: (d: DialogState) => void; canEdit: boolean }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => api(`/plantings/${p.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Plantação removida');
      qc.invalidateQueries({ queryKey: ['plantings', p.farmId] });
    },
  });
  const harvested = p.harvests.reduce((s, h) => s + Number(h.quantityKg), 0);
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{p.crop.name}</CardTitle>
            <Badge tone={statusTone(p.status)}>{LABELS.plantingStatus[p.status]}</Badge>
          </div>
          <CardDescription>
            {fmtNum(p.areaHa, 2)} ha{p.field ? ` · ${p.field.name}` : ''}
            {p.seedVariety ? ` · ${p.seedVariety}` : ''}
          </CardDescription>
        </div>
        {canEdit && (
          <DM.Root>
            <DM.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mais ações">
                <MoreHorizontal />
              </Button>
            </DM.Trigger>
            <DM.Portal>
              <DM.Content align="end" className="z-50 min-w-40 rounded-md border bg-card p-1 shadow-soft">
                <DM.Item onSelect={() => onAction({ kind: 'edit', planting: p })} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted">
                  <Pencil className="size-4" /> Editar
                </DM.Item>
                <DM.Item
                  onSelect={() => confirm(`Remover a plantação de ${p.crop.name}? As atividades e colheitas associadas também são removidas.`) && del.mutate()}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none data-[highlighted]:bg-muted"
                >
                  <Trash2 className="size-4" /> Remover
                </DM.Item>
              </DM.Content>
            </DM.Portal>
          </DM.Root>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Plantação</div>
            <div className="font-medium">{fmtDate(p.plantedAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Colheita prevista</div>
            <div className="font-medium">{fmtDate(p.expectedHarvestAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Colhido (real)</div>
            <div className="num font-medium">{harvested ? `${fmtNum(harvested, 0)} kg` : '—'}</div>
          </div>
        </div>
        {p.activities.length > 0 && (
          <div className="space-y-1.5 border-t pt-3">
            <div className="text-xs font-medium text-muted-foreground">Últimas atividades</div>
            {p.activities.slice(0, 3).map((a) => (
              <div key={a.id} className="flex justify-between gap-2 text-xs">
                <span className="truncate">
                  {LABELS.activity[a.type as keyof typeof LABELS.activity]}
                  {a.product ? ` · ${a.product}` : ''}
                  {a.quantity ? ` · ${fmtNum(a.quantity)} ${a.unit ?? ''}` : ''}
                </span>
                <span className="shrink-0 text-muted-foreground">{fmtDate(a.date)}</span>
              </div>
            ))}
          </div>
        )}
        {canEdit && (
          <div className="mt-auto flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onAction({ kind: 'activity', planting: p })}>
              <ClipboardList /> Atividade
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onAction({ kind: 'harvest', planting: p })}>
              <Wheat /> Colheita
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProductionPage() {
  const { farmId, farm, isLoading: farmsLoading } = useFarm();
  const { user } = useAuth();
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const canEdit = user?.role !== 'TECHNICIAN';

  const plantings = useQuery({ queryKey: ['plantings', farmId], queryFn: () => api<Planting[]>(`/farms/${farmId}/plantings`), enabled: !!farmId });
  const calendar = useQuery({ queryKey: ['calendar'], queryFn: () => api<CalendarItem[]>('/production/calendar') });
  const productivity = useQuery({ queryKey: ['productivity'], queryFn: () => api<ProductivityRow[]>('/production/productivity') });

  if (farmsLoading) return <PageLoader />;
  if (!farmId || !farm) {
    return (
      <EmptyState
        icon={Map}
        title="Sem propriedade"
        description="Regista uma propriedade para gerir culturas e produção."
        action={
          <Button asChild>
            <Link href="/farms/new">Registar propriedade</Link>
          </Button>
        }
      />
    );
  }

  const list = plantings.data ?? [];
  const active = list.filter((p) => p.status === 'PLANNED' || p.status === 'GROWING');
  const closed = list.filter((p) => p.status === 'HARVESTED' || p.status === 'FAILED');
  const activeArea = active.reduce((s, p) => s + Number(p.areaHa), 0);
  const harvestedKg = list.flatMap((p) => p.harvests).reduce((s, h) => s + Number(h.quantityKg), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={farm.name}
        title="Culturas e produção"
        description="Plantações, atividades de campo, calendário agrícola e produtividade real. Atividades e colheitas podem ser registadas sem internet."
        actions={
          canEdit && (
            <Button onClick={() => setDialog({ kind: 'new' })}>
              <Plus /> Nova plantação
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Plantações ativas" value={active.length} icon={Sprout} />
        <Stat label="Área em produção" value={`${fmtNum(activeArea, 2)} ha`} sub={`de ${fmtNum(farm.cultivatedAreaHa, 2)} ha cultivados`} />
        <Stat label="Culturas diferentes" value={new Set(active.map((p) => p.crop.id)).size} />
        <Stat label="Colhido (real, total)" value={harvestedKg ? `${fmtNum(harvestedKg, 0)} kg` : '—'} icon={Tractor} />
      </div>

      <Tabs defaultValue="plantings">
        <TabsList>
          <TabsTrigger value="plantings">
            <Sprout /> Plantações
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays /> Calendário
          </TabsTrigger>
          <TabsTrigger value="productivity">
            <Wheat /> Produtividade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plantings" className="mt-4 space-y-6">
          {plantings.error ? (
            <ErrorState error={plantings.error} retry={plantings.refetch} />
          ) : plantings.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-56" />
              ))}
            </div>
          ) : !list.length ? (
            <EmptyState
              icon={Sprout}
              title="Ainda sem plantações"
              description="Regista o que está plantado para acompanhar fases, atividades e colheitas."
              action={canEdit && <Button onClick={() => setDialog({ kind: 'new' })}>Registar primeira plantação</Button>}
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {active.map((p) => (
                  <PlantingCard key={p.id} p={p} onAction={setDialog} canEdit={canEdit} />
                ))}
              </div>
              {closed.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-medium text-muted-foreground">Histórico</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {closed.map((p) => (
                      <PlantingCard key={p.id} p={p} onAction={setDialog} canEdit={canEdit} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          {calendar.error ? (
            <ErrorState error={calendar.error} retry={calendar.refetch} />
          ) : calendar.isLoading ? (
            <Skeleton className="h-64" />
          ) : !calendar.data?.length ? (
            <EmptyState icon={CalendarDays} title="Calendário vazio" description="As plantações planeadas e em crescimento aparecem aqui com a fase atual." />
          ) : (
            <Card>
              <CardContent className="divide-y p-0">
                {calendar.data.map((c) => {
                  const days = c.expectedHarvestAt ? Math.ceil((new Date(c.expectedHarvestAt).getTime() - Date.now()) / 86_400_000) : null;
                  return (
                    <div key={c.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-center">
                      <div>
                        <div className="font-medium">{c.crop}</div>
                        <div className="text-xs text-muted-foreground">{c.farm.name}</div>
                      </div>
                      <div>
                        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                          <span>{c.currentStage ?? (c.plantedAt ? 'Fase não determinada' : 'Sem data de plantação')}</span>
                          <span className="num">{c.daysSincePlanting !== null ? `dia ${c.daysSincePlanting}` : ''}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(c.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                          <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary" style={{ width: `${c.progress * 100}%` }} />
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-muted-foreground">Colheita prevista</div>
                        <div className="font-medium">{fmtDate(c.expectedHarvestAt)}</div>
                        {days !== null && <div className={days < 0 ? 'text-warning' : 'text-primary'}>{days < 0 ? `${-days} dias em atraso` : `em ${days} dias`}</div>}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="productivity" className="mt-4 space-y-3">
          {productivity.error ? (
            <ErrorState error={productivity.error} retry={productivity.refetch} />
          ) : productivity.isLoading ? (
            <Skeleton className="h-48" />
          ) : !productivity.data?.length ? (
            <EmptyState icon={Wheat} title="Sem dados de produtividade" description="Regista plantações e colheitas para ver a produtividade por cultura." />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="p-4 font-medium">Cultura</th>
                      <th className="p-4 text-right font-medium">Plantações</th>
                      <th className="p-4 text-right font-medium">Área (ha)</th>
                      <th className="p-4 text-right font-medium">Estimado (kg)</th>
                      <th className="p-4 text-right font-medium">Colhido — real (kg)</th>
                      <th className="p-4 text-right font-medium">Produtividade real (kg/ha)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productivity.data.map((r) => (
                      <tr key={r.crop} className="border-b last:border-0">
                        <td className="p-4 font-medium">{r.crop}</td>
                        <td className="num p-4 text-right">{r.plantings}</td>
                        <td className="num p-4 text-right">{fmtNum(r.areaHa, 2)}</td>
                        <td className="num p-4 text-right text-muted-foreground">{r.estimatedKg ? fmtNum(r.estimatedKg, 0) : '—'}</td>
                        <td className="num p-4 text-right">{r.harvestedKg ? fmtNum(r.harvestedKg, 0) : '—'}</td>
                        <td className="num p-4 text-right font-semibold">{r.yieldKgHa !== null ? fmtNum(r.yieldKgHa, 0) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
          <Notice>
            «Estimado» é o valor declarado por ti; «real» é a soma das colheitas registadas. Abrange todas as propriedades a que tens acesso.
          </Notice>
        </TabsContent>
      </Tabs>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog?.kind === 'new' && <PlantingDialog farmId={farmId} onDone={() => setDialog(null)} />}
        {dialog?.kind === 'edit' && <PlantingDialog farmId={farmId} planting={dialog.planting} onDone={() => setDialog(null)} />}
        {dialog?.kind === 'activity' && <ActivityDialog planting={dialog.planting} onDone={() => setDialog(null)} />}
        {dialog?.kind === 'harvest' && <HarvestDialog planting={dialog.planting} onDone={() => setDialog(null)} />}
      </Dialog>
    </div>
  );
}
