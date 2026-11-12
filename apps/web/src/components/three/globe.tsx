'use client';
import { ANGOLA_PROVINCES, PROVINCE_CENTER, PROVINCE_CLIMATE, type AngolaProvince } from '@agrogenius/shared';
import { Html, Line, OrbitControls, useTexture } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as React from 'react';
import * as THREE from 'three';
import { latLngToVec3 } from './webgl';
import { ANGOLA } from './world-outlines';

const CLIMATE_LABEL = {
  ARID: 'Árido',
  SEMI_ARID: 'Semiárido',
  HIGHLAND: 'Planalto',
  HUMID_TROPICAL: 'Tropical húmido',
  SUBHUMID: 'Sub-húmido',
} as const;

const GOLD = '#F2B33D';

/* ───────────────────────── Shaders ───────────────────────── */

const EARTH_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const EARTH_FRAG = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunDir;
  uniform float time;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPos;

  // Ruído de valor 3D + fbm para nuvens procedurais
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 6; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vPos);
    vec3 L = normalize(sunDir);
    float ndl = dot(N, L);
    float dayMix = smoothstep(-0.18, 0.22, ndl);

    vec3 day = texture2D(dayMap, vUv).rgb;
    // Oceano: o azul-violeta plano da textura é substituído por um azul profundo com reflexo do sol
    float ocean = smoothstep(0.06, 0.16, day.b - max(day.r, day.g));
    vec3 deep = vec3(0.012, 0.055, 0.13);
    vec3 shallow = vec3(0.03, 0.16, 0.30);
    vec3 oceanCol = mix(deep, shallow, pow(1.0 - max(dot(N, V), 0.0), 2.0));
    vec3 surface = mix(pow(day, vec3(0.92)) * 1.08, oceanCol, ocean);

    // Nuvens a deslizar devagar
    vec3 cp = N * 4.2 + vec3(time * 0.01, 0.0, time * 0.005);
    float c = fbm(cp + fbm(cp * 2.1) * 0.8);
    float clouds = smoothstep(0.56, 0.82, c) * 0.7;

    float diffuse = max(ndl, 0.0);
    vec3 lit = surface * (0.06 + 1.05 * diffuse);
    // Brilho especular do sol sobre a água
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 60.0) * ocean * 0.9;
    lit += vec3(1.0, 0.93, 0.8) * spec * (1.0 - clouds);
    lit = mix(lit, vec3(1.0) * (0.12 + 0.95 * diffuse), clouds);

    // Luzes das cidades no lado noturno
    vec3 night = texture2D(nightMap, vUv).rgb;
    float lum = dot(night, vec3(0.299, 0.587, 0.114));
    vec3 cityLights = night * smoothstep(0.22, 0.55, lum) * 2.2 * vec3(1.0, 0.82, 0.55);
    vec3 dark = night * 0.2 + cityLights * (1.0 - clouds * 0.7);

    vec3 col = mix(dark, lit, dayMix);

    // Dispersão atmosférica na borda
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += vec3(0.30, 0.58, 1.0) * fres * (0.25 + 0.75 * dayMix) * 0.9;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const ATMO_FRAG = /* glsl */ `
  uniform vec3 sunDir;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vPos);
    // Faces de trás da casca: 0 na borda exterior, máximo junto ao limbo da Terra (~0,48 para escala 1,14)
    float glow = pow(clamp(-dot(N, V) / 0.48, 0.0, 1.0), 3.0);
    float lit = smoothstep(-0.4, 0.5, dot(N, normalize(sunDir)));
    vec3 col = mix(vec3(0.12, 0.28, 0.85), vec3(0.42, 0.70, 1.0), lit);
    vec3 c = col * glow * (0.3 + 0.9 * lit);
    gl_FragColor = vec4(c, max(c.b, max(c.r, c.g)));
  }
`;

/* ───────────────────────── Peças ───────────────────────── */

function Earth() {
  const [day, night] = useTexture(['/images/globe/terra-dia.jpg', '/images/globe/terra-noite.jpg']);
  const gl = useThree((s) => s.gl);
  React.useMemo(() => {
    for (const t of [day, night]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    }
  }, [day, night, gl]);

  const uniforms = React.useMemo(
    () => ({ dayMap: { value: day }, nightMap: { value: night }, sunDir: { value: new THREE.Vector3(1, 0.3, 1) }, time: { value: 0 } }),
    [day, night],
  );
  const atmoUniforms = React.useMemo(() => ({ sunDir: uniforms.sunDir }), [uniforms]);

  // O sol acompanha a câmara, ligeiramente de lado: a face visível fica de dia e a linha dia/noite aparece na borda.
  const tmp = React.useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, clock }) => {
    uniforms.time.value = clock.elapsedTime;
    const right = tmp.set(1, 0, 0).applyQuaternion(camera.quaternion);
    uniforms.sunDir.value.copy(camera.position).normalize().multiplyScalar(0.55).addScaledVector(right, 0.85).add(new THREE.Vector3(0, 0.25, 0)).normalize();
  });

  return (
    <>
      <mesh>
        <sphereGeometry args={[1, 128, 128]} />
        <shaderMaterial vertexShader={EARTH_VERT} fragmentShader={EARTH_FRAG} uniforms={uniforms} />
      </mesh>
      <mesh scale={1.14}>
        <sphereGeometry args={[1, 96, 96]} />
        <shaderMaterial
          vertexShader={ATMO_VERT}
          fragmentShader={ATMO_FRAG}
          uniforms={atmoUniforms}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}

/** Contorno de Angola, a dourado, ligeiramente acima da superfície. */
function AngolaOutline() {
  const rings = React.useMemo(
    () => ANGOLA.map((ring) => ring.map(([lng, lat]) => new THREE.Vector3(...latLngToVec3(lat, lng, 1.003)))),
    [],
  );
  return (
    <>
      {rings.map((pts, i) => (
        <Line key={i} points={pts} color={GOLD} lineWidth={1.6} transparent opacity={0.95} />
      ))}
    </>
  );
}

function ProvinceMarker({ name, active, onSelect }: { name: AngolaProvince; active: boolean; onSelect: (n: AngolaProvince) => void }) {
  const [lat, lng] = PROVINCE_CENTER[name];
  const ref = React.useRef<THREE.Mesh>(null);
  const [hover, setHover] = React.useState(false);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar((active || hover ? 1.7 : 1) * (1 + Math.sin(clock.elapsedTime * 2 + lat) * 0.15));
  });
  return (
    <group position={latLngToVec3(lat, lng, 1.006)}>
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
        <sphereGeometry args={[0.008, 16, 16]} />
        <meshBasicMaterial color={active ? '#ffffff' : GOLD} toneMapped={false} />
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

/** Globo realista (texturas NASA): Angola contornada e capitais provinciais clicáveis. */
export default function Globe({ selected, onSelect }: { selected: AngolaProvince | null; onSelect: (p: AngolaProvince) => void }) {
  const cam = latLngToVec3(-10, 18, 3.35);
  const [interacting, setInteracting] = React.useState(false);
  return (
    <Canvas camera={{ position: cam, fov: 40 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} aria-label="Globo 3D com as províncias de Angola">
      <React.Suspense fallback={null}>
        <Earth />
        <AngolaOutline />
        {ANGOLA_PROVINCES.map((p) => (
          <ProvinceMarker key={p} name={p} active={selected === p} onSelect={onSelect} />
        ))}
      </React.Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={1.6}
        maxDistance={4}
        autoRotate={!interacting && !selected}
        autoRotateSpeed={0.3}
        rotateSpeed={0.5}
        onStart={() => setInteracting(true)}
        onEnd={() => setTimeout(() => setInteracting(false), 4000)}
      />
    </Canvas>
  );
}
