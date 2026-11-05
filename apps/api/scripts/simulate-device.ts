/**
 * SIMULADOR de dispositivo IoT — para testar a plataforma sem hardware.
 * Envia telemetria via HTTP (/api/iot/ingest), consulta comandos pendentes e confirma-os,
 * imitando o firmware do ESP32 (incluindo a recusa por falta de água).
 *
 *   npm run iot:simulate -- --user dev_xxx --secret yyy [--api http://localhost:4000/api] [--interval 10]
 *
 * As leituras geradas são SINTÉTICAS. Usa-o apenas em propriedades de teste/demonstração.
 */
const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const API = args.api ?? 'http://localhost:4000/api';
const USER = args.user;
const SECRET = args.secret;
const INTERVAL = Number(args.interval ?? 10) * 1000;
if (!USER || !SECRET) {
  console.error('Uso: npm run iot:simulate -- --user <mqttUsername> --secret <segredo>');
  process.exit(1);
}
const headers = { 'Content-Type': 'application/json', 'x-device-user': USER, 'x-device-secret': SECRET };

const state = { moisture: [42, 38, 47, 40], water: 1, valves: { v1: false, v2: false, v3: false, v4: false } as Record<string, boolean>, pump1: false, offUntil: {} as Record<string, number> };

async function tick() {
  // física simplificada: o solo seca; a rega aumenta a humidade
  state.moisture = state.moisture.map((m, i) => {
    const on = state.valves[`v${i + 1}`] || state.pump1;
    return Math.max(5, Math.min(95, m + (on ? 2.5 : -0.4) + (Math.random() - 0.5)));
  });
  for (const [k, until] of Object.entries(state.offUntil)) {
    if (Date.now() > until) {
      if (k === 'pump1') state.pump1 = false;
      else state.valves[k] = false;
      delete state.offUntil[k];
    }
  }
  const body = {
    ts: Math.floor(Date.now() / 1000),
    r: { sm1: +state.moisture[0].toFixed(1), sm2: +state.moisture[1].toFixed(1), sm3: +state.moisture[2].toFixed(1), sm4: +state.moisture[3].toFixed(1), water: state.water, temp: +(22 + 6 * Math.random()).toFixed(1) },
    a: { ...state.valves, pump1: state.pump1 },
  };
  const res = await fetch(`${API}/iot/ingest`, { method: 'POST', headers, body: JSON.stringify(body) });
  console.log(new Date().toLocaleTimeString('pt-AO'), 'telemetria', res.status, JSON.stringify(body.r));

  const cmds = (await (await fetch(`${API}/iot/device/commands`, { headers })).json()) as { cmdId: string; actuator: string; action: 'ON' | 'OFF'; durationSec: number | null }[];
  for (const c of cmds) {
    let ok = true;
    let reason = '';
    if (c.action === 'ON' && state.water < 1) {
      ok = false;
      reason = 'sem agua (simulado)';
    } else if (c.actuator === 'pump1') {
      state.pump1 = c.action === 'ON';
    } else if (c.actuator in state.valves) {
      state.valves[c.actuator] = c.action === 'ON';
    } else {
      ok = false;
      reason = 'atuador desconhecido';
    }
    if (ok && c.action === 'ON' && c.durationSec) state.offUntil[c.actuator] = Date.now() + c.durationSec * 1000;
    await fetch(`${API}/iot/device/ack`, { method: 'POST', headers, body: JSON.stringify({ cmdId: c.cmdId, ok, reason }) });
    console.log('  comando', c.actuator, c.action, ok ? 'executado' : `recusado: ${reason}`);
  }
}

console.log(`Simulador ligado a ${API} como ${USER} (intervalo ${INTERVAL / 1000}s). Ctrl+C para parar.`);
process.stdin.on('data', (d) => {
  // "w" alterna a água disponível — para testar a proteção contra funcionamento a seco
  if (d.toString().trim() === 'w') {
    state.water = state.water ? 0 : 1;
    console.log('  água disponível =', state.water);
  }
});
tick();
setInterval(() => tick().catch((e) => console.error('erro:', (e as Error).message)), INTERVAL);
