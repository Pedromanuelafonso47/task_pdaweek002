'use client';
import * as React from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtNum } from '@/lib/utils';

/** Área ativa por cultura — série única: uma cor, sem legenda (o título identifica a série). */
export function CropAreaChart({ data }: { data: { crop: string; areaHa: number }[] }) {
  const rows = [...data].sort((a, b) => b.areaHa - a.areaHa);
  const height = Math.max(120, rows.length * 40 + 24);
  return (
    <div>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
            <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} unit=" ha" />
            <YAxis type="category" dataKey="crop" width={96} tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(v) => [`${fmtNum(Number(v), 2)} ha`, 'Área']}
            />
            <Bar dataKey="areaHa" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={22}>
              <LabelList dataKey="areaHa" position="right" formatter={(v: unknown) => `${fmtNum(Number(v), 1)} ha`} style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Área ativa por cultura</caption>
        <thead>
          <tr>
            <th>Cultura</th>
            <th>Área (ha)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.crop}>
              <td>{r.crop}</td>
              <td>{fmtNum(r.areaHa, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
