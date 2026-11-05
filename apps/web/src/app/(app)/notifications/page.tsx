'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, AlertTriangle, Bell, CheckCheck, Info, Mail, MessageCircle, Smartphone } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/feedback';
import { Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { NOTIFICATION_TYPES, SEVERITY_LABELS } from '@/features/notifications/labels';
import { api } from '@/lib/api';
import { useFarm } from '@/lib/farm-context';
import { useRealtime } from '@/lib/realtime';
import type { Notification } from '@/lib/types';
import { cn, fmtDate, fmtRelative } from '@/lib/utils';

const SEV_ICON = { INFO: Info, WARNING: AlertTriangle, CRITICAL: AlertOctagon } as const;
const SEV_STYLE = { INFO: 'text-primary bg-primary/10', WARNING: 'text-warning bg-warning/10', CRITICAL: 'text-destructive bg-destructive/10' } as const;

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { farms } = useFarm();
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [severity, setSeverity] = React.useState('');
  const [type, setType] = React.useState('');

  const q = useQuery({
    queryKey: ['notifications', 'page', unreadOnly],
    queryFn: () => api<Notification[]>(`/notifications${unreadOnly ? '?unread=true' : ''}`),
  });
  useRealtime('notification', () => qc.invalidateQueries({ queryKey: ['notifications'] }));

  const markOne = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAll = useMutation({
    mutationFn: () => api<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
    onSuccess: (r) => {
      toast.success(`${r.updated} notificação(ões) marcadas como lidas`);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const farmName = (id: string | null) => farms.find((f) => f.id === id)?.name;
  const list = (q.data ?? []).filter((n) => (!severity || n.severity === severity) && (!type || n.type === type));
  const unread = (q.data ?? []).filter((n) => !n.readAt).length;
  const typesPresent = [...new Set((q.data ?? []).map((n) => n.type))];

  return (
    <div>
      <PageHeader
        eyebrow="Centro de alertas"
        title="Notificações"
        description="Alertas de sensores, rega, reservatórios, colheitas e recomendações. Atualizadas em tempo real."
        actions={
          <Button variant="outline" disabled={!unread} loading={markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck /> Marcar todas como lidas
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border p-0.5">
              {[
                [false, 'Todas'],
                [true, `Por ler (${unread})`],
              ].map(([v, l]) => (
                <button
                  key={String(v)}
                  onClick={() => setUnreadOnly(v as boolean)}
                  aria-pressed={unreadOnly === v}
                  className={cn('rounded-sm px-3 py-1.5 text-sm', unreadOnly === v ? 'bg-primary/15 font-medium' : 'text-muted-foreground hover:text-foreground')}
                >
                  {l as string}
                </button>
              ))}
            </div>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-9 w-auto" aria-label="Filtrar por severidade">
              <option value="">Todas as severidades</option>
              {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select value={type} onChange={(e) => setType(e.target.value)} className="h-9 w-auto" aria-label="Filtrar por tipo">
              <option value="">Todos os tipos</option>
              {typesPresent.map((t) => (
                <option key={t} value={t}>
                  {NOTIFICATION_TYPES[t] ?? t}
                </option>
              ))}
            </Select>
          </div>

          {q.isLoading ? (
            <PageLoader />
          ) : q.error ? (
            <ErrorState error={q.error} retry={() => q.refetch()} />
          ) : !list.length ? (
            <EmptyState
              icon={Bell}
              title={q.data?.length ? 'Nenhuma notificação com estes filtros' : 'Sem notificações'}
              description="Os alertas aparecem quando sensores saem dos limites, dispositivos perdem ligação ou há novas recomendações."
            />
          ) : (
            <Card className="divide-y">
              {list.map((n) => {
                const Icon = SEV_ICON[n.severity];
                return (
                  <div key={n.id} className={cn('flex gap-3 p-4', !n.readAt && 'bg-primary/[0.03]')}>
                    <div className={cn('grid size-9 shrink-0 place-items-center rounded-full', SEV_STYLE[n.severity])}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{n.title}</span>
                        {!n.readAt && <span className="size-2 rounded-full bg-primary" aria-label="Por ler" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{n.body}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Badge>{NOTIFICATION_TYPES[n.type] ?? n.type}</Badge>
                        <Badge>{SEVERITY_LABELS[n.severity]}</Badge>
                        {farmName(n.farmId) && <span>{farmName(n.farmId)}</span>}
                        <span title={fmtDate(n.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}>· {fmtRelative(n.createdAt)}</span>
                        {n.type === 'NEW_RECOMMENDATION' && (
                          <Link href="/recommendations" className="text-primary hover:underline">
                            Ver recomendações
                          </Link>
                        )}
                        {['LOW_MOISTURE', 'HIGH_TEMP', 'SENSOR_OFFLINE', 'IRRIGATION_FAILURE', 'LOW_RESERVOIR', 'THRESHOLD'].includes(n.type) && (
                          <Link href="/iot" className="text-primary hover:underline">
                            Abrir AgroControl
                          </Link>
                        )}
                      </div>
                    </div>
                    {!n.readAt && (
                      <Button size="sm" variant="ghost" className="shrink-0" loading={markOne.isPending && markOne.variables === n.id} onClick={() => markOne.mutate(n.id)}>
                        Marcar lida
                      </Button>
                    )}
                  </div>
                );
              })}
            </Card>
          )}
        </div>

        <aside>
          <Card className="p-4">
            <h3 className="font-display text-sm font-semibold">Canais de entrega</h3>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Bell className="mt-0.5 size-4 text-primary" />
                <span>
                  Aplicação (tempo real) <Badge tone="green">ativo</Badge>
                </span>
              </li>
              {[
                [Smartphone, 'SMS'],
                [MessageCircle, 'WhatsApp'],
                [Mail, 'Email'],
              ].map(([Icon, l]) => {
                const I = Icon as typeof Bell;
                return (
                  <li key={l as string} className="flex items-start gap-2 text-muted-foreground">
                    <I className="mt-0.5 size-4" />
                    <span>
                      {l as string} <Badge>em preparação</Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              A arquitetura já suporta canais adicionais, mas o envio por SMS, WhatsApp e email ainda não está ligado a nenhum fornecedor. Por agora, os alertas só chegam pela aplicação.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
