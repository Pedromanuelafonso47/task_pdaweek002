'use client';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/feedback';

/** Mapas carregados só no cliente (MapLibre usa window/WebGL). */
const loading = () => <Skeleton className="h-72 w-full" />;

export const LocationPicker = dynamic(() => import('./location-picker'), { ssr: false, loading });
export const PolygonDrawer = dynamic(() => import('./polygon-drawer'), { ssr: false, loading });
export const FarmMap = dynamic(() => import('./farm-map'), { ssr: false, loading });
export { polygonAreaHa } from './geo';
