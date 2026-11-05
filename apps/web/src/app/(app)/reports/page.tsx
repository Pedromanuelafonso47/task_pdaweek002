'use client';
import { Cpu, Download, Droplets, FileText, Hammer, Map, Sprout, Wallet, Wand2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, Notice, PageLoader } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { download } from '@/lib/api';
import { useFarm } from '@/lib/farm-context';

const REPORTS = [
  { type: 'farm', title: 'Relatório da propriedade', desc: 'Identificação, solo, água, zonas, culturas, dispositivos e projetos.', icon: Map, period: false },
  { type: 'production', title: 'Relatório de produção', desc: 'Produtividade por plantação (estimado vs real) e atividades de campo.', icon: Sprout, period: true },
  { type: 'finance', title: 'Relatório financeiro', desc: 'Receitas, despesas por categoria, resultado por cultura e evolução mensal.', icon: Wallet, period: true },
  { type: 'sensors', title: 'Relatório de sensores', desc: 'Estatísticas de todas as leituras (média, mínimo, máximo) por sensor.', icon: Cpu, period: true },
  { type: 'water', title: 'Consumo de água', desc: 'Sensores de caudal, nível e humidade, e ativações de rega confirmadas.', icon: Droplets, period: true },
  { type: 'recommendations', title: 'Recomendações IoT', desc: 'Projetos recomendados, razões, materiais dimensionados, faseamento e ROI.', icon: Wand2, period: false },
  { type: 'projects', title: 'Projetos implementados', desc: 'Estado dos projetos, custo estimado vs real e investimento IoT.', icon: Hammer, period: true },
] as const;

export default function ReportsPage() {
  const { farm, farmId, isLoading } = useFarm();
  const [from, setFrom] = React.useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = React.useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = React.useState<string | null>(null);

  if (isLoading) return <PageLoader />;
  if (!farmId || !farm) {
    return (
      <EmptyState
        icon={FileText}
        title="Sem propriedade"
        description="Os relatórios são gerados por propriedade."
        action={
          <Button asChild>
            <Link href="/farms/new">Registar propriedade</Link>
          </Button>
        }
      />
    );
  }

  const generate = async (type: string) => {
    if (from && to && from > to) return toast.error('A data inicial é posterior à final.');
    setBusy(type);
    try {
      const qs = new URLSearchParams({ farmId, from: new Date(from).toISOString(), to: new Date(`${to}T23:59:59`).toISOString() });
      await download(`/reports/${type}?${qs}`, `agrogenius-${type}.pdf`);
      toast.success('Relatório gerado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o relatório');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={farm.name}
        title="Relatórios"
        description="Documentos PDF com a identidade AGROGENIUS, gerados a partir dos dados registados. Úteis para técnicos, cooperativas e pedidos de financiamento."
      />
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_2fr] sm:items-end">
          <Field label="Desde">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Até">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <p className="text-xs text-muted-foreground">O período aplica-se aos relatórios de produção, finanças, sensores, água e projetos.</p>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.type} className="flex flex-col p-5">
            <div className="mb-3 grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
              <r.icon className="size-5" />
            </div>
            <h3 className="font-display font-semibold">{r.title}</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{r.desc}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{r.period ? 'Usa o período' : 'Estado atual'}</span>
              <Button size="sm" onClick={() => generate(r.type)} loading={busy === r.type} disabled={!!busy && busy !== r.type}>
                <Download /> PDF
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <Notice>Os relatórios distinguem valores registados, estimativas e dados de demonstração. Requerem ligação à internet para serem gerados.</Notice>
    </div>
  );
}
