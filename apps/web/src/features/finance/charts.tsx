'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LABELS, formatKz } from '@agrogenius/shared';
import { ChartOrTable, ChartTooltip, Legend, VIZ, VizRoot, axisProps } from '@/features/charts/viz';

const compact = (v: number) => new Intl.NumberFormat('pt-AO', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
const monthLabel = (m: string) => new Intl.DateTimeFormat('pt-AO', { month: 'short', year: '2-digit' }).format(new Date(`${m}-01T12:00:00`));

export function MonthlyChart({ data }: { data: { month: string; income: number; expense: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <VizRoot>
      <ChartOrTable
        chart={
          <div className="space-y-3">
            <Legend items={[{ label: 'Receitas', color: VIZ.s1 }, { label: 'Despesas', color: VIZ.s2 }]} />
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={rows} barGap={2} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke={VIZ.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} width={48} tickFormatter={compact} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} content={<ChartTooltip format={formatKz} />} />
                  <Bar dataKey="income" name="Receitas" fill={VIZ.s1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expense" name="Despesas" fill={VIZ.s2} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        }
        table={
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 font-medium">Mês</th>
                <th className="py-2 text-right font-medium">Receitas</th>
                <th className="py-2 text-right font-medium">Despesas</th>
                <th className="py-2 text-right font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-b last:border-0">
                  <td className="py-2">{r.label}</td>
                  <td className="num py-2 text-right">{formatKz(r.income)}</td>
                  <td className="num py-2 text-right">{formatKz(r.expense)}</td>
                  <td className="num py-2 text-right font-medium">{formatKz(r.income - r.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />
    </VizRoot>
  );
}

export function CategoryChart({ data }: { data: { category: string; amount: number }[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  const rows = data.map((d) => ({ ...d, label: LABELS.transactionCategory[d.category as keyof typeof LABELS.transactionCategory] ?? d.category }));
  return (
    <VizRoot>
      <ChartOrTable
        chart={
          <div style={{ height: Math.max(140, rows.length * 34) }}>
            <ResponsiveContainer>
              <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 56, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" {...axisProps} width={128} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} content={<ChartTooltip format={formatKz} />} />
                <Bar
                  dataKey="amount"
                  name="Despesa"
                  fill={VIZ.s2}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  label={{ position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 11, formatter: (v: unknown) => `${Math.round((Number(v) / total) * 100)}%` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        }
        table={
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r) => (
                <tr key={r.category} className="border-b last:border-0">
                  <td className="py-2">{r.label}</td>
                  <td className="num py-2 text-right">{formatKz(r.amount)}</td>
                  <td className="num py-2 text-right text-muted-foreground">{Math.round((r.amount / total) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />
    </VizRoot>
  );
}
