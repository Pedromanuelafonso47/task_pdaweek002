'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserMinus, UserPlus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

interface Assignment {
  id: string;
  grantedAt: string;
  technician: { id: string; fullName: string; email: string; phone: string | null };
}

/** O agricultor autoriza técnicos agrícolas a acompanhar a propriedade. */
export function Technicians({ farmId, canEdit }: { farmId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['technicians', farmId], queryFn: () => api<Assignment[]>(`/farms/${farmId}/technicians`) });
  const [email, setEmail] = React.useState('');
  const add = useMutation({
    mutationFn: () => api(`/farms/${farmId}/technicians`, { method: 'POST', body: { technicianEmail: email.trim() } }),
    onSuccess: () => {
      setEmail('');
      toast.success('Técnico autorizado');
      qc.invalidateQueries({ queryKey: ['technicians', farmId] });
    },
  });
  const revoke = useMutation({
    mutationFn: (technicianId: string) => api(`/farms/${farmId}/technicians/${technicianId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Acesso revogado');
      qc.invalidateQueries({ queryKey: ['technicians', farmId] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Técnicos agrícolas autorizados</CardTitle>
        <CardDescription>Podem consultar a propriedade, avaliar o terreno e criar ou validar recomendações. Não podem alterar os teus dados.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.includes('@')) add.mutate();
            }}
          >
            <Input type="email" placeholder="email do técnico" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email do técnico" />
            <Button type="submit" loading={add.isPending} disabled={!email.includes('@')}>
              <UserPlus /> Autorizar
            </Button>
          </form>
        )}
        {q.isLoading ? (
          <Skeleton className="h-16" />
        ) : q.isError ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : !q.data?.length ? (
          <EmptyState title="Nenhum técnico autorizado" className="py-8" />
        ) : (
          <ul className="divide-y">
            {q.data.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{a.technician.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.technician.email}
                    {a.technician.phone ? ` · ${a.technician.phone}` : ''} · desde {fmtDate(a.grantedAt)}
                  </p>
                </div>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => confirm(`Revogar o acesso de ${a.technician.fullName}?`) && revoke.mutate(a.technician.id)}>
                    <UserMinus /> Revogar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
