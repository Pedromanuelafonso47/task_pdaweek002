/**
 * Regras de segurança para comandos de atuadores. Funções puras — testadas em safety.spec.ts.
 * O firmware aplica limites equivalentes (defesa em profundidade): mesmo que o servidor
 * falhe, o ESP32 nunca liga a bomba sem água nem a deixa ligada além do tempo máximo.
 */

export const HARD_MAX_RUN_SEC = 3600;
export const ONLINE_WINDOW_MS = 10 * 60_000;
export const WATER_READING_MAX_AGE_MS = 30 * 60_000;
export const MAX_COMMANDS_PER_MINUTE = 6;
/** Bomba sem sensor de nível: só comando manual e com tempo reduzido. */
export const UNPROTECTED_PUMP_MAX_SEC = 600;

export interface CommandContext {
  action: 'ON' | 'OFF';
  durationSec?: number;
  source: 'MANUAL' | 'RULE';
  actuator: { kind: 'PUMP' | 'VALVE' | 'FAN' | 'LIGHT' | 'OTHER'; maxRuntimeSec: number };
  device: { status: 'PENDING' | 'ONLINE' | 'OFFLINE' | 'DISABLED'; mode: 'AUTO' | 'MANUAL'; lastSeenAt: Date | null };
  /** proteção contra funcionamento a seco: null = não existe sensor de nível associado */
  water: { value: number | null; min: number; recordedAt: Date | null } | null;
  commandsLastMinute: number;
  now: Date;
}

export type SafetyResult = { ok: true; durationSec?: number; warnings: string[] } | { ok: false; reason: string };

export function validateCommand(c: CommandContext): SafetyResult {
  const warnings: string[] = [];

  // Desligar é sempre seguro e nunca é bloqueado.
  if (c.action === 'OFF') return { ok: true, warnings };

  if (c.device.status === 'DISABLED') return { ok: false, reason: 'Dispositivo desativado.' };
  const online = c.device.lastSeenAt && c.now.getTime() - c.device.lastSeenAt.getTime() <= ONLINE_WINDOW_MS;
  if (!online) {
    return { ok: false, reason: 'Dispositivo sem comunicação recente: o comando não seria entregue nem confirmado.' };
  }
  if (c.source === 'MANUAL' && c.device.mode === 'AUTO') {
    return { ok: false, reason: 'O dispositivo está em modo automático. Muda para modo manual para ligar manualmente (desligar é sempre permitido).' };
  }
  if (c.commandsLastMinute >= MAX_COMMANDS_PER_MINUTE) {
    return { ok: false, reason: 'Demasiados comandos seguidos para este atuador. Aguarda um minuto.' };
  }
  if (!c.durationSec || c.durationSec <= 0) {
    return { ok: false, reason: 'Indica a duração: nenhum atuador é ligado sem tempo máximo.' };
  }
  let max = Math.min(c.actuator.maxRuntimeSec, HARD_MAX_RUN_SEC);

  if (c.actuator.kind === 'PUMP') {
    if (!c.water) {
      if (c.source === 'RULE') {
        return { ok: false, reason: 'Regras automáticas de bomba exigem sensor de nível de água (proteção contra funcionamento a seco).' };
      }
      max = Math.min(max, UNPROTECTED_PUMP_MAX_SEC);
      warnings.push(`Bomba sem sensor de nível associado: duração limitada a ${UNPROTECTED_PUMP_MAX_SEC / 60} min.`);
    } else {
      const fresh = c.water.recordedAt && c.now.getTime() - c.water.recordedAt.getTime() <= WATER_READING_MAX_AGE_MS;
      if (c.water.value === null || !fresh) {
        return { ok: false, reason: 'Sem leitura recente do nível de água: não é seguro ligar a bomba.' };
      }
      if (c.water.value < c.water.min) {
        return { ok: false, reason: `Nível de água (${c.water.value}) abaixo do mínimo (${c.water.min}): proteção contra funcionamento a seco.` };
      }
    }
  }

  if (c.durationSec > max) {
    return { ok: false, reason: `Duração excede o máximo permitido para este atuador (${max} s).` };
  }
  return { ok: true, durationSec: c.durationSec, warnings };
}

export interface RuleState {
  operator: 'LT' | 'GT';
  threshold: number;
  stopThreshold: number;
  cooldownSec: number;
  activeFrom: string | null;
  activeTo: string | null;
  lastTriggeredAt: Date | null;
}

/** "HH:MM" dentro da janela (suporta janelas que atravessam a meia-noite). */
export function inWindow(hhmm: string, from: string | null, to: string | null): boolean {
  if (!from || !to) return true;
  if (from <= to) return hhmm >= from && hhmm <= to;
  return hhmm >= from || hhmm <= to;
}

/** Decide a ação de uma regra perante uma nova leitura. */
export function evaluateRule(rule: RuleState, value: number, actuatorOn: boolean, now: Date, localHHMM: string): 'ON' | 'OFF' | null {
  const trigger = rule.operator === 'LT' ? value < rule.threshold : value > rule.threshold;
  const stop = rule.operator === 'LT' ? value >= rule.stopThreshold : value <= rule.stopThreshold;
  if (actuatorOn) return stop ? 'OFF' : null;
  if (!trigger) return null;
  if (!inWindow(localHHMM, rule.activeFrom, rule.activeTo)) return null;
  if (rule.lastTriggeredAt && now.getTime() - rule.lastTriggeredAt.getTime() < rule.cooldownSec * 1000) return null;
  return 'ON';
}
