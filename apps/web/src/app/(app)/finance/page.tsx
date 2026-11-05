'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Pencil, Plus, Receipt, Scale, Trash2, Wallet } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { LABELS, formatKz } from '@agrogenius/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Notice, PageLoader, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { PageHeader, Stat } from '@/components/ui/page-header';
import { CategoryChart, MonthlyChart } from '@/features/finance/charts';
import { TransactionDialog, type Transaction } from '@/features/finance/transaction-dialog';
import { api } from '@/lib/api';
import { useFarm } from '@/lib/farm-context';
import { cn, fmtDate, fmtNum } from '@/lib/utils';

interface Summary {
  currency: string;
  income: number;
  expense: number;
  balance: number;
  transactions: number;
  byCategory: { category: string; amount: number }[];
  byMonth: { month: string; income: number; expense: number }[];
  byCrop: { crop: string; income: number; expense: number; areaHa: number; profit: number; costPerHa: number | null }[];
  costPerHa: { farmId: string; farm: string; expense: number; cultivatedAreaHa: number; costPerHa: number | null }[];
}

const yearStart = () => `${new Date().getFullYear()}-01-01`;

export default function FinancePage() {
  const { farms, farmId: activeFarm, isLoading: farmsLoading } = useFarm();
  const qc = useQueryClient();
  const [farmFilter, setFarmFilter] = React.useState<string>('');
  const [type, setType] = React.useState('');
  const [from, setFrom] = React.useState(yearStart());
  const [to, setTo] = React.useState('');
  const [dialog, setDialog] = React.useState<{ tx?: Transaction } | null>(null);

  const qs = new URLSearchParams();
  if (farmFilter) qs.set('farmId', farmFilter);
  if (from) qs.set('from', new Date(from).toISOString());
  if (to) qs.set('to', new Date(`${to}T23:59:59`).toISOString());
  const qsType = new URLSearchParams(qs);
  if (type) qsType.set('type', type);

  const summary = useQuery({ queryKey: ['finance', 'summary', qs.toString()], queryFn: () => api<Summary>(`/finance/summary?${qs}`) });
  const txs = useQuery({ queryKey: ['finance', 'tx', qsType.toString()], queryFn: () => api<Transaction[]>(`/finance/transactions?${qsType}`) });

  const del = useMutation({
    mutationFn: (id: string) => api(`/finance/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Transação removida');
      qc.invalidateQueries({ queryKey: ['finance'] });
    },
  });

  if (farmsLoading) return <PageLoader />;
  const s = summary.data;
  const foreign = (txs.data ?? []).filter((t) => t.currency !== 'AOA');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestão financeira"
        title="Finanças agrícolas"
        description="Despesas, receitas, lucro por cultura e custo de produção por hectare — calculados a partir dos teus registos. Moeda principal: Kwanza (Kz)."
        actions={
          <Button onClick={() => setDialog({})}>
            <Plus /> Nova transação
          </Button>
        }
      />

      <div className="grid gap-2 rounded-lg border bg-card/50 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={farmFilter} onChange={(e) => setFarmFilter(e.target.value)} aria-label="Propriedade">
          <option value="">Todas as propriedades</option>
          {farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">
          <option value="">Receitas e despesas</option>
          <option value="INCOME">Só receitas</option>
          <option value="EXPENSE">Só despesas</option>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
      </div>

      {summary.error ? (
        <ErrorState error={summary.error} retry={summary.refetch} />
      ) : !s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Receitas" value={formatKz(s.income)} icon={ArrowUpRight} />
            <Stat label="Despesas" value={formatKz(s.expense)} icon={ArrowDownRight} />
            <Stat
              label="Resultado"
              value={<span className={s.balance < 0 ? 'text-destructive' : ''}>{formatKz(s.balance)}</span>}
              icon={Scale}
              sub={s.income > 0 ? `Margem ${Math.round((s.balance / s.income) * 100)}%` : 'Sem receitas no período'}
            />
            <Stat label="Transações" value={s.transactions} icon={Receipt} />
          </div>

          {s.transactions === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Sem transações no período"
              description="Regista despesas (sementes, fertilizantes, mão de obra, rega) e receitas de vendas. Estes dados também permitem estimar o retorno dos projetos IoT."
              action={<Button onClick={() => setDialog({})}>Registar primeira transação</Button>}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Evolução mensal</CardTitle>
                  <CardDescription>Receitas e despesas registadas por mês</CardDescription>
                </CardHeader>
                <CardContent>{s.byMonth.length ? <MonthlyChart data={s.byMonth} /> : null}</CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Despesas por categoria</CardTitle>
                  <CardDescription>Percentagem do total de despesas</CardDescription>
                </CardHeader>
                <CardContent>{s.byCategory.length ? <CategoryChart data={s.byCategory} /> : <p className="text-sm text-muted-foreground">Sem despesas.</p>}</CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Lucro por cultura</CardTitle>
                  <CardDescription>Apenas transações associadas a uma plantação</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {!s.byCrop.length ? (
                    <p className="text-sm text-muted-foreground">Associa despesas e vendas a plantações (em Produção: atividades com custo e colheitas com venda) para ver o resultado por cultura.</p>
                  ) : (
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 font-medium">Cultura</th>
                          <th className="py-2 text-right font-medium">Receitas</th>
                          <th className="py-2 text-right font-medium">Despesas</th>
                          <th className="py-2 text-right font-medium">Lucro</th>
                          <th className="py-2 text-right font-medium">Custo/ha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.byCrop.map((c) => (
                          <tr key={c.crop} className="border-b last:border-0">
                            <td className="py-2 font-medium">{c.crop}</td>
                            <td className="num py-2 text-right">{formatKz(c.income)}</td>
                            <td className="num py-2 text-right">{formatKz(c.expense)}</td>
                            <td className={cn('num py-2 text-right font-semibold', c.profit < 0 && 'text-destructive')}>{formatKz(c.profit)}</td>
                            <td className="num py-2 text-right text-muted-foreground">{c.costPerHa !== null ? formatKz(c.costPerHa) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Custo de produção por hectare</CardTitle>
                  <CardDescription>Despesas ÷ área cultivada</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!s.costPerHa.length && <p className="text-sm text-muted-foreground">Sem despesas associadas a propriedades.</p>}
                  {s.costPerHa.map((c) => (
                    <div key={c.farmId} className="flex items-baseline justify-between gap-3 border-b pb-3 last:border-0">
                      <div>
                        <div className="text-sm font-medium">{c.farm}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatKz(c.expense)} · {fmtNum(c.cultivatedAreaHa, 2)} ha
                        </div>
                      </div>
                      <div className="num font-display text-lg font-semibold">{c.costPerHa !== null ? `${formatKz(c.costPerHa)}/ha` : '—'}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {foreign.length > 0 && (
        <Notice tone="warn">
          Existem {foreign.length} transação(ões) noutra moeda ({[...new Set(foreign.map((t) => t.currency))].join(', ')}). Os totais acima somam valores nominais sem conversão
          cambial.
        </Notice>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {txs.error ? (
            <div className="p-5">
              <ErrorState error={txs.error} retry={txs.refetch} />
            </div>
          ) : txs.isLoading ? (
            <div className="p-5">
              <Skeleton className="h-40" />
            </div>
          ) : !txs.data?.length ? (
            <p className="p-5 text-sm text-muted-foreground">Sem transações para os filtros escolhidos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-5 py-2 font-medium">Data</th>
                    <th className="py-2 font-medium">Categoria</th>
                    <th className="py-2 font-medium">Descrição</th>
                    <th className="py-2 font-medium">Propriedade / cultura</th>
                    <th className="py-2 text-right font-medium">Valor</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {txs.data.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="whitespace-nowrap px-5 py-2.5">{fmtDate(t.date)}</td>
                      <td className="py-2.5">
                        <Badge tone={t.type === 'INCOME' ? 'green' : 'neutral'}>{LABELS.transactionCategory[t.category]}</Badge>
                      </td>
                      <td className="max-w-[220px] truncate py-2.5 text-muted-foreground">{t.description ?? '—'}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {t.farm?.name ?? 'Geral'}
                        {t.planting ? ` · ${t.planting.crop.name}` : ''}
                      </td>
                      <td className={cn('num whitespace-nowrap py-2.5 text-right font-medium', t.type === 'INCOME' ? 'text-primary' : '')}>
                        {t.type === 'INCOME' ? '+' : '−'}
                        {t.currency === 'AOA' ? formatKz(t.amount) : `${fmtNum(t.amount, 2)} ${t.currency}`}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right">
                        <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setDialog({ tx: t })}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => confirm('Remover esta transação?') && del.mutate(t.id)}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog && <TransactionDialog farms={farms} defaultFarmId={activeFarm} tx={dialog.tx} onDone={() => setDialog(null)} />}
      </Dialog>
    </div>
  );
}
