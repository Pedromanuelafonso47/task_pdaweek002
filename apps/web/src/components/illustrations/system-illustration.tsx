import * as React from 'react';
import type { IllustrationKind } from '@/content/project-media';
import { cn } from '@/lib/utils';

/**
 * Ilustrações técnicas animadas de cada sistema "a funcionar".
 * Ciclo de 10 s sincronizado com a legenda de passos (classes .ag-* em globals.css).
 * Cenas autónomas (fundo próprio): legíveis em tema claro e escuro.
 */

const C = {
  skyTop: '#0A1322',
  skyBottom: '#17402D',
  soilTop: '#5A3D26',
  soilBottom: '#2A1B10',
  grass: '#27C77B',
  leaf: '#3FB872',
  leafDark: '#1F7A4C',
  mint: '#B7F3D0',
  water: '#4FB3FF',
  waterDeep: '#1F7FD1',
  metal: '#9AA7A0',
  metalDark: '#5E6B64',
  box: '#E9EFEA',
  sun: '#F2C14E',
  ink: '#0A1322',
  alert: '#FF8A4C',
};

const STEP_DELAYS = ['0s', '-7.5s', '-5s', '-2.5s'];

export interface Step {
  title: string;
  text: string;
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.skyTop} />
        <stop offset="1" stopColor={C.skyBottom} />
      </linearGradient>
      <linearGradient id={`${id}-soil`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.soilTop} />
        <stop offset="1" stopColor={C.soilBottom} />
      </linearGradient>
      <radialGradient id={`${id}-wet`}>
        <stop offset="0" stopColor={C.water} stopOpacity="0.85" />
        <stop offset="1" stopColor={C.water} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-sunglow`}>
        <stop offset="0" stopColor={C.sun} stopOpacity="0.55" />
        <stop offset="1" stopColor={C.sun} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.water} />
        <stop offset="1" stopColor={C.waterDeep} />
      </linearGradient>
      <pattern id={`${id}-grain`} width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="4" r="0.9" fill="#000" opacity="0.25" />
        <circle cx="10" cy="10" r="0.7" fill="#fff" opacity="0.08" />
        <circle cx="11" cy="3" r="0.6" fill="#000" opacity="0.2" />
      </pattern>
    </defs>
  );
}

/** Céu, sol, terreno em corte e erva. */
function Landscape({ id, ground = 210, sun = true, sunX = 560 }: { id: string; ground?: number; sun?: boolean; sunX?: number }) {
  return (
    <g>
      <rect width="640" height="360" fill={`url(#${id}-sky)`} />
      {sun && (
        <>
          <circle cx={sunX} cy="62" r="70" fill={`url(#${id}-sunglow)`} />
          <circle cx={sunX} cy="62" r="18" fill={C.sun} opacity="0.9" />
        </>
      )}
      {/* colinas ao longe */}
      <path d={`M0 ${ground - 26} Q 120 ${ground - 60} 240 ${ground - 30} T 460 ${ground - 34} T 640 ${ground - 40} V ${ground} H0Z`} fill="#123D2A" opacity="0.9" />
      <rect y={ground} width="640" height={360 - ground} fill={`url(#${id}-soil)`} />
      <rect y={ground} width="640" height={360 - ground} fill={`url(#${id}-grain)`} />
      {[0.38, 0.66].map((f) => (
        <path key={f} d={`M0 ${ground + (360 - ground) * f} Q 160 ${ground + (360 - ground) * f - 6} 320 ${ground + (360 - ground) * f} T 640 ${ground + (360 - ground) * f}`} stroke="#000" strokeOpacity="0.18" fill="none" />
      ))}
      <rect y={ground - 3} width="640" height="6" fill={C.leafDark} />
      {Array.from({ length: 40 }).map((_, i) => (
        <path key={i} d={`M${i * 16 + 4} ${ground - 1} l2 -7 l2 7`} fill={C.grass} opacity="0.7" />
      ))}
    </g>
  );
}

function Maize({ x, ground, h = 70, roots = true }: { x: number; ground: number; h?: number; roots?: boolean }) {
  return (
    <g>
      <g className="ag-a ag-sway" style={{ animationDelay: `${(x % 7) * -0.6}s` }}>
        <path d={`M${x} ${ground} V ${ground - h}`} stroke={C.leafDark} strokeWidth="4" strokeLinecap="round" />
        <path d={`M${x} ${ground - h * 0.35} q -26 -8 -34 -30`} stroke={C.leaf} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d={`M${x} ${ground - h * 0.55} q 26 -6 34 -28`} stroke={C.leaf} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d={`M${x} ${ground - h * 0.78} q -18 -6 -22 -22`} stroke={C.leaf} strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx={x + 6} cy={ground - h * 0.6} rx="5" ry="11" fill={C.sun} opacity="0.9" />
        <path d={`M${x} ${ground - h} l -3 -10 m3 10 l 4 -9`} stroke={C.mint} strokeWidth="2" />
      </g>
      {roots && (
        <path
          d={`M${x} ${ground} q -6 20 -18 34 M${x} ${ground} q 4 26 0 48 M${x} ${ground} q 8 18 20 30 M${x - 8} ${ground + 18} q -10 8 -12 18 M${x + 10} ${ground + 16} q 8 10 8 20`}
          stroke="#D9B98C"
          strokeOpacity="0.6"
          strokeWidth="1.6"
          fill="none"
        />
      )}
    </g>
  );
}

function Esp32Box({ x, y, label = 'ESP32' }: { x: number; y: number; label?: string }) {
  return (
    <g>
      <rect x={x} y={y} width="58" height="44" rx="6" fill={C.box} stroke={C.metalDark} />
      <rect x={x + 8} y={y + 9} width="26" height="18" rx="2" fill="#123D2A" />
      <text x={x + 21} y={y + 21} textAnchor="middle" fontSize="6.5" fill={C.mint} fontFamily="monospace">
        {label}
      </text>
      <circle className="ag-blink" cx={x + 46} cy={y + 14} r="3.2" fill={C.grass} />
      <circle cx={x + 46} cy={y + 26} r="2.4" fill={C.alert} opacity="0.5" />
      <path d={`M${x + 50} ${y} v -16`} stroke={C.metalDark} strokeWidth="2" />
      {[0, 0.8, 1.6].map((d) => (
        <path key={d} className="ag-a ag-wave" style={{ animationDelay: `${d}s` }} d={`M${x + 38} ${y - 22} a 14 14 0 0 1 24 0`} stroke={C.mint} strokeWidth="2" fill="none" />
      ))}
    </g>
  );
}

function Hud({ x, y, w = 214, title, children }: { x: number; y: number; w?: number; title: string; children: React.ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="78" rx="10" fill="#0A1322" fillOpacity="0.78" stroke={C.mint} strokeOpacity="0.25" />
      <text x={x + 14} y={y + 20} fontSize="9" letterSpacing="1.4" fill={C.mint} opacity="0.75" fontFamily="sans-serif">
        {title}
      </text>
      {children}
    </g>
  );
}

function StepDot({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g className="ag-step" style={{ animationDelay: STEP_DELAYS[n - 1] }}>
      <circle cx={x} cy={y} r="11" fill={C.grass} stroke={C.ink} strokeWidth="2" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={C.ink} fontFamily="sans-serif">
        {n}
      </text>
    </g>
  );
}

/* ───────────────────────────── Cenas ───────────────────────────── */

function IrrigationScene({ id, drip = false }: { id: string; drip?: boolean }) {
  const g = 210;
  const emitters = [262, 342, 422, 502];
  return (
    <>
      <Landscape id={id} ground={g} sunX={470} />
      {/* depósito / poço com boia */}
      <g>
        <rect x="34" y="112" width="74" height="98" rx="6" fill="#1D2B24" stroke={C.metal} />
        <rect className="ag-a ag-fill-y" x="38" y="128" width="66" height="78" rx="3" fill={`url(#${id}-water)`} opacity="0.85" />
        <ellipse cx="71" cy="112" rx="37" ry="7" fill="#2B3B33" stroke={C.metal} />
        <rect x="88" y="150" width="10" height="6" rx="2" fill={C.sun} />
        <text x="71" y="104" textAnchor="middle" fontSize="8" fill={C.mint} opacity="0.7" fontFamily="sans-serif">
          {drip ? 'DEPÓSITO' : 'POÇO'}
        </text>
      </g>
      {/* bomba */}
      <g>
        <rect x="112" y="184" width="34" height="22" rx="4" fill={C.metalDark} />
        <circle cx="129" cy="195" r="7" fill={C.metal} />
        <path className="ag-a ag-spin" d="M129 189 v12 M123 195 h12" stroke={C.ink} strokeWidth="2" />
      </g>
      {/* tubagem + válvula */}
      <path d={`M146 196 H 196`} stroke={C.metal} strokeWidth="7" strokeLinecap="round" />
      <path className="ag-phase-water ag-flow" d={`M146 196 H 196`} stroke={C.water} strokeWidth="3" />
      <g>
        <rect x="196" y="184" width="26" height="24" rx="4" fill="#2E86DE" stroke={C.ink} />
        <rect x="203" y="176" width="12" height="9" rx="2" fill={C.metalDark} />
        <text className="ag-phase-water" x="209" y="172" textAnchor="middle" fontSize="7" fill={C.water} fontFamily="sans-serif">ABERTA</text>
        <text className="ag-phase-dry" x="209" y="172" textAnchor="middle" fontSize="7" fill={C.metal} fontFamily="sans-serif">FECHADA</text>
      </g>
      {/* linha gota-a-gota */}
      <path d={`M222 ${g - 2} H 590`} stroke="#141E19" strokeWidth="5" strokeLinecap="round" />
      <path className="ag-phase-water ag-flow" d={`M222 ${g - 2} H 590`} stroke={C.water} strokeWidth="2" />
      {emitters.map((x) => (
        <rect key={x} x={x - 3} y={g - 6} width="6" height="7" rx="1.5" fill={C.metalDark} />
      ))}
      {/* bolbo húmido no solo */}
      {emitters.map((x) => (
        <ellipse key={x} className="ag-wet" cx={x} cy={g + 34} rx={drip ? 30 : 34} ry="30" fill={`url(#${id}-wet)`} />
      ))}
      {/* plantas */}
      {[300, 380, 460, 540].map((x) => (
        <Maize key={x} x={x} ground={g} h={74} />
      ))}
      {/* gotas */}
      <g className="ag-phase-water">
        {emitters.map((x, i) =>
          [0, 0.35, 0.7].map((d) => (
            <path key={`${x}-${d}`} className="ag-a ag-drop" style={{ animationDelay: `${d + i * 0.12}s` }} d={`M${x} ${g + 2} q -3 5 0 7 q 3 -2 0 -7z`} fill={C.water} />
          )),
        )}
      </g>
      {!drip && (
        <>
          {/* sensor capacitivo */}
          <g>
            <rect x="404" y={g - 28} width="16" height="24" rx="3" fill="#1F2A6B" stroke={C.mint} strokeOpacity="0.4" />
            <path d={`M406 ${g - 4} v 48 M418 ${g - 4} v 48`} stroke="#C9A227" strokeWidth="3" />
            <circle className="ag-pulse" cx="412" cy={g + 40} r="16" fill="none" stroke={C.mint} strokeOpacity="0.55" strokeDasharray="3 4" />
          </g>
          <path d={`M412 ${g - 28} C 430 ${g - 80}, 540 ${g - 70}, 584 ${g - 96}`} stroke={C.ink} strokeWidth="2" fill="none" />
          {/* poste + controlador */}
          <path d={`M600 ${g} V 98`} stroke={C.metalDark} strokeWidth="5" />
          <Esp32Box x={571} y={86} />
          <StepDot n={1} x={386} y={g - 36} />
          <StepDot n={2} x={556} y={84} />
        </>
      )}
      {drip && (
        <>
          <path d={`M240 ${g} V 104`} stroke={C.metalDark} strokeWidth="5" />
          <Esp32Box x={211} y={92} />
          <StepDot n={1} x={196} y={92} />
          <StepDot n={2} x={150} y={178} />
        </>
      )}
      <StepDot n={3} x={178} y={170} />
      {/* painel de humidade */}
      <Hud x={150} y={20} w={250} title="HUMIDADE DO SOLO · ZONA A">
        <rect x="164" y="52" width="222" height="12" rx="6" fill="#1B2A22" />
        <rect className="ag-fill-x" x="164" y="52" width="62" height="12" rx="6" fill={C.grass} />
        <path d="M230.6 48 v 20" stroke={C.alert} strokeWidth="2" />
        <path d="M263.9 48 v 20" stroke={C.water} strokeWidth="2" />
        <text x="230" y="82" textAnchor="middle" fontSize="8" fill={C.alert} fontFamily="sans-serif">30% liga</text>
        <text x="270" y="82" textAnchor="middle" fontSize="8" fill={C.water} fontFamily="sans-serif">45% para</text>
        <text className="ag-phase-dry" x="386" y="82" textAnchor="end" fontSize="9" fill={C.mint} fontFamily="sans-serif">solo seco → regar</text>
        <text className="ag-phase-water" x="386" y="82" textAnchor="end" fontSize="9" fill={C.water} fontFamily="sans-serif">a regar…</text>
      </Hud>
      <StepDot n={4} x={400} y={20} />
    </>
  );
}

function WeatherScene({ id }: { id: string }) {
  const g = 230;
  return (
    <>
      <Landscape id={id} ground={g} sun />
      {/* nuvem com chuva (fase de rega suspensa) */}
      <g className="ag-phase-water">
        <path d="M70 92 a 26 26 0 0 1 46 -16 a 22 22 0 0 1 40 10 a 18 18 0 0 1 -4 36 h -78 a 16 16 0 0 1 -4 -30z" fill="#C9D4CE" />
        {Array.from({ length: 14 }).map((_, i) => (
          <path key={i} className="ag-a ag-rain" style={{ animationDelay: `${(i % 5) * 0.18}s` }} d={`M${82 + i * 6} ${128 + (i % 3) * 6} l -3 9`} stroke={C.water} strokeWidth="2" strokeLinecap="round" />
        ))}
      </g>
      {/* campo */}
      {[60, 110, 160, 210, 430, 480].map((x) => (
        <Maize key={x} x={x} ground={g} h={56} roots={false} />
      ))}
      {/* mastro */}
      <path d={`M320 ${g} V 70`} stroke={C.metal} strokeWidth="5" />
      <path d="M296 78 H 344" stroke={C.metal} strokeWidth="3" />
      {/* anemómetro */}
      <g className="ag-a ag-spin" style={{ transformOrigin: '320px 62px' }}>
        <path d="M320 62 l 22 0 M320 62 l -11 19 M320 62 l -11 -19" stroke={C.box} strokeWidth="2" />
        <circle cx="342" cy="62" r="5" fill={C.box} />
        <circle cx="309" cy="81" r="5" fill={C.box} />
        <circle cx="309" cy="43" r="5" fill={C.box} />
      </g>
      {/* abrigo de radiação */}
      {[0, 7, 14, 21].map((d) => (
        <rect key={d} x="276" y={118 + d} width="34" height="5" rx="2" fill={C.box} />
      ))}
      {/* pluviómetro */}
      <path d="M346 132 h 22 l -4 26 h -14z" fill={C.box} />
      <rect className="ag-a ag-fill-y" x="352" y="146" width="10" height="11" fill={C.water} opacity="0.85" style={{ animationDirection: 'reverse' }} />
      <Esp32Box x={291} y={170} label="ESTAÇÃO" />
      <StepDot n={1} x={268} y={110} />
      <StepDot n={2} x={380} y={136} />
      {/* telemóvel */}
      <g>
        <rect x="486" y="74" width="88" height="150" rx="12" fill="#0A1322" stroke={C.metal} />
        <rect x="494" y="88" width="72" height="122" rx="6" fill="#123D2A" />
        <text x="530" y="104" textAnchor="middle" fontSize="8" fill={C.mint} fontFamily="sans-serif">AGROCONTROL</text>
        <text x="530" y="126" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="sans-serif">24 °C</text>
        <text x="530" y="140" textAnchor="middle" fontSize="8" fill={C.mint} fontFamily="sans-serif">Humidade 61%</text>
        <g className="ag-phase-water">
          <rect x="499" y="152" width="62" height="46" rx="5" fill={C.water} opacity="0.2" />
          <text x="530" y="168" textAnchor="middle" fontSize="8" fill={C.water} fontFamily="sans-serif">Choveu 12 mm</text>
          <text x="530" y="182" textAnchor="middle" fontSize="7.5" fill="#fff" fontFamily="sans-serif">Rega suspensa</text>
          <text x="530" y="192" textAnchor="middle" fontSize="7.5" fill="#fff" fontFamily="sans-serif">hoje</text>
        </g>
        <g className="ag-phase-dry">
          <rect x="499" y="152" width="62" height="46" rx="5" fill={C.grass} opacity="0.15" />
          <text x="530" y="172" textAnchor="middle" fontSize="8" fill={C.mint} fontFamily="sans-serif">Sem chuva</text>
          <text x="530" y="186" textAnchor="middle" fontSize="7.5" fill="#fff" fontFamily="sans-serif">Rega normal</text>
        </g>
      </g>
      <path d="M350 160 C 410 120, 440 110, 484 120" stroke={C.mint} strokeOpacity="0.5" strokeDasharray="4 5" className="ag-flow" fill="none" />
      <StepDot n={3} x={470} y={112} />
      <StepDot n={4} x={574} y={160} />
    </>
  );
}

function SoilScene({ id }: { id: string }) {
  const g = 150;
  const probes = [
    { x: 210, depth: 70, label: 'Humidade', value: '38 %', color: C.water },
    { x: 330, depth: 110, label: 'pH', value: '5,6', color: C.sun },
    { x: 450, depth: 160, label: 'Temp. solo', value: '22 °C', color: C.alert },
  ];
  return (
    <>
      <Landscape id={id} ground={g} sun={false} />
      {[150, 270, 390, 510].map((x) => (
        <Maize key={x} x={x} ground={g} h={64} />
      ))}
      {/* escala de profundidade */}
      <g fontFamily="sans-serif" fontSize="8" fill={C.mint} opacity="0.65">
        {[0, 15, 30, 45].map((cm, i) => (
          <g key={cm}>
            <path d={`M44 ${g + i * 60} h 10`} stroke={C.mint} />
            <text x="40" y={g + i * 60 + 3} textAnchor="end">
              {cm} cm
            </text>
          </g>
        ))}
        <path d={`M54 ${g} V ${g + 180}`} stroke={C.mint} />
      </g>
      {probes.map((p, i) => (
        <g key={p.x}>
          <rect x={p.x - 7} y={g - 22} width="14" height="20" rx="3" fill="#1F2A6B" />
          <path d={`M${p.x - 3} ${g - 2} V ${g + p.depth} M${p.x + 3} ${g - 2} V ${g + p.depth}`} stroke="#C9A227" strokeWidth="2.5" />
          <circle className="ag-pulse" style={{ animationDelay: `${i * 0.5}s` }} cx={p.x} cy={g + p.depth} r="14" fill={p.color} fillOpacity="0.2" stroke={p.color} strokeOpacity="0.8" />
          <g className="ag-step" style={{ animationDelay: STEP_DELAYS[i] }}>
            <rect x={p.x + 18} y={g + p.depth - 16} width="92" height="32" rx="7" fill="#0A1322" fillOpacity="0.85" stroke={p.color} strokeOpacity="0.6" />
            <text x={p.x + 28} y={g + p.depth - 3} fontSize="8" fill={C.mint} fontFamily="sans-serif">
              {p.label}
            </text>
            <text x={p.x + 28} y={g + p.depth + 10} fontSize="12" fontWeight="700" fill="#fff" fontFamily="sans-serif">
              {p.value}
            </text>
          </g>
          <path d={`M${p.x} ${g - 22} C ${p.x} ${g - 50}, 560 ${g - 70}, 578 ${g - 82}`} stroke={C.ink} strokeWidth="1.5" fill="none" />
        </g>
      ))}
      <Esp32Box x={560} y={48} />
      <StepDot n={4} x={548} y={48} />
    </>
  );
}

function ReservoirScene({ id, pump = false }: { id: string; pump?: boolean }) {
  const g = 250;
  return (
    <>
      <Landscape id={id} ground={g} sun />
      {/* torre e tanque */}
      <path d={`M300 ${g} L 312 150 M392 ${g} L 380 150 M306 200 H 386`} stroke={C.metalDark} strokeWidth="5" />
      <rect x="290" y="56" width="112" height="96" rx="8" fill="#1D2B24" stroke={C.metal} />
      <clipPath id={`${id}-tank`}>
        <rect x="294" y="60" width="104" height="88" rx="6" />
      </clipPath>
      <g clipPath={`url(#${id}-tank)`}>
        <rect className="ag-a ag-level" x="294" y="72" width="104" height="120" fill={`url(#${id}-water)`} opacity="0.85" />
      </g>
      {/* sensor ultrassónico */}
      <rect x="332" y="46" width="28" height="12" rx="3" fill={C.box} />
      {[0, 0.6, 1.2].map((d) => (
        <path key={d} className="ag-a ag-wave" style={{ animationDelay: `${d}s` }} d="M332 70 q 14 10 28 0" stroke={C.mint} strokeWidth="2" fill="none" />
      ))}
      <StepDot n={1} x={372} y={40} />
      {/* poço e bomba de captação */}
      <rect x="86" y={g - 10} width="70" height="100" fill="#1B140D" stroke={C.metalDark} />
      <rect x="90" y={g + 30} width="62" height="56" fill={`url(#${id}-water)`} opacity="0.7" />
      <rect x="110" y={g + 34} width="12" height="7" rx="2" fill={C.sun} />
      <text x="121" y={g + 100} textAnchor="middle" fontSize="8" fill={C.mint} opacity="0.7" fontFamily="sans-serif">boia: há água</text>
      <rect x="160" y={g - 26} width="40" height="24" rx="4" fill={C.metalDark} />
      <circle cx="180" cy={g - 14} r="7" fill={C.metal} />
      <g className="ag-phase-dry">
        <path className="ag-a ag-spin" d={`M180 ${g - 20} v 12 M174 ${g - 14} h 12`} stroke={C.ink} strokeWidth="2" />
      </g>
      <path d={`M200 ${g - 14} H 260 V 120 H 290`} stroke={C.metal} strokeWidth="6" fill="none" />
      <path className="ag-phase-dry ag-flow" d={`M200 ${g - 14} H 260 V 120 H 290`} stroke={C.water} strokeWidth="2.5" fill="none" />
      <StepDot n={3} x={180} y={g - 44} />
      {/* controlador */}
      <path d={`M470 ${g} V 140`} stroke={C.metalDark} strokeWidth="5" />
      <Esp32Box x={441} y={128} label={pump ? 'BOMBA' : 'NÍVEL'} />
      <path d="M346 46 C 380 10, 440 40, 468 124" stroke={C.ink} strokeWidth="1.5" fill="none" />
      <StepDot n={2} x={430} y={122} />
      <Hud x={460} y={196} w={168} title={pump ? 'BOMBA · PROTEÇÃO' : 'RESERVATÓRIO'}>
        <text className="ag-phase-water" x="474" y="240" fontSize="11" fontWeight="700" fill="#fff" fontFamily="sans-serif">
          Cheio · 92 %
        </text>
        <text className="ag-phase-water" x="474" y="256" fontSize="8.5" fill={C.mint} fontFamily="sans-serif">
          bomba desligada
        </text>
        <text className="ag-phase-dry" x="474" y="240" fontSize="11" fontWeight="700" fill={C.alert} fontFamily="sans-serif">
          Nível baixo · 31 %
        </text>
        <text className="ag-phase-dry" x="474" y="256" fontSize="8.5" fill={C.mint} fontFamily="sans-serif">
          {pump ? 'liga só se houver água' : 'captação a encher'}
        </text>
      </Hud>
      <StepDot n={4} x={460} y={196} />
    </>
  );
}

function GreenhouseScene({ id }: { id: string }) {
  const g = 260;
  return (
    <>
      <Landscape id={id} ground={g} sun />
      {/* estrutura em arco */}
      <path d={`M80 ${g} V 150 Q 320 20 560 150 V ${g}`} fill={C.mint} fillOpacity="0.08" stroke={C.mint} strokeOpacity="0.6" strokeWidth="2" />
      {[160, 240, 320, 400, 480].map((x) => (
        <path key={x} d={`M${x} ${g} V ${x < 320 ? 150 - (x - 80) * 0.45 + 30 : 150 - (560 - x) * 0.45 + 30}`} stroke={C.mint} strokeOpacity="0.25" />
      ))}
      {/* linhas de cultura */}
      {[120, 170, 220, 270, 330, 380, 430, 480, 520].map((x, i) => (
        <g key={x} className="ag-a ag-sway" style={{ animationDelay: `${i * -0.4}s` }}>
          <path d={`M${x} ${g} v -32`} stroke={C.leafDark} strokeWidth="3" />
          <circle cx={x - 7} cy={g - 24} r="8" fill={C.leaf} />
          <circle cx={x + 7} cy={g - 32} r="8" fill={C.leaf} />
          <circle cx={x + 2} cy={g - 18} r="3.5" fill={C.alert} />
        </g>
      ))}
      {/* ondas de calor */}
      <g className="ag-phase-dry">
        {[180, 300, 420].map((x) => (
          <path key={x} className="ag-pulse" d={`M${x} 130 q 6 -8 0 -16 q -6 -8 0 -16`} stroke={C.alert} strokeWidth="2" fill="none" />
        ))}
      </g>
      {/* ventilador */}
      <circle cx="530" cy="190" r="24" fill="#1D2B24" stroke={C.metal} />
      <g className="ag-phase-water">
        <g className="ag-a ag-spin" style={{ transformOrigin: '530px 190px' }}>
          <path d="M530 190 q 4 -18 0 -20 q -4 2 0 20 M530 190 q 18 4 20 0 q -2 -4 -20 0 M530 190 q -4 18 0 20 q 4 -2 0 -20 M530 190 q -18 -4 -20 0 q 2 4 20 0" fill={C.metal} />
        </g>
        {[0, 0.5, 1].map((d) => (
          <path key={d} className="ag-a ag-wave" style={{ animationDelay: `${d}s` }} d="M560 180 q 14 10 0 20" stroke={C.mint} strokeWidth="2" fill="none" />
        ))}
      </g>
      <StepDot n={3} x={530} y={156} />
      {/* sensor de clima */}
      <rect x="300" y="150" width="22" height="28" rx="4" fill={C.box} />
      <circle className="ag-blink" cx="311" cy="160" r="3" fill={C.grass} />
      <StepDot n={1} x={286} y={150} />
      <Esp32Box x={90} y={180} />
      <StepDot n={2} x={86} y={174} />
      <Hud x={20} y={20} w={220} title="ESTUFA · CLIMA INTERIOR">
        <text className="ag-phase-dry" x="34" y="62" fontSize="13" fontWeight="700" fill={C.alert} fontFamily="sans-serif">
          31 °C · 82 %
        </text>
        <text className="ag-phase-dry" x="34" y="78" fontSize="8.5" fill={C.mint} fontFamily="sans-serif">
          acima do limite → ventilar
        </text>
        <text className="ag-phase-water" x="34" y="62" fontSize="13" fontWeight="700" fill="#fff" fontFamily="sans-serif">
          26 °C · 70 %
        </text>
        <text className="ag-phase-water" x="34" y="78" fontSize="8.5" fill={C.mint} fontFamily="sans-serif">
          ventilação ligada
        </text>
      </Hud>
      <StepDot n={4} x={20} y={20} />
    </>
  );
}

function CameraScene({ id }: { id: string }) {
  const g = 240;
  return (
    <>
      <Landscape id={id} ground={g} sun />
      {[60, 110, 160, 210, 260, 310, 360].map((x) => (
        <Maize key={x} x={x} ground={g} h={60 + (x % 30)} roots={false} />
      ))}
      {/* campo de visão */}
      <path d="M448 104 L 120 170 L 360 236 Z" fill={C.mint} fillOpacity="0.08" stroke={C.mint} strokeOpacity="0.3" strokeDasharray="4 5" />
      <path className="ag-flash" d="M448 104 L 120 170 L 360 236 Z" fill="#fff" />
      <path d={`M470 ${g} V 98`} stroke={C.metalDark} strokeWidth="5" />
      <rect x="440" y="92" width="40" height="26" rx="5" fill={C.box} />
      <circle cx="450" cy="105" r="7" fill="#1D2B24" stroke={C.metal} />
      <circle cx="450" cy="105" r="3" fill={C.water} />
      <StepDot n={1} x={492} y={92} />
      {/* linha do tempo de fotografias */}
      <Hud x={406} y={150} w={222} title="LINHA DO TEMPO · ZONA B">
        {[0, 1, 2, 3].map((i) => (
          <g key={i} className="ag-step" style={{ animationDelay: STEP_DELAYS[i] }}>
            <rect x={420 + i * 50} y={176} width="42" height="40" rx="4" fill="#123D2A" stroke={C.mint} strokeOpacity="0.4" />
            <path d={`M${441 + i * 50} 210 v ${-10 - i * 5}`} stroke={C.leaf} strokeWidth="3" />
            <circle cx={441 + i * 50} cy={200 - i * 5} r={4 + i * 1.6} fill={C.leaf} />
            <text x={441 + i * 50} y={226} textAnchor="middle" fontSize="7" fill={C.mint} fontFamily="sans-serif">
              dia {1 + i * 7}
            </text>
          </g>
        ))}
      </Hud>
      <StepDot n={4} x={406} y={150} />
    </>
  );
}

function EnergyScene({ id }: { id: string }) {
  const g = 250;
  return (
    <>
      <Landscape id={id} ground={g} sun />
      {/* raios de sol */}
      {[0, 0.4, 0.8].map((d) => (
        <path key={d} className="ag-a ag-wave" style={{ animationDelay: `${d}s` }} d="M540 80 L 420 120" stroke={C.sun} strokeWidth="2" strokeOpacity="0.6" />
      ))}
      {/* painel */}
      <g>
        <path d={`M330 ${g} L 360 150 M430 ${g} L 410 150`} stroke={C.metalDark} strokeWidth="4" />
        <path d="M300 160 L 360 100 L 470 100 L 410 160 Z" fill="#1F3E7A" stroke={C.metal} />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${330 + i * 30} 160 L ${390 + i * 30} 100`} stroke={C.metal} strokeOpacity="0.5" />
        ))}
        <path d="M330 130 L 440 130" stroke={C.metal} strokeOpacity="0.5" />
      </g>
      <StepDot n={1} x={470} y={96} />
      {/* bateria + controlador + medidor */}
      <rect x="190" y={g - 52} width="56" height="40" rx="5" fill={C.box} />
      <rect x="198" y={g - 44} width="40" height="10" rx="2" fill="#123D2A" />
      <rect className="ag-fill-x" x="198" y={g - 44} width="24" height="10" rx="2" fill={C.grass} />
      <text x="218" y={g - 20} textAnchor="middle" fontSize="7" fill={C.ink} fontFamily="sans-serif">BATERIA</text>
      <path className="ag-flow" d={`M360 170 C 330 200, 280 ${g - 40}, 246 ${g - 32}`} stroke={C.sun} strokeWidth="2.5" fill="none" />
      <StepDot n={2} x={218} y={g - 66} />
      {/* bomba */}
      <rect x="70" y={g - 30} width="50" height="28" rx="5" fill={C.metalDark} />
      <circle cx="95" cy={g - 16} r="8" fill={C.metal} />
      <path className="ag-a ag-spin" d={`M95 ${g - 22} v 12 M89 ${g - 16} h 12`} stroke={C.ink} strokeWidth="2" />
      <path className="ag-flow" d={`M190 ${g - 32} H 120`} stroke={C.sun} strokeWidth="2.5" />
      <path d={`M70 ${g - 16} H 30 V ${g + 40}`} stroke={C.metal} strokeWidth="6" fill="none" />
      <path className="ag-flow" d={`M70 ${g - 16} H 30 V ${g + 40}`} stroke={C.water} strokeWidth="2.5" fill="none" />
      <StepDot n={3} x={95} y={g - 46} />
      <Hud x={20} y={20} w={230} title="ENERGIA · HOJE">
        <text x="34" y="62" fontSize="14" fontWeight="700" fill="#fff" fontFamily="sans-serif">
          2,4 kWh
        </text>
        <text x="34" y="78" fontSize="8.5" fill={C.mint} fontFamily="sans-serif">
          consumo da bomba medido (PZEM-004T)
        </text>
      </Hud>
      <StepDot n={4} x={20} y={20} />
    </>
  );
}

export const STEPS: Record<IllustrationKind, Step[]> = {
  irrigation: [
    { title: 'O sensor mede', text: 'A sonda capacitiva lê a humidade na zona das raízes a cada 5 minutos.' },
    { title: 'O ESP32 decide', text: 'Compara com o limite da cultura (ex.: 30 %) — no campo, mesmo sem internet.' },
    { title: 'A válvula abre', text: 'Só se a boia confirmar que há água; a bomba nunca trabalha a seco.' },
    { title: 'Para no alvo', text: 'Fecha aos 45 % ou no tempo máximo, e envia o registo quando houver rede.' },
  ],
  drip: [
    { title: 'Depósito em pressão', text: 'A água sai do depósito ou da bomba e passa pelo filtro.' },
    { title: 'Filtrar e dosear', text: 'O controlador abre a zona certa, à hora certa.' },
    { title: 'Gota na raiz', text: 'Cada gotejador molha só o bolbo de raízes — sem escorrer entre linhas.' },
    { title: 'Medir o resultado', text: 'Sensor de humidade e caudal confirmam quanta água foi realmente aplicada.' },
  ],
  reservoir: [
    { title: 'Medir o nível', text: 'O sensor ultrassónico mede a distância até à água no tanque.' },
    { title: 'Calcular volume', text: 'O ESP32 converte em litros com as dimensões do tanque.' },
    { title: 'Encher com segurança', text: 'Abaixo do mínimo liga a captação — só se a boia indicar água no poço.' },
    { title: 'Avisar', text: 'Nível baixo ou consumo anormal geram alerta no telemóvel.' },
  ],
  pump: [
    { title: 'Ver a água', text: 'A boia confirma que há água antes de qualquer arranque.' },
    { title: 'Comando validado', text: 'Ligar exige duração máxima e modo manual; desligar é sempre permitido.' },
    { title: 'Bomba protegida', text: 'Sem água ou fora de tempo, desliga sozinha.' },
    { title: 'Histórico', text: 'Cada arranque e recusa fica registado com a razão.' },
  ],
  soil: [
    { title: 'Humidade', text: 'Quanta água as raízes têm disponível agora.' },
    { title: 'pH', text: 'A acidez do solo decide se a adubação é aproveitada.' },
    { title: 'Temperatura', text: 'Indica quando o solo está pronto para semear.' },
    { title: 'Mapa por zona', text: 'Os valores chegam à plataforma e aparecem no mapa da propriedade.' },
  ],
  weather: [
    { title: 'Medir o ar', text: 'Temperatura e humidade dentro do abrigo de radiação.' },
    { title: 'Registar a chuva', text: 'O pluviómetro conta cada milímetro que cai na tua lavra.' },
    { title: 'Enviar', text: 'Os dados chegam ao telemóvel quando há ligação.' },
    { title: 'Decidir', text: 'Se choveu o suficiente, a rega automática é suspensa.' },
  ],
  greenhouse: [
    { title: 'Sentir o calor', text: 'O sensor mede temperatura e humidade dentro da estufa.' },
    { title: 'Comparar', text: 'O ESP32 compara com os limites da cultura.' },
    { title: 'Ventilar', text: 'Acima do limite, os ventiladores ligam até o ar arrefecer.' },
    { title: 'Prevenir doenças', text: 'Menos humidade parada, menos fungos.' },
  ],
  camera: [
    { title: 'Fotografar', text: 'A câmara ESP32-CAM tira fotografias sempre do mesmo ângulo.' },
    { title: 'Guardar', text: 'As imagens ficam no cartão e sobem quando há rede.' },
    { title: 'Comparar', text: 'A linha do tempo mostra o crescimento semana a semana.' },
    { title: 'Detetar cedo', text: 'Amarelecimentos e falhas tornam-se visíveis antes de alastrar.' },
  ],
  energy: [
    { title: 'Sol', text: 'O painel produz energia durante o dia.' },
    { title: 'Guardar', text: 'A bateria alimenta o controlador e os sensores à noite.' },
    { title: 'Bombear', text: 'A bomba trabalha quando há energia e há água.' },
    { title: 'Medir', text: 'O medidor regista os kWh — o custo real de cada rega.' },
  ],
};

export function SystemIllustration({ kind, className, showSteps = true, title }: { kind: IllustrationKind; className?: string; showSteps?: boolean; title?: string }) {
  const id = React.useId().replace(/:/g, '');
  const scene =
    kind === 'irrigation' ? <IrrigationScene id={id} /> :
    kind === 'drip' ? <IrrigationScene id={id} drip /> :
    kind === 'reservoir' ? <ReservoirScene id={id} /> :
    kind === 'pump' ? <ReservoirScene id={id} pump /> :
    kind === 'soil' ? <SoilScene id={id} /> :
    kind === 'weather' ? <WeatherScene id={id} /> :
    kind === 'greenhouse' ? <GreenhouseScene id={id} /> :
    kind === 'camera' ? <CameraScene id={id} /> :
    <EnergyScene id={id} />;
  const steps = STEPS[kind];
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-night', className)}>
      <svg viewBox="0 0 640 360" role="img" aria-label={title ?? `Ilustração do sistema a funcionar: ${steps.map((s) => s.title).join(', ')}`} className="block h-auto w-full">
        <Defs id={id} />
        {scene}
      </svg>
      {showSteps && (
        <ol className="grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="ag-step bg-night p-3 text-snow" style={{ animationDelay: STEP_DELAYS[i] }}>
              <span className="flex items-center gap-2 text-xs font-semibold">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-tech text-[11px] text-night">{i + 1}</span>
                {s.title}
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-snow/65">{s.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
