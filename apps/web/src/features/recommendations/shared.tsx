import { LABELS } from '@agrogenius/shared';
import { Badge, priorityTone, statusTone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function PriorityBadge({ value }: { value: string }) {
  return <Badge tone={priorityTone(value)}>Prioridade {LABELS.priority[value as keyof typeof LABELS.priority]?.toLowerCase() ?? value}</Badge>;
}

export function StatusBadge({ value }: { value: string }) {
  return <Badge tone={statusTone(value)}>{LABELS.recommendationStatus[value as keyof typeof LABELS.recommendationStatus] ?? value}</Badge>;
}

/** Anel de pontuação 0–100. */
export function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`Pontuação de adequação: ${score}/100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth={4} strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <span className="num absolute inset-0 grid place-items-center font-display text-sm font-semibold">{score}</span>
    </div>
  );
}

/** Liga cada dado em falta à página onde se completa. */
export function missingLink(text: string, farmId: string): string {
  const t = text.toLowerCase();
  if (t.includes('despesas') || t.includes('custos')) return '/finance';
  if (t.includes('cultura')) return '/production';
  return `/farms/${farmId}`;
}

export function WeightBar({ weight }: { weight: number }) {
  const w = Math.min(100, Math.abs(weight) * 4);
  return (
    <div className="flex w-20 shrink-0 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', weight >= 0 ? 'bg-primary' : 'bg-warning')} style={{ width: `${w}%` }} />
      </div>
      <span className={cn('num w-7 text-right text-xs', weight >= 0 ? 'text-muted-foreground' : 'text-warning')}>
        {weight > 0 ? '+' : ''}
        {weight}
      </span>
    </div>
  );
}
