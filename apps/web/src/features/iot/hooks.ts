'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import type { Device } from '@/lib/types';

export interface DeviceDetail extends Device {
  config: {
    mode: 'AUTO' | 'MANUAL';
    zones: { sensor: string; valve: string; start: number; stop: number; maxSec: number; cooldownSec: number }[];
  };
  broker: { configured: boolean; connected: boolean };
  firmwareVersion?: string | null;
}

export interface Rule {
  id: string;
  farmId: string;
  name: string;
  enabled: boolean;
  sensorId: string;
  operator: 'LT' | 'GT';
  threshold: number;
  stopThreshold: number;
  actuatorId: string;
  maxDurationSec: number;
  cooldownSec: number;
  waterLevelSensorId: string | null;
  minWaterLevel: number | null;
  activeFrom: string | null;
  activeTo: string | null;
  lastTriggeredAt: string | null;
  sensor: { id: string; key: string; kind: string; unit: string; device: { id: string; name: string } };
  actuator: { id: string; key: string; kind: string; name: string; isOn: boolean; device: { id: string; name: string; mode: string } };
  waterLevelSensor: { id: string; key: string; unit: string } | null;
}

export interface CommandRow {
  id: string;
  action: 'ON' | 'OFF';
  durationSec: number | null;
  status: 'PENDING' | 'SENT' | 'ACKED' | 'REJECTED' | 'FAILED' | 'EXPIRED';
  reason: string | null;
  createdAt: string;
  ackAt: string | null;
  actuator: { key: string; name: string; kind: string; device: { name: string } };
  issuedBy: { fullName: string } | null;
  rule: { name: string } | null;
}

export const iotKeys = {
  devices: (farmId: string | null) => ['iot', 'devices', farmId] as const,
  device: (id: string) => ['iot', 'device', id] as const,
  rules: (farmId: string | null) => ['iot', 'rules', farmId] as const,
  commands: (farmId: string | null) => ['iot', 'commands', farmId] as const,
};

export function useDevices(farmId: string | null) {
  return useQuery({
    queryKey: iotKeys.devices(farmId),
    queryFn: () => api<Device[]>(`/iot/devices?farmId=${farmId}`),
    enabled: !!farmId,
    refetchInterval: 60_000,
  });
}

export function useDevice(id: string) {
  return useQuery({ queryKey: iotKeys.device(id), queryFn: () => api<DeviceDetail>(`/iot/devices/${id}`) });
}

export function useRules(farmId: string | null) {
  return useQuery({ queryKey: iotKeys.rules(farmId), queryFn: () => api<Rule[]>(`/iot/farms/${farmId}/rules`), enabled: !!farmId });
}

export function useCommands(farmId: string | null) {
  return useQuery({ queryKey: iotKeys.commands(farmId), queryFn: () => api<CommandRow[]>(`/iot/farms/${farmId}/commands`), enabled: !!farmId });
}

/** Mantém as vistas IoT atualizadas com os eventos em tempo real da propriedade. */
export function useIotRealtime(farmId: string | null) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['iot'] });
  };
  useRealtime('readings', refresh, farmId);
  useRealtime('device-status', refresh, farmId);
  useRealtime('command', refresh, farmId);
  useRealtime('device-event', refresh, farmId);
}

export const DEFAULT_UNITS: Record<string, string> = {
  SOIL_MOISTURE: '%',
  SOIL_TEMPERATURE: '°C',
  SOIL_PH: 'pH',
  SOIL_EC: 'µS/cm',
  AIR_TEMPERATURE: '°C',
  AIR_HUMIDITY: '%',
  LIGHT: 'lux',
  RAIN: 'mm',
  WATER_LEVEL: 'nível',
  WATER_FLOW: 'L/min',
  ENERGY: 'kWh',
};

export const fmtDuration = (sec: number) => (sec >= 60 ? `${Math.round((sec / 60) * 10) / 10} min` : `${sec} s`);
