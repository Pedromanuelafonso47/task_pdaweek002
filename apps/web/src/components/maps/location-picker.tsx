'use client';
import maplibregl from 'maplibre-gl';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { useMapLibre } from './use-map';

/** Clicar no mapa define a localização (lat/lng). */
export default function LocationPicker({
  value,
  onChange,
  center,
  className,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
  center: [number, number];
  className?: string;
}) {
  const { ref, map } = useMapLibre(value ? [value.lng, value.lat] : center, value ? 13 : 9);
  const marker = React.useRef<maplibregl.Marker | null>(null);
  const cb = React.useRef(onChange);
  cb.current = onChange;

  React.useEffect(() => {
    if (!map) return;
    const click = (e: maplibregl.MapMouseEvent) => cb.current({ lat: +e.lngLat.lat.toFixed(6), lng: +e.lngLat.lng.toFixed(6) });
    map.on('click', click);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', click);
    };
  }, [map]);

  React.useEffect(() => {
    if (!map) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      const m = new maplibregl.Marker({ color: '#27C77B', draggable: true }).setLngLat([value.lng, value.lat]).addTo(map);
      m.on('dragend', () => {
        const p = m.getLngLat();
        cb.current({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
      });
      marker.current = m;
    } else marker.current.setLngLat([value.lng, value.lat]);
  }, [map, value]);

  // Recentrar quando o centro de referência muda (p.ex. mudou a província) e não há ponto marcado
  React.useEffect(() => {
    if (map && !value) map.flyTo({ center, zoom: 9 });
  }, [map, center, value]);

  React.useEffect(() => {
    if (map && value) map.flyTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 13) });
  }, [map, value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} className={cn('h-72 w-full overflow-hidden rounded-lg border', className)} role="application" aria-label="Mapa: clica para marcar a localização" />;
}
