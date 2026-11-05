'use client';
import { ANGOLA_PROVINCES, PROVINCE_CENTER, PROVINCE_CLIMATE, type AngolaProvince } from '@agrogenius/shared';
import { Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import * as React from 'react';
import * as THREE from 'three';
import { pointInRing } from '@/components/maps/geo';
import { latLngToVec3 } from './webgl';
import { AFRICA, ANGOLA, OTHER_LAND, type Ring } from './world-outlines';

const CLIMATE_LABEL = {
  ARID: 'Árido',
  SEMI_ARID: 'Semiárido',
  HIGHLAND: 'Planalto',
  HUMID_TROPICAL: 'Tropical húmido',
  SUBHUMID: 'Sub-húmido',
} as const;

const inAny = (p: [number, number], rings: Ring[]) => rings.some((r) => pointInRing(p, r));

/** Nuvem de pontos de terra numa esfera (distribuição de Fibonacci). */
function useLandPoints(n = 16000) {
  return React.useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    const cAngola = new THREE.Color('#27C77B');
    const cAfrica = new THREE.Color('#B7F3D0');
    const cOther = new THREE.Color('#4A5A52');
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const lat = (Math.asin(y) * 180) / Math.PI;
      const lng = ((((i * golden * 180) / Math.PI) % 360) + 360) % 360 - 180;
      const p: [number, number] = [lng, lat];
      let c: THREE.Color | null = null;
      if (inAny(p, ANGOLA)) c = cAngola;
      else if (inAny(p, AFRICA)) c = cAfrica;
      else if (inAny(p, OTHER_LAND)) c = cOther;
      if (!c) continue;
      pos.push(...latLngToVec3(lat, lng, 1.002));
      col.push(c.r, c.g, c.b);
    }
    return { positions: new Float32Array(pos), colors: new Float32Array(col) };
  }, [n]);
}

function Land() {
  const { positions, colors } = useLandPoints();
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.012} vertexColors sizeAttenuation transparent opacity={0.95} />
    </points>
  );
}

function ProvinceMarker({ name, active, onSelect }: { name: AngolaProvince; active: boolean; onSelect: (n: AngolaProvince) => void }) {
  const [lat, lng] = PROVINCE_CENTER[name];
  const ref = React.useRef<THREE.Mesh>(null);
  const [hover, setHover] = React.useState(false);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar((active || hover ? 1.6 : 1) * (1 + Math.sin(clock.elapsedTime * 2 + lat) * 0.15));
  });
  return (
    <group position={latLngToVec3(lat, lng, 1.01)}>
      <mesh
        ref={ref}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = '';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(name);
        }}
      >
        <sphereGeometry args={[0.009, 12, 12]} />
        <meshBasicMaterial color={active ? '#ffffff' : '#27C77B'} />
      </mesh>
      {(hover || active) && (
        <Html center distanceFactor={4} style={{ pointerEvents: 'none' }}>
          <div className="translate-y-[-18px] whitespace-nowrap rounded-md border border-white/10 bg-night/85 px-2 py-1 text-[11px] text-snow backdrop-blur">
            <b>{name}</b> · {CLIMATE_LABEL[PROVINCE_CLIMATE[name]]}
          </div>
        </Html>
      )}
    </group>
  );
}

function Atmosphere() {
  return (
    <mesh scale={1.12}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={{ c: { value: new THREE.Color('#27C77B') } }}
        vertexShader="varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }"
        fragmentShader="uniform vec3 c; varying vec3 vN; void main(){ float i = pow(0.75 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(c, 1.0) * i; }"
      />
    </mesh>
  );
}

/** Globo interativo: África em destaque, Angola e capitais provinciais clicáveis. */
export default function Globe({ selected, onSelect }: { selected: AngolaProvince | null; onSelect: (p: AngolaProvince) => void }) {
  const cam = latLngToVec3(-8, 16, 2.75);
  const [interacting, setInteracting] = React.useState(false);
  return (
    <Canvas camera={{ position: cam, fov: 40 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} aria-label="Globo 3D com as províncias de Angola">
      <ambientLight intensity={0.6} />
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial color="#0e1f18" roughness={0.9} metalness={0.1} />
      </mesh>
      <Atmosphere />
      <Land />
      {ANGOLA_PROVINCES.map((p) => (
        <ProvinceMarker key={p} name={p} active={selected === p} onSelect={onSelect} />
      ))}
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={1.6}
        maxDistance={4}
        autoRotate={!interacting && !selected}
        autoRotateSpeed={0.35}
        rotateSpeed={0.5}
        onStart={() => setInteracting(true)}
        onEnd={() => setTimeout(() => setInteracting(false), 4000)}
      />
    </Canvas>
  );
}
