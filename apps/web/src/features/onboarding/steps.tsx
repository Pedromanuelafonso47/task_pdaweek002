'use client';
import {
  ANGOLA_PROVINCES,
  CONNECTIVITY,
  FARMER_TYPES,
  GOALS,
  IRRIGATION_SYSTEMS,
  LABELS,
  PROBLEMS,
  PROVINCE_CENTER,
  SOIL_TYPES,
  TECH_LEVELS,
  TERRAIN_TYPES,
  WATER_AVAILABILITY,
  WATER_SOURCES,
  formatKz,
  type AngolaProvince,
  type OnboardingInput,
} from '@agrogenius/shared';
import { useQuery } from '@tanstack/react-query';
import { Crosshair, MapPin, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { LocationPicker, PolygonDrawer } from '@/components/maps';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/feedback';
import { ChipGroup, Field, Input, Select, Toggle } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { Crop } from '@/lib/types';
import { fmtNum } from '@/lib/utils';
import { num, numOrNull } from './zod-pt';

type Form = OnboardingInput;

/** Lê a mensagem de erro de um caminho aninhado. */
function useErr() {
  const { formState } = useFormContext<Form>();
  return (path: string): string | undefined => {
    const parts = path.split('.');
    let cur: unknown = formState.errors;
    for (const p of parts) cur = (cur as Record<string, unknown> | undefined)?.[p];
    return (cur as { message?: string } | undefined)?.message;
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      {children}
    </fieldset>
  );
}

export function StepPersonal() {
  const { register } = useFormContext<Form>();
  const err = useErr();
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Nome completo" error={err('personal.fullName')} className="sm:col-span-2">
        <Input autoComplete="name" {...register('personal.fullName')} />
      </Field>
      <Field label="Contacto telefónico" error={err('personal.phone')} hint="Ex.: +244 923 000 000">
        <Input type="tel" inputMode="tel" autoComplete="tel" {...register('personal.phone')} />
      </Field>
      <Field label="Província" error={err('personal.province')}>
        <Select {...register('personal.province')}>
          <option value="">Seleciona…</option>
          {ANGOLA_PROVINCES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
      </Field>
      <Field label="Município" error={err('personal.municipality')}>
        <Input {...register('personal.municipality')} />
      </Field>
      <Field label="Localidade / comuna" error={err('personal.locality')}>
        <Input {...register('personal.locality')} />
      </Field>
      <div className="sm:col-span-2">
        <Section title="Tipo de agricultor">
          <Controller
            name="personal.farmerType"
            render={({ field }) => <ChipGroup options={FARMER_TYPES} value={field.value} onChange={field.onChange} labels={LABELS.farmerType} />}
          />
          {err('personal.farmerType') && <p className="text-xs text-destructive">Escolhe uma opção</p>}
        </Section>
      </div>
    </div>
  );
}

export function StepFarm() {
  const { register, watch, setValue, control } = useFormContext<Form>();
  const err = useErr();
  const province = watch('farm.province') as AngolaProvince | undefined;
  const lat = watch('farm.latitude');
  const lng = watch('farm.longitude');
  const boundary = watch('farm.boundary');
  const [geoMsg, setGeoMsg] = React.useState<string | null>(null);
  const [draw, setDraw] = React.useState(!!boundary);
  const center: [number, number] = province ? [PROVINCE_CENTER[province][1], PROVINCE_CENTER[province][0]] : [17.5, -12.3];

  const locate = () => {
    if (!navigator.geolocation) return setGeoMsg('Este dispositivo não permite obter a localização.');
    setGeoMsg('A obter localização…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setValue('farm.latitude', +p.coords.latitude.toFixed(6), { shouldDirty: true });
        setValue('farm.longitude', +p.coords.longitude.toFixed(6), { shouldDirty: true });
        setGeoMsg(`Localização obtida (precisão ~${Math.round(p.coords.accuracy)} m).`);
      },
      () => setGeoMsg('Não foi possível obter a localização. Marca o ponto no mapa.'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const chips = (name: `farm.${'terrainType' | 'soilType' | 'waterAvailability' | 'waterSource' | 'irrigationSystem'}`, options: readonly string[], labels: Record<string, string>, title: string) => (
    <Section title={title}>
      <Controller control={control} name={name} render={({ field }) => <ChipGroup options={options} value={field.value as string} onChange={field.onChange} labels={labels} />} />
      {err(name) && <p className="text-xs text-destructive">Escolhe uma opção</p>}
    </Section>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome da propriedade" error={err('farm.name')} className="sm:col-span-2">
          <Input placeholder="Ex.: Fazenda Chianga" {...register('farm.name')} />
        </Field>
        <Field label="Província" error={err('farm.province')}>
          <Select {...register('farm.province')}>
            <option value="">Seleciona…</option>
            {ANGOLA_PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="Município" error={err('farm.municipality')}>
          <Input {...register('farm.municipality')} />
        </Field>
      </div>

      <Section title="Localização geográfica">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={locate}>
            <Crosshair /> Usar a minha localização
          </Button>
          <span className="text-xs text-muted-foreground">ou clica no mapa para marcar a entrada da propriedade.</span>
        </div>
        {geoMsg && <p className="text-xs text-muted-foreground">{geoMsg}</p>}
        <LocationPicker
          center={center}
          value={lat !== null && lat !== undefined && lng !== null && lng !== undefined ? { lat, lng } : null}
          onChange={(v) => {
            setValue('farm.latitude', v.lat, { shouldDirty: true });
            setValue('farm.longitude', v.lng, { shouldDirty: true });
          }}
        />
        {lat !== null && lat !== undefined && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" /> {lat}, {lng}
          </p>
        )}
        <Toggle checked={draw} onChange={setDraw} label="Desenhar o limite da propriedade (opcional)" description="Calcula a área automaticamente e melhora a vista 3D e o mapa." />
        {draw && (
          <PolygonDrawer
            center={lat !== null && lat !== undefined && lng !== null && lng !== undefined ? [lng, lat] : center}
            value={boundary ?? null}
            onChange={(p, area) => {
              setValue('farm.boundary', p, { shouldDirty: true });
              if (p && area > 0) {
                setValue('farm.totalAreaHa', area, { shouldDirty: true, shouldValidate: true });
                if (lat === null || lat === undefined) {
                  const ring = p.coordinates[0];
                  setValue('farm.longitude', +(ring.reduce((s, c) => s + c[0], 0) / ring.length).toFixed(6));
                  setValue('farm.latitude', +(ring.reduce((s, c) => s + c[1], 0) / ring.length).toFixed(6));
                }
              }
            }}
          />
        )}
      </Section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Área total (ha)" error={err('farm.totalAreaHa')}>
          <Input type="number" step="0.01" min="0" inputMode="decimal" {...register('farm.totalAreaHa', { setValueAs: num })} />
        </Field>
        <Field label="Área efetivamente cultivada (ha)" error={err('farm.cultivatedAreaHa')}>
          <Input type="number" step="0.01" min="0" inputMode="decimal" {...register('farm.cultivatedAreaHa', { setValueAs: num })} />
        </Field>
      </div>
      {chips('farm.terrainType', TERRAIN_TYPES, LABELS.terrain, 'Tipo de terreno')}
      {chips('farm.soilType', SOIL_TYPES, LABELS.soil, 'Tipo de solo')}
      {chips('farm.waterAvailability', WATER_AVAILABILITY, LABELS.waterAvailability, 'Disponibilidade de água')}
      {chips('farm.waterSource', WATER_SOURCES, LABELS.waterSource, 'Fonte de água')}
      {chips('farm.irrigationSystem', IRRIGATION_SYSTEMS, LABELS.irrigation, 'Sistema de irrigação existente')}
    </div>
  );
}

export function StepProduction() {
  const { register, control, watch } = useFormContext<Form>();
  const err = useErr();
  const { fields, append, remove } = useFieldArray({ control, name: 'production.crops' });
  const crops = useQuery({ queryKey: ['crops'], queryFn: () => api<Crop[]>('/crops'), staleTime: Infinity });
  const items = watch('production.crops') ?? [];
  const cultivated = Number(watch('farm.cultivatedAreaHa') ?? 0);
  const used = items.reduce((s, c) => s + (Number(c?.areaHa) || 0), 0);

  return (
    <div className="space-y-6">
      <Section title="Culturas cultivadas">
        <div className="space-y-3">
          {fields.map((f, i) => {
            const crop = crops.data?.find((c) => c.slug === items[i]?.cropSlug);
            return (
              <div key={f.id} className="rounded-lg border bg-muted/20 p-3">
                <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_auto]">
                  <Field label="Cultura" error={err(`production.crops.${i}.cropSlug`)}>
                    <Select {...register(`production.crops.${i}.cropSlug`)} disabled={crops.isLoading}>
                      <option value="">{crops.isLoading ? 'A carregar…' : 'Seleciona…'}</option>
                      {crops.data?.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Área (ha)" error={err(`production.crops.${i}.areaHa`)}>
                    <Input type="number" step="0.01" min="0" inputMode="decimal" {...register(`production.crops.${i}.areaHa`, { setValueAs: num })} />
                  </Field>
                  <div className="flex items-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remover cultura" disabled={fields.length === 1}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="Época de plantação">
                    <Input placeholder="Ex.: Época A (Set–Jan)" {...register(`production.crops.${i}.season`)} />
                  </Field>
                  <Field label="Frequência de colheita">
                    <Input placeholder="Ex.: 1x por ano" {...register(`production.crops.${i}.harvestFrequency`)} />
                  </Field>
                  <Field label="Produtividade aproximada (kg/ha)" hint="Opcional — o teu valor habitual">
                    <Input type="number" min="0" inputMode="numeric" {...register(`production.crops.${i}.approxYieldKgHa`, { setValueAs: numOrNull })} />
                  </Field>
                </div>
                {crop && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {crop.scientificName} · ciclo ~{crop.cycleDays} dias · necessidade de água {crop.waterNeed === 'HIGH' ? 'alta' : crop.waterNeed === 'MEDIUM' ? 'média' : 'baixa'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => append({ cropSlug: '', areaHa: undefined as unknown as number, season: '', harvestFrequency: '', approxYieldKgHa: null })}>
            <Plus /> Adicionar cultura
          </Button>
          <span className={`num text-xs ${used > cultivated + 0.001 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {fmtNum(used, 2)} de {fmtNum(cultivated, 2)} ha cultivados atribuídos
          </span>
        </div>
        {err('production.crops') && <p className="text-xs text-destructive">{err('production.crops')}</p>}
      </Section>
      <Section title="Problemas que enfrentas">
        <Controller control={control} name="production.problems" render={({ field }) => <ChipGroup multiple options={PROBLEMS} value={field.value} onChange={field.onChange} labels={LABELS.problem} />} />
        <p className="text-xs text-muted-foreground">Usamos estes problemas para só recomendar soluções que lhes respondem diretamente.</p>
      </Section>
    </div>
  );
}

export function StepInfrastructure() {
  const { control } = useFormContext<Form>();
  const toggle = (name: `infrastructure.${'hasElectricity' | 'hasSensors' | 'hasPumps' | 'hasMachinery'}`, label: string, description: string) => (
    <Controller control={control} name={name} render={({ field }) => <Toggle checked={!!field.value} onChange={field.onChange} label={label} description={description} />} />
  );
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {toggle('infrastructure.hasElectricity', 'Eletricidade disponível?', 'Rede elétrica na propriedade')}
        {toggle('infrastructure.hasPumps', 'Existem bombas de água?', 'Motobomba, bomba elétrica ou solar')}
        {toggle('infrastructure.hasSensors', 'Existem sensores?', 'Qualquer sensor já instalado')}
        {toggle('infrastructure.hasMachinery', 'Existem máquinas agrícolas?', 'Trator, motocultivador…')}
      </div>
      <Section title="Internet disponível?">
        <Controller control={control} name="infrastructure.internet" render={({ field }) => <ChipGroup options={CONNECTIVITY} value={field.value} onChange={field.onChange} labels={LABELS.connectivity} />} />
      </Section>
      <Section title="Nível de infraestrutura tecnológica">
        <Controller control={control} name="infrastructure.techLevel" render={({ field }) => <ChipGroup options={TECH_LEVELS} value={field.value} onChange={field.onChange} labels={LABELS.techLevel} />} />
        <p className="text-xs text-muted-foreground">Ajuda a sugerir projetos com a complexidade certa (ou recomendar apoio técnico).</p>
      </Section>
    </div>
  );
}

export function StepGoals() {
  const { control, register, watch } = useFormContext<Form>();
  const err = useErr();
  const budget = watch('goals.budgetKz');
  return (
    <div className="space-y-6">
      <Section title="Objetivos">
        <Controller control={control} name="goals.goals" render={({ field }) => <ChipGroup multiple options={GOALS} value={field.value} onChange={field.onChange} labels={LABELS.goal} />} />
        {err('goals.goals') && <p className="text-xs text-destructive">{err('goals.goals')}</p>}
      </Section>
      <Field label="Outro objetivo (opcional)">
        <Input {...register('goals.otherGoal')} />
      </Field>
      <Field label="Orçamento aproximado para tecnologia (Kz)" error={err('goals.budgetKz')} hint={budget ? formatKz(budget) : 'Ex.: 300000'}>
        <Input type="number" min="0" step="1000" inputMode="numeric" {...register('goals.budgetKz', { setValueAs: num })} />
      </Field>
      <Notice>O orçamento serve para verificar a viabilidade de cada projeto e propor implementação faseada. Não é partilhado com terceiros.</Notice>
    </div>
  );
}
