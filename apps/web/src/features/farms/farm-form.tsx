'use client';
import '@/features/onboarding/zod-pt';
import {
  ANGOLA_PROVINCES,
  CONNECTIVITY,
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
  farmCreateSchema,
  formatKz,
  type AngolaProvince,
  type FarmCreateInput,
} from '@agrogenius/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Crosshair } from 'lucide-react';
import * as React from 'react';
import { Controller, useForm, type Control, type FieldPath } from 'react-hook-form';
import { LocationPicker, PolygonDrawer } from '@/components/maps';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChipGroup, Field, Input, Select, Textarea, Toggle } from '@/components/ui/input';
import type { FarmSummary } from '@/lib/types';
import { num, numOrNull } from '@/features/onboarding/zod-pt';

type Form = FarmCreateInput;

export function farmToForm(f: FarmSummary): Form {
  return {
    name: f.name,
    province: f.province as AngolaProvince,
    municipality: f.municipality ?? '',
    locality: f.locality ?? '',
    latitude: f.latitude,
    longitude: f.longitude,
    boundary: f.boundary,
    totalAreaHa: Number(f.totalAreaHa),
    cultivatedAreaHa: Number(f.cultivatedAreaHa),
    terrainType: f.terrainType as Form['terrainType'],
    soilType: f.soilType as Form['soilType'],
    waterAvailability: f.waterAvailability as Form['waterAvailability'],
    waterSource: f.waterSource as Form['waterSource'],
    irrigationSystem: f.irrigationSystem as Form['irrigationSystem'],
    hasElectricity: f.hasElectricity,
    internet: f.internet as Form['internet'],
    hasSensors: f.hasSensors,
    hasPumps: f.hasPumps,
    hasMachinery: f.hasMachinery,
    techLevel: f.techLevel as Form['techLevel'],
    budgetKz: f.budgetKz === null ? null : Number(f.budgetKz),
    goals: f.goals as Form['goals'],
    problems: f.problems as Form['problems'],
    otherGoal: f.otherGoal ?? '',
  };
}

function Chips({ control, name, options, labels, multiple }: { control: Control<Form>; name: FieldPath<Form>; options: readonly string[]; labels: Record<string, string>; multiple?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <>
          <ChipGroup multiple={multiple} options={options} value={field.value as string | string[]} onChange={field.onChange} labels={labels} />
          {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message ?? 'Escolhe uma opção'}</p>}
        </>
      )}
    />
  );
}

export function FarmForm({ initial, submitLabel, onSubmit }: { initial?: Form; submitLabel: string; onSubmit: (v: Form) => Promise<unknown> }) {
  const form = useForm<Form>({
    resolver: zodResolver(farmCreateSchema) as never,
    mode: 'onTouched',
    defaultValues:
      initial ??
      ({
        name: '', province: '' as never, municipality: '', locality: '', latitude: null, longitude: null, boundary: null,
        terrainType: 'FLAT', soilType: 'UNKNOWN', waterAvailability: 'MODERATE', waterSource: 'WELL', irrigationSystem: 'MANUAL',
        hasElectricity: false, internet: 'NONE', hasSensors: false, hasPumps: false, hasMachinery: false, techLevel: 'NONE',
        budgetKz: null, goals: [], problems: [], otherGoal: '',
      } as unknown as Form),
  });
  const { register, control, watch, setValue, formState, handleSubmit } = form;
  const e = formState.errors;
  const province = watch('province') as AngolaProvince | '';
  const lat = watch('latitude');
  const lng = watch('longitude');
  const boundary = watch('boundary');
  const budget = watch('budgetKz');
  const [draw, setDraw] = React.useState(!!initial?.boundary);
  const [error, setError] = React.useState<string | null>(null);
  const center: [number, number] = province ? [PROVINCE_CENTER[province][1], PROVINCE_CENTER[province][0]] : [17.5, -12.3];
  const hasPoint = lat !== null && lat !== undefined && lng !== null && lng !== undefined;

  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setValue('latitude', +p.coords.latitude.toFixed(6), { shouldDirty: true });
        setValue('longitude', +p.coords.longitude.toFixed(6), { shouldDirty: true });
      },
      () => setError('Não foi possível obter a localização. Marca o ponto no mapa.'),
    );

  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      await onSubmit(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível guardar');
    }
  });

  const toggle = (name: 'hasElectricity' | 'hasPumps' | 'hasSensors' | 'hasMachinery', label: string) => (
    <Controller control={control} name={name} render={({ field }) => <Toggle checked={!!field.value} onChange={field.onChange} label={label} />} />
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Identificação e localização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da propriedade" error={e.name?.message} className="sm:col-span-2">
              <Input {...register('name')} />
            </Field>
            <Field label="Província" error={e.province?.message}>
              <Select {...register('province')}>
                <option value="">Seleciona…</option>
                {ANGOLA_PROVINCES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field label="Município">
              <Input {...register('municipality')} />
            </Field>
            <Field label="Localidade">
              <Input {...register('locality')} />
            </Field>
            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={locate}>
                <Crosshair /> Usar a minha localização
              </Button>
            </div>
          </div>
          <LocationPicker
            center={center}
            value={hasPoint ? { lat: lat!, lng: lng! } : null}
            onChange={(v) => {
              setValue('latitude', v.lat, { shouldDirty: true });
              setValue('longitude', v.lng, { shouldDirty: true });
            }}
          />
          <p className="text-xs text-muted-foreground">{hasPoint ? `Coordenadas GPS: ${lat}, ${lng}` : 'Clica no mapa para registar as coordenadas GPS.'}</p>
          <Toggle checked={draw} onChange={setDraw} label="Delimitar o terreno no mapa" description="A área total é calculada a partir do polígono." />
          {draw && (
            <PolygonDrawer
              center={hasPoint ? [lng!, lat!] : center}
              value={boundary ?? null}
              onChange={(p, area) => {
                setValue('boundary', p, { shouldDirty: true });
                if (p && area > 0) setValue('totalAreaHa', area, { shouldDirty: true, shouldValidate: true });
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terreno, solo e água</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Área total (ha)" error={e.totalAreaHa?.message}>
              <Input type="number" step="0.01" inputMode="decimal" {...register('totalAreaHa', { setValueAs: num })} />
            </Field>
            <Field label="Área cultivada (ha)" error={e.cultivatedAreaHa?.message}>
              <Input type="number" step="0.01" inputMode="decimal" {...register('cultivatedAreaHa', { setValueAs: num })} />
            </Field>
          </div>
          {(
            [
              ['terrainType', TERRAIN_TYPES, LABELS.terrain, 'Tipo de terreno'],
              ['soilType', SOIL_TYPES, LABELS.soil, 'Tipo de solo'],
              ['waterAvailability', WATER_AVAILABILITY, LABELS.waterAvailability, 'Disponibilidade de água'],
              ['waterSource', WATER_SOURCES, LABELS.waterSource, 'Fonte de água'],
              ['irrigationSystem', IRRIGATION_SYSTEMS, LABELS.irrigation, 'Sistema de irrigação'],
            ] as const
          ).map(([name, options, labels, title]) => (
            <div key={name} className="space-y-2">
              <p className="text-sm font-medium">{title}</p>
              <Chips control={control} name={name} options={options} labels={labels} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Infraestrutura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {toggle('hasElectricity', 'Eletricidade disponível')}
            {toggle('hasPumps', 'Bombas de água')}
            {toggle('hasSensors', 'Sensores instalados')}
            {toggle('hasMachinery', 'Máquinas agrícolas')}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Internet</p>
            <Chips control={control} name="internet" options={CONNECTIVITY} labels={LABELS.connectivity} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Nível tecnológico</p>
            <Chips control={control} name="techLevel" options={TECH_LEVELS} labels={LABELS.techLevel} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objetivos, problemas e orçamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Objetivos</p>
            <Chips control={control} name="goals" multiple options={GOALS} labels={LABELS.goal} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Problemas</p>
            <Chips control={control} name="problems" multiple options={PROBLEMS} labels={LABELS.problem} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Orçamento para tecnologia (Kz)" error={e.budgetKz?.message} hint={budget ? formatKz(budget) : 'Opcional'}>
              <Input type="number" min="0" step="1000" inputMode="numeric" {...register('budgetKz', { setValueAs: numOrNull })} />
            </Field>
            <Field label="Outro objetivo">
              <Textarea rows={2} {...register('otherGoal')} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
      {Object.keys(e).length > 0 && <p className="text-sm text-destructive">Há campos por corrigir.</p>}
      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <Button type="button" variant="ghost" onClick={() => history.back()}>
          Cancelar
        </Button>
        <Button type="submit" loading={formState.isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
