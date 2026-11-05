'use client';
import { History } from 'lucide-react';
import { LABELS } from '@agrogenius/shared';
import { Badge, statusTone } from '@/components/ui/badge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { fmtDate } from '@/lib/utils';
import { fmtDuration, useCommands } from './hooks';

export function CommandsTable({ farmId }: { farmId: string }) {
  const q = useCommands(farmId);
  if (q.isLoading) return <Skeleton className="h-48" />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data?.length) return <EmptyState icon={History} title="Sem comandos" description="Os comandos manuais e automáticos (aceites e recusados) aparecem aqui." />;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="px-3 py-2 font-medium">Atuador</th>
            <th className="px-3 py-2 font-medium">Ação</th>
            <th className="px-3 py-2 font-medium">Origem</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium">Razão / aviso</th>
          </tr>
        </thead>
        <tbody>
          {q.data.map((c) => (
            <tr key={c.id} className="border-t align-top">
              <td className="num whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{fmtDate(c.createdAt, { dateStyle: 'short', timeStyle: 'medium' })}</td>
              <td className="px-3 py-2">
                <div className="font-medium">{c.actuator.name}</div>
                <div className="text-xs text-muted-foreground">{c.actuator.device.name}</div>
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {c.action === 'ON' ? 'Ligar' : 'Desligar'}
                {c.durationSec ? <span className="text-xs text-muted-foreground"> · {fmtDuration(c.durationSec)}</span> : null}
              </td>
              <td className="px-3 py-2 text-xs">{c.rule ? `Regra: ${c.rule.name}` : c.issuedBy ? `Manual: ${c.issuedBy.fullName}` : 'Sistema'}</td>
              <td className="px-3 py-2">
                <Badge tone={statusTone(c.status)}>{LABELS.commandStatus[c.status]}</Badge>
              </td>
              <td className="max-w-xs px-3 py-2 text-xs text-muted-foreground">{c.reason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
