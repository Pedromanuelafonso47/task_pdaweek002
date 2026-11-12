'use client';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import * as React from 'react';
import * as THREE from 'three';
import { openRing, type LngLat } from '@/components/maps/geo';
import type { Device, Field, GeoPolygon, Sensor } from '@/lib/types';

export type SceneSelection = { type: 'field'; id: string } | { type: 'sensor'; id: string } | { type: 'device'; id: string } | null;

const ZONE_COLORS = ['#27C77B', '#38BDF8', '#F59E0B', '#A78BFA', '#F472B6', '#B7F3D0', '#FB7185', '#34D399'];
const TERRAIN_H = 0.35;
const SIZE = 10;

export function sensorState(s: Sensor): 'none' | 'low' | 'high' | 'ok' {
  if (!s.last) return 'none';
  if (s.minThreshold !== null && s.last.value < s.minThreshold) return 'low';
  if (s.maxThreshold !== null && s.last.value > s.maxThreshold) return 'high';
  return 'ok';
}
const STATE_COLOR = { none: '#89958E', low: '#F59E0B', high: '#ef4444', ok: '#27C77B' } as const;

interface Layout {
  terrain: [number, number][];
  fields: { field: Field; pts: [number, number][]; color: string; approx: boolean }[];
  devices: { device: Device; pos: [number, number]; approx: boolean }[];
  illustrative: boolean;
}

/** Projeta lon/lat para metros locais e normaliza para a cena; cria formas ilustrativas quando faltam polígonos. */
export function buildLayout(boundary: GeoPolygon | null, totalAreaHa: number, fields: Field[], devices: Device[]): Layout {
  const ring = openRing(boundary);
  const anchor: LngLat | null = ring.length
    ? [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]
    : (fields.find((f) => f.boundary) ? openRing(fields.find((f) => f.boundary)!.boundary)[0] : null);
  const k = anchor ? Math.cos((anchor[1] * Math.PI) / 180) : 1;
  const proj = ([lng, lat]: LngLat): [number, number] => (anchor ? [(lng - anchor[0]) * 111_320 * k, (lat - anchor[1]) * 110_540] : [0, 0]);

  let terrain: [number, number][];
  let illustrative = false;
  if (ring.length >= 3) terrain = ring.map(proj);
  else {
    illustrative = true;
    const a = Math.max(totalAreaHa, 0.01) * 10_000;
    const w = Math.sqrt(a * 1.5);
    const h = a / w;
    terrain = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  }
  const xs = terrain.map((p) => p[0]);
  const ys = terrain.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const extent = Math.max(maxX - minX, maxY - minY, 1);
  const s = SIZE / extent;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const norm = (p: [number, number]): [number, number] => [(p[0] - cx) * s, (p[1] - cy) * s];

  // Zonas sem polígono: faixas proporcionais à área, dispostas ao longo do terreno
  const withoutShape = fields.filter((f) => !f.boundary || !anchor);
  const totalNoShape = withoutShape.reduce((t, f) => t + Number(f.areaHa), 0) || 1;
  let cursor = minX;
  const stripW = maxX - minX;
  const fieldsOut = fields.map((f, i) => {
    const color = f.color ?? ZONE_COLORS[i % ZONE_COLORS.length];
    if (f.boundary && anchor) return { field: f, pts: openRing(f.boundary).map(proj).map(norm), color, approx: false };
    const w = (Number(f.areaHa) / Math.max(totalNoShape, totalAreaHa)) * stripW;
    const pts: [number, number][] = [[cursor, minY], [cursor + w, minY], [cursor + w, maxY], [cursor, maxY]];
    cursor += w;
    return { field: f, pts: pts.map((p) => norm([p[0] * 0.96 + cx * 0.04, p[1] * 0.92 + cy * 0.08])), color, approx: true };
  });

  const devOut = devices.map((d, i) => {
    if (d.latitude !== null && d.longitude !== null && anchor) return { device: d, pos: norm(proj([d.longitude, d.latitude])), approx: false };
    const fz = fieldsOut.find((f) => f.field.id === d.fieldId);
    if (fz) {
      const c = fz.pts.reduce((a, p) => [a[0] + p[0] / fz.pts.length, a[1] + p[1] / fz.pts.length], [0, 0]);
      return { device: d, pos: [c[0] + i * 0.4, c[1]] as [number, number], approx: true };
    }
    return { device: d, pos: [-SIZE / 2 + 1 + i * 1.2, -SIZE / 2 + 1] as [number, number], approx: true };
  });

  return { terrain: terrain.map(norm), fields: fieldsOut, devices: devOut, illustrative };
}

function shapeFrom(pts: [number, number][]) {
  const sh = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  return sh;
}

function Terrain({ pts }: { pts: [number, number][] }) {
  const geo = React.useMemo(() => new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: TERRAIN_H, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), [pts]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
      <meshStandardMaterial color="#5b4630" roughness={1} />
    </mesh>
  );
}

function Zone({ z, selected, onSelect }: { z: Layout['fields'][number]; selected: boolean; onSelect: () => void }) {
  const geo = React.useMemo(() => new THREE.ShapeGeometry(shapeFrom(z.pts)), [z.pts]);
  const mat = React.useRef<THREE.MeshStandardMaterial>(null);
  const [hover, setHover] = React.useState(false);
  useFrame(({ clock }) => {
    if (mat.current && z.field.isIrrigationZone) mat.current.emissiveIntensity = 0.25 + Math.sin(clock.elapsedTime * 2) * 0.15;
  });
  const outline = React.useMemo(() => [...z.pts, z.pts[0]].map(([x, y]) => new THREE.Vector3(x, TERRAIN_H + 0.08, -y)), [z.pts]);
  const c = z.pts.reduce((a, p) => [a[0] + p[0] / z.pts.length, a[1] + p[1] / z.pts.length], [0, 0]);
  return (
    <group>
      <mesh
        geometry={geo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, TERRAIN_H + 0.06, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = '';
        }}
      >
        <meshStandardMaterial
          ref={mat}
          color={z.color}
          transparent
          opacity={selected ? 0.95 : hover ? 0.85 : 0.7}
          emissive={z.field.isIrrigationZone ? '#38BDF8' : z.color}
          emissiveIntensity={selected ? 0.35 : 0.08}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Line points={outline} color={z.field.isIrrigationZone ? '#38BDF8' : selected ? '#ffffff' : z.color} lineWidth={selected ? 3 : 1.5} dashed={z.field.isIrrigationZone} dashSize={0.25} gapSize={0.15} />
      {(hover || selected) && (
        <Html position={[c[0], TERRAIN_H + 0.6, -c[1]]} center style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-md border border-white/10 bg-night/85 px-2 py-1 text-[11px] text-snow backdrop-blur">
            <b>{z.field.name}</b> · {Number(z.field.areaHa)} ha{z.field.isIrrigationZone ? ' · rega' : ''}
          </div>
        </Html>
      )}
    </group>
  );
}

function SensorMarker({ sensor, pos, selected, onSelect }: { sensor: Sensor; pos: [number, number, number]; selected: boolean; onSelect: () => void }) {
  const st = sensorState(sensor);
  const ref = React.useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current && (st === 'low' || st === 'high')) ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.2);
  });
  return (
    <group position={pos}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.7, 8]} />
        <meshStandardMaterial color="#cbd5d0" />
      </mesh>
      <mesh
        ref={ref}
        position={[0, 0.75, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[selected ? 0.17 : 0.13, 16, 16]} />
        <meshStandardMaterial color={STATE_COLOR[st]} emissive={STATE_COLOR[st]} emissiveIntensity={0.6} />
      </mesh>
      <Html position={[0, 1.05, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
        <div className="num whitespace-nowrap rounded bg-night/80 px-1.5 py-0.5 text-[10px] font-medium text-snow">
          {sensor.last ? `${sensor.last.value}${sensor.unit === '%' ? '%' : ` ${sensor.unit}`}` : '—'}
        </div>
      </Html>
    </group>
  );
}

export default function FarmScene({
  boundary,
  totalAreaHa,
  fields,
  devices,
  selection,
  onSelect,
}: {
  boundary: GeoPolygon | null;
  totalAreaHa: number;
  fields: Field[];
  devices: Device[];
  selection: SceneSelection;
  onSelect: (s: SceneSelection) => void;
}) {
  const layout = React.useMemo(() => buildLayout(boundary, totalAreaHa, fields, devices), [boundary, totalAreaHa, fields, devices]);
  const border = React.useMemo(() => [...layout.terrain, layout.terrain[0]].map(([x, y]) => new THREE.Vector3(x, TERRAIN_H + 0.1, -y)), [layout.terrain]);
  return (
    <Canvas shadows camera={{ position: [0, 9, 11], fov: 42 }} dpr={[1, 2]} onPointerMissed={() => onSelect(null)} aria-label="Vista 3D da propriedade">
      <color attach="background" args={['#0A1322']} />
      <fog attach="fog" args={['#0A1322', 18, 34]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 12, 6]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
      <hemisphereLight args={['#B7F3D0', '#123D2A', 0.4]} />
      <gridHelper args={[30, 30, '#1d3a2c', '#14271f']} position={[0, -0.01, 0]} />
      <Terrain pts={layout.terrain} />
      <Line points={border} color="#B7F3D0" lineWidth={2} />
      {layout.fields.map((z) => (
        <Zone key={z.field.id} z={z} selected={selection?.type === 'field' && selection.id === z.field.id} onSelect={() => onSelect({ type: 'field', id: z.field.id })} />
      ))}
      {layout.devices.flatMap(({ device, pos }) =>
        device.sensors.map((s, i) => {
          const ang = (i / Math.max(device.sensors.length, 1)) * Math.PI * 2;
          const r = device.sensors.length > 1 ? 0.35 : 0;
          return (
            <SensorMarker
              key={s.id}
              sensor={s}
              pos={[pos[0] + Math.cos(ang) * r, TERRAIN_H + 0.05, -(pos[1] + Math.sin(ang) * r)]}
              selected={selection?.type === 'sensor' && selection.id === s.id}
              onSelect={() => onSelect({ type: 'sensor', id: s.id })}
            />
          );
        }),
      )}
      {layout.devices
        .filter(({ device }) => !device.sensors.length)
        .map(({ device, pos }) => (
          <mesh key={device.id} position={[pos[0], TERRAIN_H + 0.25, -pos[1]]} onClick={(e) => (e.stopPropagation(), onSelect({ type: 'device', id: device.id }))}>
            <boxGeometry args={[0.35, 0.35, 0.35]} />
            <meshStandardMaterial color={device.status === 'ONLINE' ? '#27C77B' : '#89958E'} />
          </mesh>
        ))}
      <OrbitControls enablePan maxPolarAngle={Math.PI / 2.2} minDistance={5} maxDistance={26} enableDamping />
    </Canvas>
  );
}
