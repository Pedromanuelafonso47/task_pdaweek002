'use client';
import { LABELS, formatKz } from '@agrogenius/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Download, FileClock, FlaskConical, History, Layers, Map, Pencil, Sprout, Trash2, Users, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { FarmView, type SceneSelection } from '@/components/three';
import { Badge, statusTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FieldsManager } from '@/features/farms/fields-manager';
import { Technicians } from '@/features/farms/technicians';
import { api, download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFarm } from '@/lib/farm-context';
import type { Device, FarmSummary, Field } from '@/lib/types';
import { fmtDate, fmtNum, fmtRelative } from '@/lib/utils';

interface FarmFull extends FarmSummary {
  fields: Field[];
  plantings: {
    id: string;
    areaHa: string;
    status: string;
    season: string | null;
    plantedAt: string | null;
    expectedHarvestAt: string | null;
    estimatedYieldKg: string | null;
    crop: { name: string };
    field: { id: string; name: string } | null;
  }[];
  devices: Device[];
  farmProjects: { id: string; status: string; startedAt: string | null; completedAt: string | null; actualCostKz: string | null; project: { slug: string; title: string; category: string } }[];
  history: { id: string; type: string; summary: string; createdAt: string }[];
}

const FP_STATUS: Record<string, string> = { PLANNED: 'Planeado', IN_PROGRESS: 'Em curso', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' };

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function FarmDetail() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { setFarmId } = useFarm();
  const canEdit = user?.role === 'FARMER' || user?.role === 'ADMIN';
  const q = useQuery({ queryKey: ['farm', id], queryFn: () => api<FarmFull>(`/farms/${id}`) });
  const devices = useQuery({ queryKey: ['devices', id], queryFn: () => api<Device[]>(`/iot/devices?farmId=${id}`) });
  const [sel, setSel] = React.useState<SceneSelection>(null);
  const [tab, setTab] = React.useState(params.get('tab') ?? 'overview');

  React.useEffect(() => setFarmId(id), [id, setFarmId]);

  const analyse = useMutation({
    mutationFn: () => api(`/farms/${id}/recommendations/generate`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Análise concluída');
      qc.invalidateQueries({ queryKey: ['recommendations'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.push('/recommendations');
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/farms/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('Propriedade removida');
      await qc.invalidateQueries({ queryKey: ['farms'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.replace('/farms');
    },
  });

  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const f = q.data!;
  const center: [number, number] = [f.longitude ?? 17.5, f.latitude ?? -12.3];
  const devs = devices.data ?? f.devices;

  return (
    <>
      <PageHeader
        eyebrow={`${f.province}${f.municipality ? ` · ${f.municipality}` : ''}`}
        title={f.name}
        description={`${fmtNum(f.totalAreaHa)} ha · ${fmtNum(f.cultivatedAreaHa)} ha cultivados · registada em ${fmtDate(f.createdAt)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => download(`/reports/farm?farmId=${id}`, 'relatorio-propriedade.pdf').catch((e) => toast.error(e.message))}>
              <Download /> Relatório
            </Button>
            <Button onClick={() => analyse.mutate()} loading={analyse.isPending}>
              <Wand2 /> Analisar propriedade
            </Button>
            {canEdit && (
              <>
                <Button asChild variant="outline">
                  <Link href={`/farms/${id}/edit`}>
                    <Pencil /> Editar
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover propriedade"
                  onClick={() => confirm(`Remover "${f.name}"? O histórico financeiro e de auditoria é mantido.`) && remove.mutate()}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </>
        }
      />
      {f.isDemo && (
        <Notice tone="demo" className="mb-4">
          <b>Dados de demonstração</b> — esta propriedade não corresponde a uma exploração real.
        </Notice>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">
            <Layers /> Visão geral
          </TabsTrigger>
          <TabsTrigger value="map">
            <Map /> Mapa & zonas
          </TabsTrigger>
          <TabsTrigger value="crops">
            <Sprout /> Culturas
          </TabsTrigger>
          <TabsTrigger value="devices">
            <Cpu /> Dispositivos
          </TabsTrigger>
          <TabsTrigger value="projects">
            <FlaskConical /> Projetos
          </TabsTrigger>
          <TabsTrigger value="history">
            <History /> Histórico
          </TabsTrigger>
          <TabsTrigger value="technicians">
            <Users /> Técnicos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <FarmView boundary={f.boundary} totalAreaHa={Number(f.totalAreaHa)} fields={f.fields} devices={devs} selection={sel} onSelect={setSel} />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Terreno e água</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <Info label="Coordenadas" value={f.latitude !== null ? `${f.latitude?.toFixed(5)}, ${f.longitude?.toFixed(5)}` : 'não registadas'} />
                  <Info label="Terreno" value={LABELS.terrain[f.terrainType as keyof typeof LABELS.terrain]} />
                  <Info label="Solo" value={LABELS.soil[f.soilType as keyof typeof LABELS.soil]} />
                  <Info label="Água" value={LABELS.waterAvailability[f.waterAvailability as keyof typeof LABELS.waterAvailability]} />
                  <Info label="Fonte" value={LABELS.waterSource[f.waterSource as keyof typeof LABELS.waterSource]} />
                  <Info label="Rega" value={LABELS.irrigation[f.irrigationSystem as keyof typeof LABELS.irrigation]} />
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Infraestrutura</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <Info label="Eletricidade" value={f.hasElectricity ? 'Sim' : 'Não'} />
                  <Info label="Internet" value={LABELS.connectivity[f.internet as keyof typeof LABELS.connectivity]} />
                  <Info label="Bombas" value={f.hasPumps ? 'Sim' : 'Não'} />
                  <Info label="Sensores" value={f.hasSensors ? 'Sim' : 'Não'} />
                  <Info label="Máquinas" value={f.hasMachinery ? 'Sim' : 'Não'} />
                  <Info label="Nível tecnológico" value={LABELS.techLevel[f.techLevel as keyof typeof LABELS.techLevel]} />
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Objetivos e problemas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {f.goals.length ? f.goals.map((g) => <Badge key={g} tone="green">{LABELS.goal[g as keyof typeof LABELS.goal] ?? g}</Badge>) : <span className="text-xs text-muted-foreground">Sem objetivos</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {f.problems.length ? f.problems.map((p) => <Badge key={p} tone="amber">{LABELS.problem[p as keyof typeof LABELS.problem] ?? p}</Badge>) : <span className="text-xs text-muted-foreground">Sem problemas declarados</span>}
                </div>
                <p className="text-sm">
                  Orçamento: <b>{f.budgetKz ? formatKz(f.budgetKz) : 'não indicado'}</b>
                </p>
                {f.otherGoal && <p className="text-xs text-muted-foreground">{f.otherGoal}</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="map">
          <FieldsManager farmId={id} fields={f.fields} devices={devs} boundary={f.boundary} center={center} cultivatedAreaHa={Number(f.cultivatedAreaHa)} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="crops">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Plantações</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href="/production">Gerir em Produção</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {f.plantings.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-4 font-medium">Cultura</th>
                        <th className="py-2 pr-4 font-medium">Zona</th>
                        <th className="py-2 pr-4 font-medium">Área</th>
                        <th className="py-2 pr-4 font-medium">Estado</th>
                        <th className="py-2 pr-4 font-medium">Plantação</th>
                        <th className="py-2 font-medium">Colheita prevista</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {f.plantings.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 pr-4 font-medium">{p.crop.name}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{p.field?.name ?? '—'}</td>
                          <td className="num py-2 pr-4">{fmtNum(p.areaHa, 2)} ha</td>
                          <td className="py-2 pr-4">
                            <Badge tone={statusTone(p.status)}>{LABELS.plantingStatus[p.status as keyof typeof LABELS.plantingStatus]}</Badge>
                          </td>
                          <td className="py-2 pr-4">{fmtDate(p.plantedAt)}</td>
                          <td className="py-2">{fmtDate(p.expectedHarvestAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={Sprout} title="Sem plantações" description="Regista as plantações em Produção." className="py-8" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Dispositivos IoT</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href="/iot">Abrir AgroControl</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {devs.length ? (
                <ul className="divide-y">
                  {devs.map((d) => (
                    <li key={d.id}>
                      <Link href={`/iot/devices/${d.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                        <div>
                          <p className="text-sm font-medium">{d.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {LABELS.deviceType[d.type as keyof typeof LABELS.deviceType]} · {d.sensors.length} sensores · {d.actuators.length} atuadores · visto {fmtRelative(d.lastSeenAt)}
                          </p>
                        </div>
                        <Badge tone={statusTone(d.status)}>{LABELS.deviceStatus[d.status]}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Cpu} title="Sem dispositivos" description="Regista sensores e controladores no AgroControl." className="py-8" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle>Projetos associados</CardTitle>
            </CardHeader>
            <CardContent>
              {f.farmProjects.length ? (
                <ul className="divide-y">
                  {f.farmProjects.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div>
                        <Link href={`/lab/${p.project.slug}`} className="text-sm font-medium hover:text-primary">
                          {p.project.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {LABELS.projectCategory[p.project.category as keyof typeof LABELS.projectCategory]}
                          {p.completedAt ? ` · concluído ${fmtDate(p.completedAt)}` : p.startedAt ? ` · iniciado ${fmtDate(p.startedAt)}` : ''}
                          {p.actualCostKz ? ` · custo real ${formatKz(p.actualCostKz)}` : ''}
                        </p>
                      </div>
                      <Badge tone={p.status === 'COMPLETED' ? 'solid' : p.status === 'CANCELLED' ? 'neutral' : 'blue'}>{FP_STATUS[p.status] ?? p.status}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={FlaskConical} title="Nenhum projeto associado" description="Aceita uma recomendação para a associar a esta propriedade." className="py-8" action={<Button asChild size="sm"><Link href="/recommendations">Ver recomendações</Link></Button>} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              {f.history.length ? (
                <ol className="relative space-y-4 border-l pl-5">
                  {f.history.map((h) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[25px] top-1 grid size-3 place-items-center rounded-full border-2 border-background bg-primary" />
                      <p className="text-sm">{h.summary}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(h.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState icon={FileClock} title="Sem eventos" className="py-8" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technicians">
          <Technicians farmId={id} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function FarmDetailPage() {
  return (
    <React.Suspense fallback={<PageLoader />}>
      <FarmDetail />
    </React.Suspense>
  );
}
