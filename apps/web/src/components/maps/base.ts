import type { StyleSpecification } from 'maplibre-gl';

/**
 * Mapa base: OpenStreetMap (raster). Não simulamos imagens de satélite.
 *
 * PONTO DE EXTENSÃO (futuro): para imagens de satélite e índices de vegetação (NDVI),
 * acrescentar aqui uma fonte raster adicional — p.ex. tiles Sentinel-2 processados
 * no backend (/api/farms/:id/ndvi/{z}/{x}/{y}.png) — e uma camada com opacidade
 * controlada pelo utilizador. O resto dos componentes não precisa de mudar.
 */
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

/** Centro de Angola (fallback). */
export const ANGOLA_CENTER: [number, number] = [17.5, -12.3];
