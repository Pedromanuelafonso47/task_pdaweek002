'use client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as React from 'react';
import { OSM_STYLE } from './base';

/** Cria e destrói um mapa MapLibre; devolve a instância quando o estilo está carregado. */
export function useMapLibre(center: [number, number], zoom: number) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [map, setMap] = React.useState<maplibregl.Map | null>(null);
  const init = React.useRef({ center, zoom });

  React.useEffect(() => {
    if (!ref.current) return;
    const m = new maplibregl.Map({
      container: ref.current,
      style: OSM_STYLE,
      center: init.current.center,
      zoom: init.current.zoom,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => setMap(m));
    return () => {
      setMap(null);
      m.remove();
    };
  }, []);

  return { ref, map };
}

export function setGeoJSON(map: maplibregl.Map, id: string, data: GeoJSON.FeatureCollection) {
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (src) src.setData(data);
  else map.addSource(id, { type: 'geojson', data });
}
