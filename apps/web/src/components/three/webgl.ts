'use client';
import * as React from 'react';

/** Deteta suporte WebGL (para mostrar alternativa acessível quando não existe). */
export function useWebGL(): boolean | null {
  const [ok, setOk] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    try {
      const c = document.createElement('canvas');
      setOk(!!(c.getContext('webgl2') || c.getContext('webgl')));
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

export function latLngToVec3(lat: number, lng: number, r = 1): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return [-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)];
}
