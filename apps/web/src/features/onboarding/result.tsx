'use client';
import { LABELS, formatKz } from '@agrogenius/shared';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Badge, priorityTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Notice } from '@/components/ui/feedback';
import type { Recommendation } from '@/lib/types';

export interface OnboardingResult {
  farmId: string;
  recommendations: { items: Recommendation[]; analysis: { missingData: string[] } };
}

export function OnboardingResultView({ result }: { result: OnboardingResult }) {
  const items = result.recommendations.items;
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto grid size-14 place-items-center rounded-full bg-primary/15 text-primary shadow-glow">
          <Sparkles className="size-6" />
        </motion.div>
        <h2 className="font-display text-2xl font-semibold">O teu perfil agrícola está pronto</h2>
        <p className="mx-auto max-w-lg text-sm text-muted-foreground">
          Analisámos a tua propriedade e encontrámos {items.length} projeto(s) ligados aos problemas e objetivos que indicaste.
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Ainda sem recomendações" description="Com os dados atuais nenhum projeto responde diretamente aos teus objetivos. Podes completar o perfil no painel." />
      ) : (
        <ol className="space-y-3">
          {items.slice(0, 4).map((r, i) => (
            <motion.li
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="rounded-lg border bg-card p-4 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">#{i + 1} · {r.problem}</p>
                  <p className="font-display font-semibold">{r.project.title}</p>
                </div>
                <Badge tone={priorityTone(r.priority)}>Prioridade {LABELS.priority[r.priority].toLowerCase()}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{r.reasons[0]?.text}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>
                  Custo estimado <b className="num">{formatKz(r.estimatedCostKz)}</b>
                </span>
                {!r.withinBudget && r.phases?.length ? (
                  <span className="text-warning">Piloto: {formatKz(r.phases[0].costKz)}</span>
                ) : !r.withinBudget ? (
                  <span className="text-warning">Acima do orçamento</span>
                ) : (
                  <span className="text-primary">Dentro do orçamento</span>
                )}
              </div>
            </motion.li>
          ))}
        </ol>
      )}
      {result.recommendations.analysis.missingData.length > 0 && (
        <Notice tone="warn">Para recomendações mais precisas, completa: {result.recommendations.analysis.missingData.join(' · ')}.</Notice>
      )}
      <Notice>Custos calculados com preços de referência — são estimativas a confirmar com fornecedores locais.</Notice>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link href="/dashboard">
            Ir para o painel <ArrowRight />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/recommendations">Ver todas as recomendações</Link>
        </Button>
      </div>
    </div>
  );
}
