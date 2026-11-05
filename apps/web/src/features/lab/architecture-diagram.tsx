'use client';
import * as React from 'react';
import type { ArchNode } from '@/lib/types';

/** Camadas: entradas (sensores/energia) → controlador → saídas (atuadores/água) → plataforma/utilizador. */
const LAYER: Record<ArchNode['kind'], number> = { sensor: 0, power: 0, controller: 1, actuator: 2, water: 2, cloud: 3, user: 3 };
const LAYER_LABEL = ['Entradas', 'Controlo', 'Atuação', 'Plataforma'];

const KIND_STYLE: Record<ArchNode['kind'], { fill: string; stroke: string; label: string }> = {
  sensor: { fill: 'hsl(var(--primary) / 0.12)', stroke: 'hsl(var(--primary))', label: 'Sensor' },
  power: { fill: 'hsl(var(--warning) / 0.12)', stroke: 'hsl(var(--warning))', label: 'Energia' },
  controller: { fill: 'hsl(var(--accent) / 0.18)', stroke: 'hsl(var(--foreground) / 0.7)', label: 'Controlador' },
  actuator: { fill: 'rgb(14 165 233 / 0.12)', stroke: 'rgb(14 165 233)', label: 'Atuador' },
  water: { fill: 'rgb(56 189 248 / 0.12)', stroke: 'rgb(56 189 248)', label: 'Água' },
  cloud: { fill: 'hsl(var(--muted))', stroke: 'hsl(var(--muted-foreground))', label: 'Plataforma' },
  user: { fill: 'hsl(var(--muted))', stroke: 'hsl(var(--muted-foreground))', label: 'Utilizador' },
};

const W = 180;
const H = 54;
const GAP_X = 70;
const GAP_Y = 22;

function wrap(text: string, max = 24): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

export function ArchitectureDiagram({ nodes, edges }: { nodes: ArchNode[]; edges: { from: string; to: string; label?: string }[] }) {
  const [hover, setHover] = React.useState<string | null>(null);
  const layers = [0, 1, 2, 3].map((l) => nodes.filter((n) => LAYER[n.kind] === l));
  const used = layers.map((l, i) => (l.length ? i : -1)).filter((i) => i >= 0);
  const maxRows = Math.max(...layers.map((l) => l.length), 1);
  const height = 40 + maxRows * (H + GAP_Y);
  const width = used.length * W + (used.length - 1) * GAP_X + 20;

  const pos = new Map<string, { x: number; y: number }>();
  used.forEach((li, col) => {
    const list = layers[li];
    const offset = (maxRows - list.length) * (H + GAP_Y) * 0.5;
    list.forEach((n, row) => pos.set(n.id, { x: 10 + col * (W + GAP_X), y: 32 + offset + row * (H + GAP_Y) }));
  });

  const kinds = [...new Set(nodes.map((n) => n.kind))];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border bg-background/40 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-[560px] w-full" role="img" aria-label="Diagrama de arquitetura do projeto">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="hsl(var(--muted-foreground))" />
            </marker>
          </defs>
          {used.map((li, col) => (
            <text key={li} x={10 + col * (W + GAP_X) + W / 2} y={16} textAnchor="middle" fontSize="10" letterSpacing="1.5" fill="hsl(var(--muted-foreground))">
              {LAYER_LABEL[li].toUpperCase()}
            </text>
          ))}
          {edges.map((e, i) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const forward = b.x > a.x;
            const same = b.x === a.x;
            const x1 = same ? a.x + W / 2 : forward ? a.x + W : a.x;
            const x2 = same ? b.x + W / 2 : forward ? b.x : b.x + W;
            const y1 = same ? (b.y > a.y ? a.y + H : a.y) : a.y + H / 2;
            const y2 = same ? (b.y > a.y ? b.y : b.y + H) : b.y + H / 2;
            const mx = (x1 + x2) / 2;
            const d = same ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
            const active = hover === e.from || hover === e.to;
            return (
              <g key={i} opacity={hover && !active ? 0.25 : 1}>
                <path d={d} fill="none" stroke={active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.6)'} strokeWidth={active ? 2 : 1.4} strokeDasharray={forward || same ? undefined : '4 3'} markerEnd="url(#arrow)" />
                {e.label && (
                  <text x={mx} y={(y1 + y2) / 2 - 5} textAnchor="middle" fontSize="9.5" fill="hsl(var(--muted-foreground))" paintOrder="stroke" stroke="hsl(var(--background))" strokeWidth={3}>
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
          {nodes.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            const s = KIND_STYLE[n.kind];
            const lines = wrap(n.label);
            return (
              <g key={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} className="cursor-default" opacity={hover && hover !== n.id && !edges.some((e) => (e.from === hover && e.to === n.id) || (e.to === hover && e.from === n.id)) ? 0.4 : 1}>
                <rect x={p.x} y={p.y} width={W} height={H} rx={10} fill={s.fill} stroke={s.stroke} strokeWidth={hover === n.id ? 2 : 1.2} />
                <text x={p.x + 12} y={p.y + 15} fontSize="8.5" letterSpacing="1" fill={s.stroke}>
                  {s.label.toUpperCase()}
                </text>
                {lines.map((l, i) => (
                  <text key={i} x={p.x + 12} y={p.y + 31 + i * 13} fontSize="11.5" fontWeight={500} fill="hsl(var(--foreground))">
                    {l}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {kinds.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border" style={{ background: KIND_STYLE[k].fill, borderColor: KIND_STYLE[k].stroke }} />
            {KIND_STYLE[k].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 border-t border-dashed border-muted-foreground" /> fluxo de retorno
        </span>
      </div>
    </div>
  );
}
