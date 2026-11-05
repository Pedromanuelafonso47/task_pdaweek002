// Teste de fumo de ponta a ponta contra a API em execução.
// Uso: node scripts/smoke.mjs   (API em http://localhost:4000)
const API = process.env.API_URL ?? 'http://localhost:4000/api';
let token = null;
let cookie = '';
const results = [];

async function call(method, path, body, headers = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json() : ct.includes('pdf') ? Buffer.from(await res.arrayBuffer()) : await res.text();
  return { status: res.status, data };
}
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? '✔' : '✘'} ${name}${extra ? ` — ${extra}` : ''}`);
}

const email = `huambo.${Date.now()}@teste.ao`;
let r = await call('POST', '/auth/register', { fullName: 'Agricultor Teste Huambo', email, password: 'Milho2026' });
check('registo', r.status === 201 && r.data.accessToken, r.status);
token = r.data.accessToken;

r = await call('GET', '/farms');
check('isolamento: conta nova sem propriedades', r.status === 200 && r.data.length === 0);

r = await call('POST', '/auth/register', { fullName: 'x', email: 'mau', password: '1' });
check('validação Zod no registo', r.status === 400 && r.data.errors?.length >= 2, JSON.stringify(r.data.errors?.map((e) => e.path)));

const onboarding = {
  personal: { fullName: 'Agricultor Teste Huambo', phone: '+244 923 000 000', province: 'Huambo', municipality: 'Huambo', locality: 'Chianga', farmerType: 'FAMILY' },
  farm: {
    name: 'Fazenda Chianga', province: 'Huambo', municipality: 'Huambo', latitude: -12.74, longitude: 15.83,
    totalAreaHa: 5, cultivatedAreaHa: 5, terrainType: 'FLAT', soilType: 'CLAY', waterAvailability: 'MODERATE', waterSource: 'WELL', irrigationSystem: 'MANUAL',
  },
  production: { crops: [{ cropSlug: 'milho', areaHa: 5, season: 'Época A', harvestFrequency: '1x/ano', approxYieldKgHa: 2500 }], problems: ['WATER_WASTE'] },
  infrastructure: { hasElectricity: true, internet: 'LIMITED', hasSensors: false, hasPumps: false, hasMachinery: false, techLevel: 'BASIC' },
  goals: { goals: ['REDUCE_WATER', 'AUTOMATE_IRRIGATION'], budgetKz: 300000 },
};
r = await call('POST', '/onboarding/complete', onboarding);
check('onboarding completo', r.status === 201 && r.data.farmId, r.status + ' ' + (r.data.message ?? ''));
const farmId = r.data.farmId;
const items = r.data.recommendations?.items ?? [];
const top = items[0];
check('1.ª recomendação = irrigação ESP32', top?.project.slug === 'esp32-smart-irrigation', items.map((i) => `${i.project.slug}:${i.score}`).join(', '));
check('faseamento quando excede orçamento', Array.isArray(top?.phases) && top.phases.length === 2 && top.phases[0].costKz <= 300000, JSON.stringify(top?.phases));
check('ROI não inventado sem dados', top?.roi?.kind === 'INSUFFICIENT_DATA');
check('dados em falta reportados', r.data.recommendations?.analysis?.missingData?.length > 0, r.data.recommendations?.analysis?.missingData?.join('; '));

// Finanças → ROI passa a ser calculado
await call('POST', '/finance/transactions', { farmId, type: 'EXPENSE', category: 'IRRIGATION', amount: 480000, date: new Date().toISOString(), description: 'Combustível da motobomba' });
await call('POST', '/finance/transactions', { farmId, type: 'EXPENSE', category: 'LABOR', amount: 900000, date: new Date().toISOString() });
r = await call('POST', `/farms/${farmId}/recommendations/generate`);
const top2 = r.data.items?.find((i) => i.project.slug === 'esp32-smart-irrigation');
check('ROI estimado com custos reais', top2?.roi?.kind === 'ESTIMATE', JSON.stringify(top2?.roi));

r = await call('GET', '/finance/summary?farmId=' + farmId);
check('resumo financeiro', r.status === 200 && r.data.expense === 1380000, r.data.expense);

// Idempotência offline
const clientId = crypto.randomUUID();
const t1 = await call('POST', '/finance/transactions', { farmId, type: 'EXPENSE', category: 'SEEDS', amount: 50000, date: new Date().toISOString(), clientId });
const t2 = await call('POST', '/finance/transactions', { farmId, type: 'EXPENSE', category: 'SEEDS', amount: 50000, date: new Date().toISOString(), clientId });
check('idempotência (clientId) — sem duplicados', t1.data.id && t1.data.id === t2.data.id);

// Zonas
r = await call('POST', `/farms/${farmId}/fields`, { name: 'Zona Norte', areaHa: 2.5, isIrrigationZone: true });
check('criar zona', r.status === 201);

// IoT
r = await call('POST', '/iot/devices', {
  farmId, name: 'Controlador de rega', type: 'CONTROLLER', localRules: false,
  sensors: [{ key: 'sm1', kind: 'SOIL_MOISTURE', unit: '%', minThreshold: 25 }, { key: 'water', kind: 'WATER_LEVEL', unit: 'bool', minThreshold: 1 }],
  actuators: [{ key: 'pump1', kind: 'PUMP', name: 'Bomba do poço', maxRuntimeSec: 1200 }],
});
check('registar dispositivo (segredo devolvido 1x)', r.status === 201 && r.data.credentials?.secret);
const dev = r.data.device;
const creds = r.data.credentials;
const pump = dev.actuators[0];
const sm = dev.sensors.find((s) => s.key === 'sm1');
const wl = dev.sensors.find((s) => s.key === 'water');

r = await call('POST', `/iot/actuators/${pump.id}/command`, { action: 'ON', durationSec: 60 });
check('comando bloqueado: dispositivo offline', r.status === 422, r.data.message);

r = await call('POST', '/iot/ingest', { r: { sm1: 40, water: 1 } }, { 'x-device-user': creds.mqttUsername, 'x-device-secret': 'errado' });
check('ingestão rejeita segredo errado', r.status === 401);

r = await call('POST', '/iot/ingest', { r: { sm1: 40, water: 0, desconhecido: 3 } }, { 'x-device-user': creds.mqttUsername, 'x-device-secret': creds.secret });
check('ingestão de telemetria', r.status === 202 && r.data.accepted === 2 && r.data.ignored === 1, JSON.stringify(r.data));

r = await call('POST', `/iot/actuators/${pump.id}/command`, { action: 'ON', durationSec: 60 });
check('comando bloqueado: modo automático', r.status === 422 && /automático/.test(r.data.message), r.data.message);

await call('PATCH', `/iot/devices/${dev.id}`, { mode: 'MANUAL' });
r = await call('POST', `/iot/actuators/${pump.id}/command`, { action: 'ON', durationSec: 60 });
check('comando bloqueado: funcionamento a seco', r.status === 422 && /seco/.test(r.data.message), r.data.message);

await call('POST', '/iot/ingest', { r: { water: 1 } }, { 'x-device-user': creds.mqttUsername, 'x-device-secret': creds.secret });
r = await call('POST', `/iot/actuators/${pump.id}/command`, { action: 'ON', durationSec: 5000 });
check('comando bloqueado: duração acima do máximo', r.status === 400 || r.status === 422, r.data.message ?? JSON.stringify(r.data.errors));
r = await call('POST', `/iot/actuators/${pump.id}/command`, { action: 'ON', durationSec: 300 });
check('comando válido aceite (entrega por polling sem MQTT)', r.status === 201 && r.data.delivery === 'POLLING', r.data.status);
const cmdId = r.data.id;

r = await call('GET', '/iot/device/commands', undefined, { 'x-device-user': creds.mqttUsername, 'x-device-secret': creds.secret });
check('dispositivo recebe comando por polling', r.data.length === 1 && r.data[0].cmdId === cmdId);
r = await call('POST', '/iot/device/ack', { cmdId, ok: true }, { 'x-device-user': creds.mqttUsername, 'x-device-secret': creds.secret });
r = await call('GET', `/iot/farms/${farmId}/commands`);
check('histórico de comandos (inclui rejeitados)', r.data.some((c) => c.status === 'ACKED') && r.data.filter((c) => c.status === 'REJECTED').length >= 3);

// Regras
r = await call('POST', `/iot/farms/${farmId}/rules`, { name: 'Rega zona norte', sensorId: sm.id, threshold: 30, stopThreshold: 45, actuatorId: pump.id, maxDurationSec: 600 });
check('regra de bomba exige sensor de nível', r.status === 400, r.data.message);
r = await call('POST', `/iot/farms/${farmId}/rules`, { name: 'Rega', sensorId: sm.id, threshold: 30, stopThreshold: 25, actuatorId: pump.id, maxDurationSec: 600, waterLevelSensorId: wl.id, minWaterLevel: 1 });
check('regra sem histerese rejeitada', r.status === 400);
r = await call('POST', `/iot/farms/${farmId}/rules`, { name: 'Rega zona norte', sensorId: sm.id, threshold: 30, stopThreshold: 45, actuatorId: pump.id, maxDurationSec: 600, waterLevelSensorId: wl.id, minWaterLevel: 1 });
check('criar regra válida', r.status === 201);

r = await call('GET', `/iot/sensors/${sm.id}/readings?bucket=hour`);
check('histórico agregado de leituras', r.status === 200 && r.data.points.length >= 1);

// Biblioteca
r = await call('GET', '/projects?category=SMART_IRRIGATION');
check('AgroTech Lab: filtro por categoria', r.data.length >= 3 && r.data.every((p) => p.category === 'SMART_IRRIGATION'));
r = await call('GET', '/projects?q=pH');
check('AgroTech Lab: pesquisa', r.data.some((p) => p.slug === 'soil-ph-monitoring'));
r = await call('POST', '/projects/esp32-smart-irrigation/favorite');
check('favoritos', r.data.isFavorite === true);
r = await call('GET', '/projects/compare?slugs=esp32-smart-irrigation,automated-drip-irrigation');
check('comparar projetos', r.data.length === 2);
r = await call('GET', '/projects/esp32-smart-irrigation');
check('detalhe com firmware ESP32', r.data.firmware?.includes('safetyLoop'));

// IA (modo regras sem chave)
r = await call('POST', '/ai/ask', { farmId, message: 'Como posso reduzir o consumo de água?' });
check('Agro AI responde com dados da propriedade', r.status === 201 && /Fazenda Chianga/.test(r.data.message.content), r.data.message?.engine);

// Dashboard, notificações, relatórios
r = await call('GET', '/dashboard');
check('dashboard', r.status === 200 && r.data.kpis.farmCount === 1 && r.data.kpis.totalAreaHa === 5);
r = await call('GET', '/notifications');
check('notificações (humidade/recomendações)', r.data.length >= 1, r.data.map((n) => n.type).join(','));
for (const type of ['farm', 'finance', 'recommendations', 'sensors']) {
  r = await call('GET', `/reports/${type}?farmId=${farmId}`);
  check(`relatório PDF ${type}`, r.status === 200 && Buffer.isBuffer(r.data) && r.data.subarray(0, 4).toString() === '%PDF', `${r.data.length ?? 0} bytes`);
}

// Multi-tenant: outro utilizador não vê esta propriedade
const myToken = token;
token = null;
cookie = '';
r = await call('POST', '/auth/register', { fullName: 'Outro Agricultor', email: `outro.${Date.now()}@teste.ao`, password: 'Feijao2026' });
token = r.data.accessToken;
r = await call('GET', `/farms/${farmId}`);
check('multi-tenant: acesso negado a propriedade alheia', r.status === 404);
r = await call('POST', `/iot/actuators/${pump.id}/command`, { action: 'OFF' });
check('multi-tenant: comando negado a atuador alheio', r.status === 404);
r = await call('GET', '/admin/stats');
check('RBAC: agricultor sem acesso a admin', r.status === 403);
token = myToken;

// Refresh rotativo
r = await call('POST', '/auth/refresh');
check('refresh token rotativo', r.status === 200 && r.data.accessToken);

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações OK`);
process.exit(failed.length ? 1 : 0);
