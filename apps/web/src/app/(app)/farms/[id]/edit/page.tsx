'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ErrorState, PageLoader } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { FarmForm, farmToForm } from '@/features/farms/farm-form';
import { api } from '@/lib/api';
import type { FarmSummary } from '@/lib/types';

export default function EditFarmPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery({ queryKey: ['farm', id], queryFn: () => api<FarmSummary>(`/farms/${id}`) });
  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return (
    <>
      <PageHeader eyebrow="Propriedades" title={`Editar ${q.data!.name}`} />
      <FarmForm
        initial={farmToForm(q.data!)}
        submitLabel="Guardar alterações"
        onSubmit={async (v) => {
          await api(`/farms/${id}`, { method: 'PATCH', body: v });
          await Promise.all([qc.invalidateQueries({ queryKey: ['farms'] }), qc.invalidateQueries({ queryKey: ['farm', id] }), qc.invalidateQueries({ queryKey: ['dashboard'] })]);
          toast.success('Propriedade atualizada. Volta a analisar para atualizar as recomendações.');
          router.push(`/farms/${id}`);
        }}
      />
    </>
  );
}
