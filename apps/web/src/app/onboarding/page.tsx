'use client';
import '@/features/onboarding/zod-pt';
import { onboardingSchema, type OnboardingInput } from '@agrogenius/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CloudCheck, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { FormProvider, useForm, type FieldPath } from 'react-hook-form';
import { Logo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth, homeFor } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { OnboardingResultView, type OnboardingResult } from '@/features/onboarding/result';
import { StepFarm, StepGoals, StepInfrastructure, StepPersonal, StepProduction } from '@/features/onboarding/steps';

type Form = OnboardingInput;

import { Photo } from '@/components/photo';
import type { PhotoKey } from '@/content/photos';

/** Uma fotografia por etapa: quem és, a tua terra, o que produzes, o que já tens, onde queres chegar. */
const STEP_PHOTOS: PhotoKey[] = ['agricultora-horta', 'angola-namibe-campo', 'angola-colheita-batata', 'bomba-solar-comunidade', 'kit-gota-a-gota'];

const STEPS: { key: keyof Form; title: string; subtitle: string; Comp: React.ComponentType }[] = [
  { key: 'personal', title: 'Informações pessoais', subtitle: 'Quem és e onde trabalhas', Comp: StepPersonal },
  { key: 'farm', title: 'Propriedade agrícola', subtitle: 'Localização, solo e água', Comp: StepFarm },
  { key: 'production', title: 'Produção agrícola', subtitle: 'Culturas e problemas', Comp: StepProduction },
  { key: 'infrastructure', title: 'Infraestrutura', subtitle: 'Energia, internet e equipamentos', Comp: StepInfrastructure },
  { key: 'goals', title: 'Objetivos e orçamento', subtitle: 'O que queres melhorar', Comp: StepGoals },
];

type Draft = { step: number; values: Partial<Form> };

function defaults(name: string): Partial<Form> {
  return {
    personal: { fullName: name, phone: '', province: '' as never, municipality: '', locality: '', farmerType: undefined as never },
    farm: {
      name: '', province: '' as never, municipality: '', locality: '', latitude: null, longitude: null, boundary: null,
      totalAreaHa: undefined as never, cultivatedAreaHa: undefined as never,
      terrainType: undefined as never, soilType: undefined as never, waterAvailability: undefined as never, waterSource: undefined as never, irrigationSystem: undefined as never,
    },
    production: { crops: [{ cropSlug: '', areaHa: undefined as never, season: '', harvestFrequency: '', approxYieldKgHa: null }], problems: [] },
    infrastructure: { hasElectricity: false, internet: 'NONE', hasSensors: false, hasPumps: false, hasMachinery: false, techLevel: 'NONE' },
    goals: { goals: [], otherGoal: '', budgetKz: undefined as never },
  };
}

export default function OnboardingPage() {
  const { user, status, reload } = useAuth();
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const [ready, setReady] = React.useState(false);
  const [saving, setSaving] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const [result, setResult] = React.useState<OnboardingResult | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const form = useForm<Form>({ resolver: zodResolver(onboardingSchema) as never, mode: 'onTouched', defaultValues: defaults('') as Form });

  // Sessão e retoma do rascunho guardado no servidor
  React.useEffect(() => {
    if (status === 'anonymous') router.replace('/login?next=/onboarding');
    if (status !== 'authenticated' || !user) return;
    if (user.role !== 'FARMER') return router.replace(homeFor(user));
    if (result) return;
    api<{ onboardingDraft: Draft | null; onboardingCompleted: boolean; fullName: string }>('/onboarding')
      .then((r) => {
        if (r.onboardingCompleted && !result) return router.replace('/dashboard');
        const base = defaults(r.fullName);
        if (r.onboardingDraft?.values) {
          const v = r.onboardingDraft.values;
          form.reset({ ...base, ...v, personal: { ...base.personal!, ...v.personal }, farm: { ...base.farm!, ...v.farm } } as Form);
          setStep(Math.min(Math.max(r.onboardingDraft.step ?? 0, 0), STEPS.length - 1));
        } else form.reset(base as Form);
      })
      .catch(() => form.reset(defaults(user.fullName) as Form))
      .finally(() => setReady(true));
  }, [status, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rascunho automático (debounce)
  const values = form.watch();
  const serialized = JSON.stringify(values);
  React.useEffect(() => {
    if (!ready || result) return;
    setSaving('saving');
    const t = setTimeout(() => {
      api('/onboarding/draft', { method: 'PUT', body: { draft: { step, values: JSON.parse(serialized) } } })
        .then(() => setSaving('saved'))
        .catch(() => setSaving('idle'));
    }, 1200);
    return () => clearTimeout(t);
  }, [serialized, step, ready, result]);

  // Pré-preencher a província da propriedade com a pessoal
  React.useEffect(() => {
    if (step === 1 && !form.getValues('farm.province') && values.personal?.province) {
      form.setValue('farm.province', values.personal.province);
      if (!form.getValues('farm.municipality')) form.setValue('farm.municipality', values.personal.municipality ?? '');
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async (to: number) => {
    if (to > step) {
      const ok = await form.trigger(STEPS[step].key as FieldPath<Form>, { shouldFocus: true });
      if (!ok) return;
    }
    setDir(to > step ? 1 : -1);
    setStep(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = form.handleSubmit(
    async (data) => {
      setSubmitError(null);
      try {
        const r = await api<OnboardingResult>('/onboarding/complete', { method: 'POST', body: data });
        setResult(r);
        await reload();
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'Não foi possível concluir');
      }
    },
    (errors) => {
      const first = STEPS.findIndex((s) => errors[s.key]);
      if (first >= 0) setStep(first);
      setSubmitError('Há campos por corrigir. Revê a etapa assinalada.');
    },
  );

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const S = STEPS[step];
  return (
    <div className="bg-field-grid min-h-dvh">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Logo />
          {!result && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
              {saving === 'saving' ? <Loader2 className="size-3.5 animate-spin" /> : saving === 'saved' ? <CloudCheck className="size-3.5 text-primary" /> : null}
              {saving === 'saving' ? 'A guardar rascunho…' : saving === 'saved' ? 'Rascunho guardado' : ''}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {result ? (
          <OnboardingResultView result={result} />
        ) : (
          <>
            {/* Progresso */}
            <ol className="mb-8 grid grid-cols-5 gap-2" aria-label="Etapas">
              {STEPS.map((s, i) => (
                <li key={s.key}>
                  <button type="button" onClick={() => i < step && go(i)} disabled={i >= step} className="group w-full text-left" aria-current={i === step ? 'step' : undefined}>
                    <span className={cn('block h-1.5 rounded-full transition-colors', i < step ? 'bg-primary' : i === step ? 'bg-primary/60' : 'bg-muted')} />
                    <span className={cn('mt-2 hidden items-center gap-1 text-[11px] sm:flex', i === step ? 'text-foreground' : 'text-muted-foreground')}>
                      {i < step && <Check className="size-3 text-primary" />}
                      {s.title}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <Card className="overflow-hidden p-5 sm:p-8">
              <motion.div key={`photo-${step}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="-mx-5 -mt-5 mb-6 sm:-mx-8 sm:-mt-8">
                <Photo k={STEP_PHOTOS[step]} priority={step === 0} sizes="(min-width:768px) 768px, 100vw" className="aspect-[21/8] sm:aspect-[21/6]" />
              </motion.div>
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
                  Etapa {step + 1} de {STEPS.length}
                </p>
                <h1 className="font-display text-2xl font-semibold tracking-tight">{S.title}</h1>
                <p className="text-sm text-muted-foreground">{S.subtitle}</p>
              </div>
              <FormProvider {...form}>
                <form onSubmit={(e) => e.preventDefault()} noValidate>
                  <AnimatePresence mode="wait" custom={dir}>
                    <motion.div
                      key={step}
                      custom={dir}
                      initial={{ opacity: 0, x: dir * 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: dir * -24 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                      <S.Comp />
                    </motion.div>
                  </AnimatePresence>
                  {submitError && <p className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{submitError}</p>}
                  <div className="mt-8 flex items-center justify-between gap-2 border-t pt-5">
                    <Button type="button" variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
                      <ArrowLeft /> Anterior
                    </Button>
                    {step < STEPS.length - 1 ? (
                      <Button type="button" onClick={() => go(step + 1)}>
                        Continuar <ArrowRight />
                      </Button>
                    ) : (
                      <Button type="button" onClick={submit} loading={form.formState.isSubmitting}>
                        Analisar a minha propriedade
                      </Button>
                    )}
                  </div>
                </form>
              </FormProvider>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
