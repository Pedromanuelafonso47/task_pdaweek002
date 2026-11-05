'use client';
import '@/features/onboarding/zod-pt';
import { LABELS, SOIL_TYPES, fieldCreateSchema, type FieldCreateInput } from '@agrogenius/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Droplets, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FarmMap, PolygonDrawer } from '@/components/maps';
import { ZONE_COLORS } from '@/components/maps/farm-map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/feedback';
import { Field as FormField, Input, Select, Textarea, Toggle } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { Device, Field, GeoPolygon } from '@/lib/types';
import { cn, fmtNum } from '@/lib/utils';
import { num } from '@/features/onboarding/zod-pt';

function FieldDialog({
  open,
  onOpenChange,
  farmId,
  field,
  boundary,
  center,
  usedArea,
  cultivatedAreaHa,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  farmId: string;
  field: Field | null;
  boundary: GeoPolygon | null;
  center: [number, number];
  usedArea: number;
  cultivatedAreaHa: number;
}) {
  const qc = useQueryClient();
  const form = useForm<FieldCreateInput>({
    resolver: zodResolver(fieldCreateSchema) as never,
    values: field
      ? { name: field.name, areaHa: Number(field.areaHa), boundary: field.boundary, soilType: (field.soilType as FieldCreateInput['soilType']) ?? null, isIrrigationZone: field.isIrrigationZone, color: field.color ?? undefined, notes: field.notes ?? '' }
      : { name: '', areaHa: undefined as never, boundary: null, soilType: null, isIrrigationZone: false, color: ZONE_COLORS[0], notes: '' },
  });
  const { register, control, setValue, watch, handleSubmit, formState } = form;
  const color = watch('color');
  const areaHa = watch('areaHa');

  const save = useMutation({
    mutationFn: (v: FieldCreateInput) =>
      field ? api(`/farms/${farmId}/fields/${field.id}`, { method: 'PATCH', body: v }) : api(`/farms/${farmId}/fields`, { method: 'POST', body: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farm', farmId] });
      qc.invalidateQueries({ queryKey: ['farms'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(field ? 'Zona atualizada' : 'Zona criada');
      onOpenChange(false);
    },
  });
  const remaining = cultivatedAreaHa - usedArea + (field ? Number(field.areaHa) : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={field ? `Editar ${field.name}` : 'Nova zona agrícola'} description="Desenha a zona no mapa para calcular a área, ou indica-a manualmente." className="max-w-2xl">
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nome" error={formState.errors.name?.message}>
              <Input placeholder="Ex.: Zona Norte" {...register('name')} />
            </FormField>
            <FormField label="Área (ha)" error={formState.errors.areaHa?.message} hint={remaining > 0 ? `Área cultivada ainda por atribuir: ${fmtNum(remaining, 2)} ha` : undefined}>
              <Input type="number" step="0.01" inputMode="decimal" {...register('areaHa', { setValueAs: num })} />
            </FormField>
          </div>
          {open && (
            <Controller
              control={control}
              name="boundary"
              render={({ field: f }) => (
                <PolygonDrawer
                  center={center}
                  value={f.value ?? null}
                  context={boundary ? [{ polygon: boundary, color: '#B7F3D0' }] : []}
                  onChange={(p, area) => {
                    f.onChange(p);
                    if (p && area > 0) setValue('areaHa', area, { shouldValidate: true });
                  }}
                />
              )}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Tipo de solo (se diferente da propriedade)">
              <Select {...register('soilType', { setValueAs: (v) => (v ? v : null) })}>
                <option value="">Igual ao da propriedade</option>
                {SOIL_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {LABELS.soil[s]}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium">Cor</p>
              <div className="flex flex-wrap gap-2">
                {ZONE_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setValue('color', c)}
                    aria-label={`Cor ${c}`}
                    aria-pressed={color === c}
                    className={cn('size-7 rounded-full border-2 transition-transform', color === c ? 'scale-110 border-foreground' : 'border-transparent')}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <Controller
            control={control}
            name="isIrrigationZone"
            render={({ field: f }) => <Toggle checked={!!f.value} onChange={f.onChange} label="Zona de irrigação" description="Zona servida por uma válvula/sector de rega" />}
          />
          <FormField label="Notas">
            <Textarea rows={2} {...register('notes')} />
          </FormField>
          {Number(areaHa) > remaining + 0.001 && <p className="text-xs text-warning">A soma das zonas ultrapassa a área cultivada da propriedade.</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              Guardar zona
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FieldsManager({
  farmId,
  fields,
  devices,
  boundary,
  center,
  cultivatedAreaHa,
  canEdit,
}: {
  farmId: string;
  fields: Field[];
  devices: Device[];
  boundary: GeoPolygon | null;
  center: [number, number];
  cultivatedAreaHa: number;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = React.useState<Field | null>(null);
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const used = fields.reduce((s, f) => s + Number(f.areaHa), 0);

  const remove = useMutation({
    mutationFn: (id: string) => api(`/farms/${farmId}/fields/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farm', farmId] });
      qc.invalidateQueries({ queryKey: ['farms'] });
      toast.success('Zona removida');
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <FarmMap boundary={boundary} center={center} fields={fields} devices={devices} selectedFieldId={selected} onSelectField={setSelected} />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display font-semibold">Zonas agrícolas</p>
            <p className="num text-xs text-muted-foreground">
              {fmtNum(used, 2)} de {fmtNum(cultivatedAreaHa, 2)} ha cultivados atribuídos
            </p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> Zona
            </Button>
          )}
        </div>
        {fields.length === 0 ? (
          <EmptyState title="Sem zonas" description="Dividir a propriedade em zonas permite dimensionar sensores e válvulas com precisão." className="py-8" />
        ) : (
          <ul className="space-y-2">
            {fields.map((f, i) => (
              <li
                key={f.id}
                className={cn('flex items-center gap-3 rounded-md border p-3 transition-colors', selected === f.id && 'border-primary/60 bg-primary/5')}
                onMouseEnter={() => setSelected(f.id)}
              >
                <span className="size-3 shrink-0 rounded-full" style={{ background: f.color ?? ZONE_COLORS[i % ZONE_COLORS.length] }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtNum(f.areaHa, 2)} ha {f.boundary ? '· delimitada' : '· sem polígono'}
                  </p>
                </div>
                {f.isIrrigationZone && (
                  <Badge tone="blue">
                    <Droplets /> Rega
                  </Badge>
                )}
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${f.name}`}
                      onClick={() => {
                        setEditing(f);
                        setOpen(true);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover ${f.name}`}
                      onClick={() => confirm(`Remover a zona "${f.name}"? As plantações deixam de estar associadas a ela.`) && remove.mutate(f.id)}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <FieldDialog open={open} onOpenChange={setOpen} farmId={farmId} field={editing} boundary={boundary} center={center} usedArea={used} cultivatedAreaHa={cultivatedAreaHa} />
    </div>
  );
}
