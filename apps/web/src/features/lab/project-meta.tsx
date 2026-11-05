import { CloudOff, Cloud, Droplets, Leaf, Sprout, Sun, Gauge, Plug } from 'lucide-react';
import { LABELS } from '@agrogenius/shared';
import { Badge, type BadgeTone } from '@/components/ui/badge';

export const CATEGORY_ICON: Record<string, React.ElementType> = {
  SMART_IRRIGATION: Droplets,
  SOIL_MONITORING: Sprout,
  ENVIRONMENTAL_MONITORING: Sun,
  SMART_FARMING: Leaf,
  RESOURCE_MANAGEMENT: Gauge,
};

export const CATEGORIES = Object.keys(LABELS.projectCategory) as (keyof typeof LABELS.projectCategory)[];
export const DIFFICULTIES = Object.keys(LABELS.difficulty) as (keyof typeof LABELS.difficulty)[];

const DIFF_TONE: Record<string, BadgeTone> = { BEGINNER: 'green', INTERMEDIATE: 'blue', ADVANCED: 'amber' };

export function DifficultyBadge({ value }: { value: string }) {
  return <Badge tone={DIFF_TONE[value] ?? 'neutral'}>{LABELS.difficulty[value as keyof typeof LABELS.difficulty] ?? value}</Badge>;
}

export function OfflineBadge({ offline }: { offline: boolean }) {
  return offline ? (
    <Badge tone="neutral">
      <CloudOff /> Funciona offline
    </Badge>
  ) : (
    <Badge tone="amber">
      <Cloud /> Requer internet
    </Badge>
  );
}

export function PowerBadge({ requires }: { requires: boolean }) {
  return requires ? (
    <Badge tone="neutral">
      <Plug /> Precisa de energia
    </Badge>
  ) : null;
}

export const RULE_LABEL = { FIXED: 'fixo', PER_HECTARE: 'por hectare', PER_ZONE: 'por zona' } as const;

export function labelList(codes: string[], dict: Record<string, string>) {
  return codes.map((c) => dict[c] ?? c);
}
