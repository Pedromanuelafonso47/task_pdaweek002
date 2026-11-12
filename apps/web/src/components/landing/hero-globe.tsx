'use client';
import { PROVINCE_CLIMATE, type AngolaProvince } from '@agrogenius/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import * as React from 'react';
import { Globe } from '@/components/three';
import { useWebGL } from '@/components/three/webgl';

/** O que cada zona agroclimática implica para a tecnologia agrícola (orientação geral). */
const CLIMATE_INFO: Record<string, { label: string; focus: string }> = {
  ARID: { label: 'Árido', focus: 'Água é o fator limitante: rega por humidade do solo, gota-a-gota e gestão de reservatórios têm prioridade.' },
  SEMI_ARID: { label: 'Semiárido', focus: 'Chuvas curtas e irregulares: monitorizar o solo e automatizar a rega reduz perdas na época seca.' },
  HIGHLAND: { label: 'Planalto', focus: 'Grandes amplitudes térmicas e chuvas sazonais: estações meteorológicas locais apoiam sementeira e rega.' },
  SUBHUMID: { label: 'Sub-húmido', focus: 'Água moderada: medição de humidade evita rega desnecessária; monitorizar doenças em períodos húmidos.' },
  HUMID_TROPICAL: { label: 'Tropical húmido', focus: 'Excesso de humidade: drenagem, deteção precoce de doenças e ventilação de armazéns.' },
};

export function HeroGlobe() {
  const [selected, setSelected] = React.useState<AngolaProvince | null>(null);
  const webgl = useWebGL();
  const info = selected ? CLIMATE_INFO[PROVINCE_CLIMATE[selected]] : null;

  return (
    <div className="relative aspect-square w-full max-w-[620px]">
      <div className="absolute inset-[12%] rounded-full bg-sky/25 blur-3xl" />
      {webgl === false ? (
        <div className="relative grid h-full place-items-center rounded-full border border-white/10 text-center text-sm text-mint/70">
          Globo 3D indisponível neste dispositivo (WebGL).
        </div>
      ) : (
        <div className="relative h-full w-full">{webgl && <Globe selected={selected} onSelect={setSelected} />}</div>
      )}
      <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-mint/60">Clica numa província de Angola</p>
      <AnimatePresence>
        {selected && info && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-10 left-1/2 w-[min(92%,340px)] -translate-x-1/2 rounded-lg border border-white/10 bg-night/85 p-4 text-snow shadow-2xl backdrop-blur-xl"
          >
            <button onClick={() => setSelected(null)} className="absolute right-2 top-2 rounded p-1 text-snow/60 hover:text-snow" aria-label="Fechar">
              <X className="size-4" />
            </button>
            <p className="text-xs uppercase tracking-[0.14em] text-tech">{info.label}</p>
            <p className="font-display text-lg font-semibold">{selected}</p>
            <p className="mt-1 text-sm text-snow/75">{info.focus}</p>
            <p className="mt-2 text-[10px] text-snow/45">Classificação climática regional aproximada — a análise real usa os dados da tua propriedade.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
