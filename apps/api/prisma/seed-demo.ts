/**
 * Conta de DEMONSTRAÇÃO — todos os dados criados aqui são fictícios e a propriedade
 * fica marcada com isDemo=true (a interface mostra a etiqueta "Dados de demonstração").
 *
 *   npm run seed:demo        → demo@agrogenius.ao / Demo2026!
 *
 * Requer o seed do catálogo (npm run db:seed) já executado.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { CATALOG } from '../src/modules/projects/catalog/catalog';
import { recommend } from '../src/modules/recommendations/engine/engine';
import type { CatalogProject, FarmProfile } from '../src/modules/recommendations/engine/types';

const prisma = new PrismaClient();
const EMAIL = 'demo@agrogenius.ao';
const DAY = 86_400_000;

// Retângulo de ~5 ha perto da Chianga (Huambo). lon/lat.
const W = 15.828, E = 15.8303, N = -12.7385, S = -12.7403;
const ring = (w: number, e: number, n: number, s: number) => [[[w, n], [e, n], [e, s], [w, s], [w, n]]] as [number, number][][];
const midLon = (W + E) / 2, midLat = (N + S) / 2;

/** Gerador pseudo-aleatório determinístico (os dados demo são sempre iguais). */
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    await prisma.farm.deleteMany({ where: { ownerId: existing.id } });
    await prisma.transaction.deleteMany({ where: { organizationId: existing.organizationId } });
    await prisma.user.delete({ where: { id: existing.id } });
  }
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      fullName: 'Agricultor Demonstração',
      phone: '+244 900 000 000',
      province: 'Huambo',
      municipality: 'Huambo',
      locality: 'Chianga',
      farmerType: 'FAMILY',
      onboardingCompleted: true,
      passwordHash: await argon2.hash('Demo2026!', { type: argon2.argon2id }),
      organization: { create: { name: 'Demonstração', type: 'INDIVIDUAL' } },
    },
  });

  const farm = await prisma.farm.create({
    data: {
      isDemo: true,
      organizationId: user.organizationId,
      ownerId: user.id,
      name: 'Fazenda Demonstração Chianga',
      province: 'Huambo',
      municipality: 'Huambo',
      locality: 'Chianga',
      latitude: midLat,
      longitude: midLon,
      boundary: { type: 'Polygon', coordinates: ring(W, E, N, S) },
      totalAreaHa: 5,
      cultivatedAreaHa: 4.6,
      terrainType: 'GENTLE_SLOPE',
      soilType: 'CLAY',
      waterAvailability: 'SEASONAL',
      waterSource: 'WELL',
      irrigationSystem: 'MANUAL',
      hasElectricity: true,
      internet: 'LIMITED',
      hasPumps: true,
      techLevel: 'BASIC',
      budgetKz: 300000,
      goals: ['REDUCE_WATER', 'AUTOMATE_IRRIGATION', 'MONITOR_CLIMATE'],
      problems: ['WATER_WASTE', 'IRREGULAR_RAIN'],
      history: { create: { type: 'DEMO', summary: 'Propriedade de demonstração criada (dados fictícios)' } },
    },
  });

  const lonStep = (E - W) / 2, latStep = (N - S) / 2;
  const zonesDef = [
    { name: 'Zona A — Milho', color: '#27C77B', irrig: true, w: W, e: W + lonStep, n: N, s: N - latStep },
    { name: 'Zona B — Milho', color: '#1FA463', irrig: true, w: W + lonStep, e: E, n: N, s: N - latStep },
    { name: 'Zona C — Feijão', color: '#B7F3D0', irrig: true, w: W, e: W + lonStep, n: N - latStep, s: S },
    { name: 'Zona D — Hortícolas', color: '#F2C14E', irrig: false, w: W + lonStep, e: E, n: N - latStep, s: S },
  ];
  const zones = [];
  for (const z of zonesDef) {
    zones.push(
      await prisma.field.create({
        data: { farmId: farm.id, name: z.name, areaHa: 1.15, color: z.color, isIrrigationZone: z.irrig, soilType: 'CLAY', boundary: { type: 'Polygon', coordinates: ring(z.w, z.e, z.n, z.s) } },
      }),
    );
  }

  const crop = async (slug: string) => prisma.crop.findUniqueOrThrow({ where: { slug } });
  const [milho, feijao, tomate] = await Promise.all([crop('milho'), crop('feijao'), crop('tomate')]);
  const planted = new Date(Date.now() - 52 * DAY);
  const plantings = [
    await prisma.planting.create({ data: { farmId: farm.id, fieldId: zones[0].id, cropId: milho.id, areaHa: 1.15, plantedAt: planted, expectedHarvestAt: new Date(planted.getTime() + milho.cycleDays * DAY), status: 'GROWING', estimatedYieldKg: 2900, seedVariety: 'ZM 523', season: 'Época A' } }),
    await prisma.planting.create({ data: { farmId: farm.id, fieldId: zones[1].id, cropId: milho.id, areaHa: 1.15, plantedAt: planted, expectedHarvestAt: new Date(planted.getTime() + milho.cycleDays * DAY), status: 'GROWING', estimatedYieldKg: 2900, seedVariety: 'ZM 523', season: 'Época A' } }),
    await prisma.planting.create({ data: { farmId: farm.id, fieldId: zones[2].id, cropId: feijao.id, areaHa: 1.15, plantedAt: new Date(Date.now() - 70 * DAY), expectedHarvestAt: new Date(Date.now() + 20 * DAY), status: 'GROWING', estimatedYieldKg: 1100, season: 'Época A' } }),
    await prisma.planting.create({ data: { farmId: farm.id, fieldId: zones[3].id, cropId: tomate.id, areaHa: 1.15, status: 'PLANNED', season: 'Cacimbo' } }),
  ];
  await prisma.cropActivity.createMany({
    data: [
      { plantingId: plantings[0].id, type: 'SOWING', date: planted, product: 'Semente ZM 523', quantity: 25, unit: 'kg' },
      { plantingId: plantings[0].id, type: 'FERTILIZER', date: new Date(planted.getTime() + 20 * DAY), product: 'NPK 12-24-12', quantity: 150, unit: 'kg' },
      { plantingId: plantings[2].id, type: 'TREATMENT', date: new Date(Date.now() - 15 * DAY), product: 'Fungicida cúprico', quantity: 2, unit: 'L', notes: 'Manchas nas folhas observadas na bordadura' },
    ],
  });

  const tx = (type: 'EXPENSE' | 'INCOME', category: Prisma.TransactionCreateManyInput['category'], amount: number, daysAgo: number, description: string, plantingId?: string) => ({
    organizationId: user.organizationId, farmId: farm.id, plantingId, type, category, amount, date: new Date(Date.now() - daysAgo * DAY), description,
  });
  await prisma.transaction.createMany({
    data: [
      tx('EXPENSE', 'SEEDS', 62000, 52, 'Semente de milho ZM 523 (50 kg)', plantings[0].id),
      tx('EXPENSE', 'FERTILIZER', 145000, 32, 'NPK 12-24-12 (300 kg)', plantings[0].id),
      tx('EXPENSE', 'LABOR', 240000, 30, 'Mão de obra — sacha e rega'),
      tx('EXPENSE', 'FUEL', 96000, 25, 'Combustível da motobomba'),
      tx('EXPENSE', 'IRRIGATION', 38000, 10, 'Manutenção da bomba'),
      tx('EXPENSE', 'PESTICIDE', 18000, 15, 'Fungicida cúprico', plantings[2].id),
      tx('INCOME', 'SALES', 410000, 120, 'Venda de milho da época anterior'),
      tx('EXPENSE', 'LABOR', 220000, 150, 'Mão de obra — colheita anterior'),
    ],
  });

  // Dispositivo de demonstração + histórico SIMULADO (só porque a propriedade é demo)
  const device = await prisma.device.create({
    data: {
      farmId: farm.id,
      name: 'Controlador de rega (demo)',
      type: 'CONTROLLER',
      mqttUsername: `dev_demo${Date.now().toString(16).slice(-6)}`,
      secretHash: createHash('sha256').update('demo-secret').digest('hex'),
      status: 'OFFLINE',
      mode: 'AUTO',
      localRules: true,
      lastSeenAt: new Date(Date.now() - 2 * 3600_000),
      latitude: midLat,
      longitude: midLon,
      sensors: {
        create: [
          { key: 'sm1', kind: 'SOIL_MOISTURE', unit: '%', fieldId: zones[0].id, minThreshold: 30, maxThreshold: 70 },
          { key: 'sm2', kind: 'SOIL_MOISTURE', unit: '%', fieldId: zones[1].id, minThreshold: 30, maxThreshold: 70 },
          { key: 'sm3', kind: 'SOIL_MOISTURE', unit: '%', fieldId: zones[2].id, minThreshold: 35, maxThreshold: 70 },
          { key: 'temp', kind: 'AIR_TEMPERATURE', unit: '°C', maxThreshold: 34 },
          { key: 'water', kind: 'WATER_LEVEL', unit: 'bool', minThreshold: 1 },
        ],
      },
      actuators: { create: [{ key: 'v1', kind: 'VALVE', name: 'Válvula zona A', maxRuntimeSec: 1800 }, { key: 'v2', kind: 'VALVE', name: 'Válvula zona B', maxRuntimeSec: 1800 }, { key: 'v3', kind: 'VALVE', name: 'Válvula zona C', maxRuntimeSec: 1800 }] },
    },
    include: { sensors: true, actuators: true },
  });
  const rand = rng(42);
  const readings: Prisma.SensorReadingCreateManyInput[] = [];
  const now = Date.now();
  for (let h = 7 * 24; h >= 2; h--) {
    const t = new Date(now - h * 3600_000);
    const hourOfDay = (t.getUTCHours() + 1) % 24;
    for (const s of device.sensors) {
      let v: number;
      if (s.kind === 'SOIL_MOISTURE') {
        // secagem diária + rega quando abaixo de 30 (dente de serra)
        const phase = (h + Number(s.key.slice(2)) * 9) % 40;
        v = 58 - phase * 0.75 + (rand() - 0.5) * 2;
      } else if (s.kind === 'AIR_TEMPERATURE') v = 17 + 9 * Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI) + (rand() - 0.5) * 1.5;
      else v = 1;
      readings.push({ sensorId: s.id, value: Math.round(v * 10) / 10, recordedAt: t });
    }
  }
  await prisma.sensorReading.createMany({ data: readings });
  for (let i = 0; i < 3; i++) {
    const s = device.sensors.find((x) => x.key === `sm${i + 1}`)!;
    await prisma.automationRule.create({
      data: { farmId: farm.id, name: `Rega automática zona ${'ABC'[i]}`, sensorId: s.id, threshold: 30, stopThreshold: 45, actuatorId: device.actuators[i].id, maxDurationSec: 900, cooldownSec: 1800 },
    });
  }

  // Recomendações reais do motor para esta propriedade demo
  const projects = await prisma.project.findMany({ include: { components: true } });
  if (projects.length !== CATALOG.length) console.warn('Catálogo incompleto — corre npm run db:seed primeiro.');
  const catalog: CatalogProject[] = projects.map((p) => ({
    ...p,
    components: p.components.map((c) => ({ ...c, unitPriceKz: Number(c.unitPriceKz) })),
  }));
  const profile: FarmProfile = {
    province: 'Huambo', totalAreaHa: 5, cultivatedAreaHa: 4.6, terrainType: 'GENTLE_SLOPE', soilType: 'CLAY', waterAvailability: 'SEASONAL', waterSource: 'WELL', irrigationSystem: 'MANUAL',
    hasElectricity: true, internet: 'LIMITED', hasSensors: false, hasPumps: true, hasMachinery: false, techLevel: 'BASIC', budgetKz: 300000,
    goals: ['REDUCE_WATER', 'AUTOMATE_IRRIGATION', 'MONITOR_CLIMATE'], problems: ['WATER_WASTE', 'IRREGULAR_RAIN'],
    crops: [{ slug: 'milho', name: 'Milho', waterNeed: 'MEDIUM', areaHa: 2.3 }, { slug: 'feijao', name: 'Feijão', waterNeed: 'MEDIUM', areaHa: 1.15 }, { slug: 'tomate', name: 'Tomate', waterNeed: 'HIGH', areaHa: 1.15 }],
    zoneCount: 4, annualIrrigationCostKz: 134000, annualLaborCostKz: 460000,
  };
  const result = recommend(profile, catalog);
  for (const r of result.recommendations) {
    await prisma.recommendation.create({
      data: {
        farmId: farm.id, projectId: r.projectId, source: 'ENGINE', engineVersion: result.version, score: r.score, rawScore: r.rawScore, priority: r.priority, problem: r.problem,
        reasons: r.reasons as unknown as Prisma.InputJsonValue, bom: r.bom as unknown as Prisma.InputJsonValue, estimatedCostKz: r.estimatedCostKz,
        withinBudget: r.withinBudget, roi: r.roi as unknown as Prisma.InputJsonValue, phases: r.phases as unknown as Prisma.InputJsonValue, warnings: r.warnings,
      },
    });
  }
  console.log(`✔ Conta demo: ${EMAIL} / Demo2026! — ${zones.length} zonas, ${readings.length} leituras simuladas, ${result.recommendations.length} recomendações`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
