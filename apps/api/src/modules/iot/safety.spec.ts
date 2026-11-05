import { evaluateRule, inWindow, validateCommand, type CommandContext } from './safety';

const now = new Date('2026-11-05T10:00:00Z');
const base: CommandContext = {
  action: 'ON',
  durationSec: 300,
  source: 'MANUAL',
  actuator: { kind: 'PUMP', maxRuntimeSec: 1800 },
  device: { status: 'ONLINE', mode: 'MANUAL', lastSeenAt: new Date(now.getTime() - 60_000) },
  water: { value: 1, min: 1, recordedAt: new Date(now.getTime() - 60_000) },
  commandsLastMinute: 0,
  now,
};

describe('Segurança de comandos', () => {
  it('permite ligar a bomba com água e dispositivo online em modo manual', () => {
    expect(validateCommand(base)).toEqual({ ok: true, durationSec: 300, warnings: [] });
  });

  it('desligar é sempre permitido, mesmo offline ou desativado', () => {
    expect(validateCommand({ ...base, action: 'OFF', device: { ...base.device, status: 'DISABLED', lastSeenAt: null } }).ok).toBe(true);
  });

  it('bloqueia funcionamento a seco', () => {
    const r = validateCommand({ ...base, water: { value: 0, min: 1, recordedAt: base.water!.recordedAt } });
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/funcionamento a seco/) });
  });

  it('bloqueia quando a leitura de nível é antiga', () => {
    const r = validateCommand({ ...base, water: { value: 1, min: 1, recordedAt: new Date(now.getTime() - 3_600_000) } });
    expect(r.ok).toBe(false);
  });

  it('bloqueia dispositivos offline', () => {
    expect(validateCommand({ ...base, device: { ...base.device, lastSeenAt: new Date(now.getTime() - 3_600_000) } }).ok).toBe(false);
  });

  it('exige modo manual para ligar manualmente', () => {
    expect(validateCommand({ ...base, device: { ...base.device, mode: 'AUTO' } }).ok).toBe(false);
  });

  it('exige duração e respeita o máximo do atuador', () => {
    expect(validateCommand({ ...base, durationSec: undefined }).ok).toBe(false);
    expect(validateCommand({ ...base, durationSec: 2000 }).ok).toBe(false);
  });

  it('limita bombas sem sensor de nível a comandos manuais curtos', () => {
    expect(validateCommand({ ...base, water: null, durationSec: 300 })).toMatchObject({ ok: true });
    expect(validateCommand({ ...base, water: null, durationSec: 900 }).ok).toBe(false);
    expect(validateCommand({ ...base, water: null, source: 'RULE', device: { ...base.device, mode: 'AUTO' } }).ok).toBe(false);
  });

  it('aplica limite de frequência', () => {
    expect(validateCommand({ ...base, commandsLastMinute: 6 }).ok).toBe(false);
  });
});

describe('Avaliação de regras', () => {
  const rule = { operator: 'LT' as const, threshold: 30, stopThreshold: 45, cooldownSec: 1800, activeFrom: null, activeTo: null, lastTriggeredAt: null };

  it('liga abaixo do limite e desliga na condição de paragem (histerese)', () => {
    expect(evaluateRule(rule, 25, false, now, '10:00')).toBe('ON');
    expect(evaluateRule(rule, 35, true, now, '10:00')).toBeNull();
    expect(evaluateRule(rule, 46, true, now, '10:00')).toBe('OFF');
  });

  it('respeita o intervalo mínimo entre ativações', () => {
    expect(evaluateRule({ ...rule, lastTriggeredAt: new Date(now.getTime() - 600_000) }, 20, false, now, '10:00')).toBeNull();
  });

  it('respeita a janela horária, incluindo a que passa a meia-noite', () => {
    expect(inWindow('23:30', '22:00', '06:00')).toBe(true);
    expect(inWindow('12:00', '22:00', '06:00')).toBe(false);
    expect(evaluateRule({ ...rule, activeFrom: '18:00', activeTo: '07:00' }, 20, false, now, '12:00')).toBeNull();
  });
});
