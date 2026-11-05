import type { GeoPolygon } from '@/lib/types';

export type LngLat = [number, number];

const R = 6378137; // raio equatorial WGS84 (m)
const rad = (d: number) => (d * Math.PI) / 180;

/** Área geodésica de um anel (lon/lat) em m² — fórmula do excesso esférico (Chamberlain & Duquette). */
export function ringAreaM2(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [l1, p1] = ring[i];
    const [l2, p2] = ring[(i + 1) % ring.length];
    total += rad(l2 - l1) * (2 + Math.sin(rad(p1)) + Math.sin(rad(p2)));
  }
  return Math.abs((total * R * R) / 2);
}

export const polygonAreaHa = (p: GeoPolygon | null | undefined) => (p ? Math.round((ringAreaM2(p.coordinates[0]) / 10_000) * 100) / 100 : 0);

/** Fecha o anel e cria um GeoJSON Polygon a partir de vértices abertos. */
export function toPolygon(vertices: LngLat[]): GeoPolygon | null {
  if (vertices.length < 3) return null;
  return { type: 'Polygon', coordinates: [[...vertices, vertices[0]]] };
}

export function openRing(p: GeoPolygon | null | undefined): LngLat[] {
  if (!p) return [];
  const r = p.coordinates[0] as LngLat[];
  return r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r;
}

export function centroid(ring: LngLat[]): LngLat {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] ? ring.slice(0, -1) : ring;
  const s = pts.reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
  return [s[0] / pts.length, s[1] / pts.length];
}

export function bbox(points: LngLat[]): [LngLat, LngLat] | null {
  if (!points.length) return null;
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

/** Ray casting (lon/lat). */
export function pointInRing([x, y]: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
