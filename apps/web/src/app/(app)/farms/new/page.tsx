'use client';
import type { FarmCreateInput } from '@agrogenius/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { FarmForm } from '@/features/farms/farm-form';
import { api } from '@/lib/api';
import { useFarm } from '@/lib/farm-context';

export default function NewFarmPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { setFarmId } = useFarm();
  return (
    <>
      <PageHeader eyebrow="Propriedades" title="Nova propriedade" description="Regista os dados reais da propriedade para receberes recomendações adequadas." />
      <FarmForm
        submitLabel="Registar propriedade"
        onSubmit={async (v: FarmCreateInput) => {
          const farm = await api<{ id: string }>('/farms', { method: 'POST', body: v });
          await qc.invalidateQueries({ queryKey: ['farms'] });
          qc.invalidateQueries({ queryKey: ['dashboard'] });
          setFarmId(farm.id);
          toast.success('Propriedade registada');
          router.push(`/farms/${farm.id}`);
        }}
      />
    </>
  );
}
