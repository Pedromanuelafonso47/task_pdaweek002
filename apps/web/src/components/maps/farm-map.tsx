'use client';
import { LABELS } from '@agrogenius/shared';
import maplibregl from 'maplibre-gl';
import * as React from 'react';
import type { Device, Field, GeoPolygon } from '@/lib/types';
import { cn } from '@/lib/utils';
import { bbox, openRing, type LngLat } from './geo';
import { setGeoJSON, useMapLibre } from './use-map';

export const ZONE_COLORS = ['#27C77B', '#38BDF8', '#F59E0B', '#A78BFA', '#F472B6', '#B7F3D0', '#FB7185', '#34D399'];
export const zoneColor = (f: Pick<Field, 'color'>, i: number) => f.color ?? ZONE_COLORS[i % ZONE_COLORS.length];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Mapa da propriedade: limite, zonas (zonas de irrigação com contorno tracejado azul),
 * dispositivos/sensores com a última leitura.
 */
export default function FarmMap({
  boundary,
  center,
  fields = [],
  devices = [],
  selectedFieldId,
  onSelectField,
  onSelectDevice,
  className,
}: {
  boundary: GeoPolygon | null;
  center: [number, number];
  fields?: Field[];
  devices?: Device[];
  selectedFieldId?: string | null;
  onSelectField?: (id: string) => void;
  onSelectDevice?: (id: string) => void;
  className?: string;
}) {
  const { ref, map } = useMapLibre(center, 13);
  const markers = React.useRef<maplibregl.Marker[]>([]);
  const cbs = React.useRef({ onSelectField, onSelectDevice });
  cbs.current = { onSelectField, onSelectDevice };

  // Camadas
  React.useEffect(() => {
    if (!map) return;
    setGeoJSON(map, 'boundary', { type: 'FeatureCollection', features: boundary ? [{ type: 'Feature', properties: {}, geometry: boundary }] : [] });
    setGeoJSON(map, 'fields', {
      type: 'FeatureCollection',
      features: fields
        .map((f, i) => ({ f, i }))
        .filter(({ f }) => f.boundary)
        .map(({ f, i }) => ({
          type: 'Feature' as const,
          id: i,
          properties: { id: f.id, name: f.name, color: zoneColor(f, i), irrigation: f.isIrrigationZone ? 1 : 0, selected: f.id === selectedFieldId ? 1 : 0 },
          geometry: f.boundary!,
        })),
    });
    if (!map.getLayer('boundary-line')) {
      map.addLayer({ id: 'boundary-fill', type: 'fill', source: 'boundary', paint: { 'fill-color': '#123D2A', 'fill-opacity': 0.15 } });
      map.addLayer({ id: 'boundary-line', type: 'line', source: 'boundary', paint: { 'line-color': '#B7F3D0', 'line-width': 2.5 } });
      map.addLayer({
        id: 'fields-fill',
        type: 'fill',
        source: 'fields',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['==', ['get', 'selected'], 1], 0.55, 0.32] },
      });
      map.addLayer({ id: 'fields-line', type: 'line', source: 'fields', filter: ['==', ['get', 'irrigation'], 0], paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['==', ['get', 'selected'], 1], 3, 1.5] } });
      // Zonas de irrigação: contorno tracejado azul
      map.addLayer({ id: 'fields-irrig', type: 'line', source: 'fields', filter: ['==', ['get', 'irrigation'], 1], paint: { 'line-color': '#38BDF8', 'line-width': 2.5, 'line-dasharray': [2, 1.5] } });
      // (sem camada de texto: o estilo raster não tem glyphs; o nome aparece ao passar o rato)
      const hover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
      map.on('mousemove', 'fields-fill', (e) => {
        const name = e.features?.[0]?.properties?.name as string | undefined;
        if (name) hover.setLngLat(e.lngLat).setHTML(`<div style="font-size:12px;font-weight:600">${esc(name)}</div>`).addTo(map);
      });
      map.on('mouseleave', 'fields-fill', () => hover.remove());
      map.on('click', 'fields-fill', (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) cbs.current.onSelectField?.(id);
      });
      map.on('mouseenter', 'fields-fill', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'fields-fill', () => (map.getCanvas().style.cursor = ''));
    }
  }, [map, boundary, fields, selectedFieldId]);

  // Enquadramento
  React.useEffect(() => {
    if (!map) return;
    const pts: LngLat[] = [...openRing(boundary), ...fields.flatMap((f) => openRing(f.boundary))];
    for (const d of devices) if (d.longitude !== null && d.latitude !== null) pts.push([d.longitude, d.latitude]);
    const b = bbox(pts);
    if (b && (b[0][0] !== b[1][0] || b[0][1] !== b[1][1])) map.fitBounds(b, { padding: 48, maxZoom: 17, duration: 0 });
    else map.jumpTo({ center: b ? b[0] : center, zoom: b ? 15 : 12 });
  }, [map, boundary, fields, devices, center]);

  // Marcadores de dispositivos
  React.useEffect(() => {
    if (!map) return;
    markers.current.forEach((m) => m.remove());
    markers.current = devices
      .filter((d) => d.latitude !== null && d.longitude !== null)
      .map((d) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.setAttribute('aria-label', d.name);
        const color = d.status === 'ONLINE' ? '#27C77B' : d.status === 'OFFLINE' ? '#ef4444' : '#89958E';
        el.style.cssText = `width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #0B1511;box-shadow:0 0 0 2px ${color}66;cursor:pointer`;
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          cbs.current.onSelectDevice?.(d.id);
        });
        const rows = d.sensors
          .map((s) => `<div style="display:flex;justify-content:space-between;gap:12px"><span>${esc(LABELS.sensorKind[s.kind as keyof typeof LABELS.sensorKind] ?? s.kind)}</span><b>${s.last ? `${s.last.value} ${esc(s.unit)}` : '—'}</b></div>`)
          .join('');
        const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
          `<div style="font-size:12px;min-width:170px"><div style="font-weight:600;margin-bottom:4px">${esc(d.name)}</div><div style="opacity:.7;margin-bottom:6px">${esc(LABELS.deviceStatus[d.status])}</div>${rows || '<i>Sem sensores</i>'}</div>`,
        );
        return new maplibregl.Marker({ element: el }).setLngLat([d.longitude!, d.latitude!]).setPopup(popup).addTo(map);
      });
    return () => markers.current.forEach((m) => m.remove());
  }, [map, devices]);

  return (
    <div className={cn('relative h-[420px] w-full overflow-hidden rounded-lg border', className)}>
      <div ref={ref} className="absolute inset-0" role="application" aria-label="Mapa da propriedade" />
      <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-2 rounded-md bg-night/75 px-2 py-1.5 text-[11px] text-snow backdrop-blur">
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-4 bg-mint" /> Limite
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0 w-4 border-t-2 border-dashed border-sky-400" /> Zona de irrigação
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-tech" /> Dispositivo online
        </span>
      </div>
    </div>
  );
}
