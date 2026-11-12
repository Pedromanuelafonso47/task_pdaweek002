'use client';
import { Check, Eraser, Undo2 } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import type { GeoPolygon } from '@/lib/types';
import { cn, fmtNum } from '@/lib/utils';
import { bbox, openRing, polygonAreaHa, toPolygon, type LngLat } from './geo';
import { setGeoJSON, useMapLibre } from './use-map';

/**
 * Desenhar um polígono clicando nos vértices. A área é calculada geodesicamente
 * e exposta via onChange(polygon, areaHa). `context` mostra polígonos de referência
 * (ex.: limite da propriedade ao desenhar uma zona).
 */
export default function PolygonDrawer({
  value,
  onChange,
  center,
  context = [],
  className,
}: {
  value: GeoPolygon | null;
  onChange: (p: GeoPolygon | null, areaHa: number) => void;
  center: [number, number];
  context?: { polygon: GeoPolygon; color?: string; label?: string }[];
  className?: string;
}) {
  const [vertices, setVertices] = React.useState<LngLat[]>(() => openRing(value));
  const [closed, setClosed] = React.useState(!!value);
  const { ref, map } = useMapLibre(center, 13);
  const cb = React.useRef(onChange);
  cb.current = onChange;
  const closedRef = React.useRef(closed);
  closedRef.current = closed;

  React.useEffect(() => {
    if (!map) return;
    map.getCanvas().style.cursor = 'crosshair';
    const click = (e: maplibregl.MapMouseEvent) => {
      if (closedRef.current) return;
      setVertices((v) => [...v, [+e.lngLat.lng.toFixed(7), +e.lngLat.lat.toFixed(7)]]);
    };
    map.on('click', click);

    // Enquadrar
    const pts = [...openRing(value), ...context.flatMap((c) => openRing(c.polygon))];
    const b = bbox(pts);
    if (b) map.fitBounds(b, { padding: 40, maxZoom: 17, duration: 0 });

    map.addSource('ctx', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: context.map((c) => ({ type: 'Feature', properties: { color: c.color ?? '#B7F3D0' }, geometry: c.polygon })) },
    });
    map.addLayer({ id: 'ctx-line', type: 'line', source: 'ctx', paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [2, 2] } });
    setGeoJSON(map, 'draw', { type: 'FeatureCollection', features: [] });
    map.addLayer({ id: 'draw-fill', type: 'fill', source: 'draw', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#27C77B', 'fill-opacity': 0.25 } });
    map.addLayer({ id: 'draw-line', type: 'line', source: 'draw', filter: ['!=', '$type', 'Point'], paint: { 'line-color': '#27C77B', 'line-width': 2.5 } });
    map.addLayer({ id: 'draw-pts', type: 'circle', source: 'draw', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#0A1322', 'circle-stroke-color': '#27C77B', 'circle-stroke-width': 2 } });
    return () => {
      map.off('click', click);
    };
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!map) return;
    const features: GeoJSON.Feature[] = vertices.map((v) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: v } }));
    if (closed && vertices.length >= 3) features.push({ type: 'Feature', properties: {}, geometry: toPolygon(vertices)! });
    else if (vertices.length >= 2) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: vertices } });
    setGeoJSON(map, 'draw', { type: 'FeatureCollection', features });
  }, [map, vertices, closed]);

  const poly = closed ? toPolygon(vertices) : null;
  const area = polygonAreaHa(toPolygon(vertices));

  const close = () => {
    const p = toPolygon(vertices);
    if (!p) return;
    setClosed(true);
    cb.current(p, polygonAreaHa(p));
  };
  const undo = () => {
    if (closed) {
      setClosed(false);
      cb.current(null, 0);
      return;
    }
    setVertices((v) => v.slice(0, -1));
  };
  const clear = () => {
    setVertices([]);
    setClosed(false);
    cb.current(null, 0);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div ref={ref} className="h-80 w-full overflow-hidden rounded-lg border" role="application" aria-label="Mapa: clica para adicionar vértices do polígono" />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={undo} disabled={!vertices.length}>
          <Undo2 /> {closed ? 'Reabrir' : 'Desfazer ponto'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={clear} disabled={!vertices.length}>
          <Eraser /> Limpar
        </Button>
        <Button type="button" size="sm" onClick={close} disabled={closed || vertices.length < 3}>
          <Check /> Fechar polígono
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {vertices.length} vértice(s)
          {vertices.length >= 3 && (
            <>
              {' · '}
              <span className="num font-medium text-foreground">{fmtNum(area, 2)} ha</span>
              {!poly && ' (por fechar)'}
            </>
          )}
        </span>
      </div>
    </div>
  );
}
