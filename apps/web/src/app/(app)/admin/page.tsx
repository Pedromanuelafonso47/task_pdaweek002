'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Cpu, Lock, Map, Search, ShieldCheck, Users, Wand2 } from 'lucide-react';
import * as React from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { LABELS } from '@agrogenius/shared';
import { Badge, statusTone } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, PageLoader, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { PageHeader, Stat } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TechnicianDialog } from '@/features/admin/technician-dialog';
import { ChartOrTable, ChartTooltip, VIZ, VizRoot, axisProps } from '@/features/charts/viz';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtNum, fmtRelative } from '@/lib/utils';

interface Stats {
  users: number;
  farms: number;
  totalAreaHa: number;
  cultivatedAreaHa: number;
  devices: Record<string, number>;
  readings24h: number;
  recommendations: Record<string, number>;
  byProvince: { province: string; farms: number; areaHa: number }[];
  byRole: Record<string, number>;
}
interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: 'FARMER' | 'TECHNICIAN' | 'ADMIN';
  isActive: boolean;
  province: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  organization: { name: string; type: string };
  _count: { ownedFarms: number };
}
interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  user: { email: string } | null;
}

function Overview() {
  const { data: s, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api<Stats>('/admin/stats') });
  if (isLoading) return <PageLoader />;
  if (error || !s) return <ErrorState error={error} retry={refetch} />;
  const devTotal = Object.values(s.devices).reduce((a, b) => a + b, 0);
  const recTotal = Object.values(s.recommendations).reduce((a, b) => a + b, 0);
  const provinces = [...s.byProvince].sort((a, b) => b.farms - a.farms);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Utilizadores" value={s.users} icon={Users} sub={Object.entries(s.byRole).map(([r, n]) => `${n} ${LABELS.role[r as keyof typeof LABELS.role]?.toLowerCase()}`).join(' · ')} />
        <Stat label="Propriedades" value={s.farms} icon={Map} sub={`${fmtNum(s.totalAreaHa)} ha · ${fmtNum(s.cultivatedAreaHa)} ha cultivados`} />
        <Stat label="Dispositivos IoT" value={devTotal} icon={Cpu} sub={`${s.devices.ONLINE ?? 0} online · ${fmtNum(s.readings24h, 0)} leituras/24h`} />
        <Stat label="Recomendações" value={recTotal} icon={Wand2} sub={`${s.recommendations.ACCEPTED ?? 0} aceites · ${s.recommendations.IMPLEMENTED ?? 0} implementadas`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Propriedades por província</CardTitle>
            <CardDescription>Número de propriedades registadas</CardDescription>
          </CardHeader>
          <CardContent>
            {!provinces.length ? (
              <p className="text-sm text-muted-foreground">Ainda não há propriedades.</p>
            ) : (
              <VizRoot>
                <ChartOrTable
                  chart={
                    <div style={{ height: Math.max(140, provinces.length * 32) }}>
                      <ResponsiveContainer>
                        <BarChart data={provinces} layout="vertical" margin={{ left: 0, right: 32 }}>
                          <XAxis type="number" hide allowDecimals={false} />
                          <YAxis type="category" dataKey="province" {...axisProps} width={110} />
                          <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} content={<ChartTooltip format={(v) => `${v} propriedade(s)`} />} />
                          <Bar dataKey="farms" name="Propriedades" fill={VIZ.s1} radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  }
                  table={
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 font-medium">Província</th>
                          <th className="py-2 text-right font-medium">Propriedades</th>
                          <th className="py-2 text-right font-medium">Área (ha)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {provinces.map((p) => (
                          <tr key={p.province} className="border-b last:border-0">
                            <td className="py-2">{p.province}</td>
                            <td className="num py-2 text-right">{p.farms}</td>
                            <td className="num py-2 text-right">{fmtNum(p.areaHa)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                />
              </VizRoot>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Estado dos dispositivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!devTotal && <p className="text-sm text-muted-foreground">Sem dispositivos registados.</p>}
            {Object.entries(s.devices).map(([st, n]) => (
              <div key={st} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <Badge tone={statusTone(st)}>{LABELS.deviceStatus[st as keyof typeof LABELS.deviceStatus] ?? st}</Badge>
                  <span className="num">{n}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(n / devTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UsersTab() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const users = useQuery({ queryKey: ['admin', 'users', debounced], queryFn: () => api<AdminUser[]>(`/admin/users${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`) });
  const upd = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: AdminUser['role']; isActive?: boolean }) => api(`/admin/users/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success('Utilizador atualizado');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
  return (
    <Card>
      <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar nome ou email" className="pl-9" />
        </div>
        <TechnicianDialog />
      </CardHeader>
      <CardContent className="p-0">
        {users.error ? (
          <div className="p-5">
            <ErrorState error={users.error} retry={users.refetch} />
          </div>
        ) : users.isLoading ? (
          <div className="p-5">
            <Skeleton className="h-48" />
          </div>
        ) : !users.data?.length ? (
          <p className="p-5 text-sm text-muted-foreground">Nenhum utilizador encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-y">
                  <th className="px-5 py-2 font-medium">Utilizador</th>
                  <th className="py-2 font-medium">Organização</th>
                  <th className="py-2 font-medium">Propriedades</th>
                  <th className="py-2 font-medium">Último acesso</th>
                  <th className="py-2 font-medium">Perfil</th>
                  <th className="px-5 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-5 py-2.5">
                        <div className="font-medium">{u.fullName}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="py-2.5 text-muted-foreground">{u.organization.name}</td>
                      <td className="num py-2.5">{u._count.ownedFarms}</td>
                      <td className="py-2.5 text-muted-foreground">{u.lastLoginAt ? fmtRelative(u.lastLoginAt) : 'nunca'}</td>
                      <td className="py-2.5">
                        <Select
                          value={u.role}
                          disabled={self || upd.isPending}
                          onChange={(e) => upd.mutate({ id: u.id, role: e.target.value as AdminUser['role'] })}
                          className="h-8 w-40 text-xs"
                          aria-label="Perfil de acesso"
                        >
                          {(['FARMER', 'TECHNICIAN', 'ADMIN'] as const).map((r) => (
                            <option key={r} value={r}>
                              {LABELS.role[r]}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-5 py-2.5">
                        <button
                          disabled={self || upd.isPending}
                          onClick={() => upd.mutate({ id: u.id, isActive: !u.isActive })}
                          className="disabled:opacity-50"
                          title={self ? 'Não podes desativar a tua própria conta' : u.isActive ? 'Desativar (revoga sessões)' : 'Reativar'}
                        >
                          <Badge tone={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Ativo' : 'Desativado'}</Badge>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AuditTab() {
  const [entity, setEntity] = React.useState('');
  const audit = useQuery({ queryKey: ['admin', 'audit', entity], queryFn: () => api<AuditRow[]>(`/admin/audit${entity ? `?entity=${entity}` : ''}`) });
  const entities = ['farms', 'iot', 'finance', 'plantings', 'recommendations', 'onboarding', 'admin', 'auth'];
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Registo de auditoria</CardTitle>
        <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="h-8 w-44 text-xs" aria-label="Entidade">
          <option value="">Todas as entidades</option>
          {entities.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        {audit.error ? (
          <div className="p-5">
            <ErrorState error={audit.error} retry={audit.refetch} />
          </div>
        ) : audit.isLoading ? (
          <div className="p-5">
            <Skeleton className="h-48" />
          </div>
        ) : !audit.data?.length ? (
          <p className="p-5 text-sm text-muted-foreground">Sem registos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-y">
                  <th className="px-5 py-2 font-medium">Quando</th>
                  <th className="py-2 font-medium">Utilizador</th>
                  <th className="py-2 font-medium">Ação</th>
                  <th className="py-2 font-medium">Registo</th>
                  <th className="px-5 py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-5 py-2" title={fmtDate(a.createdAt, { dateStyle: 'medium', timeStyle: 'medium' })}>
                      {fmtRelative(a.createdAt)}
                    </td>
                    <td className="py-2 text-muted-foreground">{a.user?.email ?? '—'}</td>
                    <td className="py-2 font-mono text-xs">{a.action}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">{a.entityId ?? '—'}</td>
                    <td className="px-5 py-2 font-mono text-xs text-muted-foreground">{a.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') {
    return <EmptyState icon={Lock} title="Acesso reservado a administradores" description="Não tens permissão para ver esta área." />;
  }
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Plataforma" title="Administração" description="Estatísticas gerais, gestão de utilizadores e permissões, e registo de auditoria." />
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <Activity /> Visão geral
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users /> Utilizadores
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ShieldCheck /> Auditoria
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <Overview />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
