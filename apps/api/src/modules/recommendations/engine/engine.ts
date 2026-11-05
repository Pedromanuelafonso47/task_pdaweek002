/**
 * Motor de Inteligência Agrícola — recomendações de automação IoT.
 *
 * Princípios:
 *  1. Nenhuma recomendação sem ligação a um problema ou objetivo declarado (sem genéricos).
 *  2. Cada ponto de pontuação vem com uma razão legível que cita dados da propriedade.
 *  3. Custos são calculados a partir da lista de materiais dimensionada para a propriedade.
 *  4. Estimativas (ROI) só existem quando há dados reais; caso contrário diz-se o que falta.
 *  5. Determinístico: os mesmos dados produzem sempre o mesmo resultado (testável).
 */
import { LABELS, PROVINCE_CLIMATE, formatKz, type AngolaProvince } from '@agrogenius/shared';
import {
  ENGINE_VERSION,
  type BomLine,
  type CatalogComponent,
  type CatalogProject,
  type EngineRecommendation,
  type EngineResult,
  type FarmProfile,
  type Phase,
  type Reason,
  type RoiEstimate,
} from './types';

const TECH_SCORE = { NONE: 0, BASIC: 1, INTERMEDIATE: 2, ADVANCED: 3 } as const;
const DIFFICULTY_SCORE = { BEGINNER: 0.5, INTERMEDIATE: 1.5, ADVANCED: 2.5 } as const;

/** Tamanho de referência de uma zona de rega controlada por um conjunto sensor + válvula. */
const DEFAULT_ZONE_SIZE_HA = 1.5;
const MAX_AUTO_ZONES = 8;
const MIN_SCORE = 20;

/**
 * Poupança de água conservadora ao passar de rega manual/por calendário para rega
 * baseada em humidade do solo. A literatura reporta tipicamente 20–40%; usamos o limite baixo.
 */
const WATER_SAVINGS_RATE = 0.2;
/** Fração assumida do custo de mão de obra dedicada à rega manual. */
const LABOR_IRRIGATION_SHARE = 0.15;

const WATER_CATEGORIES = new Set(['SMART_IRRIGATION', 'RESOURCE_MANAGEMENT']);

export function estimateZones(profile: FarmProfile): { zones: number; inferred: boolean } {
  if (profile.zoneCount > 0) return { zones: profile.zoneCount, inferred: false };
  const area = Math.max(profile.cultivatedAreaHa, 0.1);
  const zones = Math.min(MAX_AUTO_ZONES, Math.max(1, Math.ceil(area / DEFAULT_ZONE_SIZE_HA)));
  return { zones, inferred: true };
}

function conditionMet(condition: string | null | undefined, p: FarmProfile): boolean {
  switch (condition) {
    case null:
    case undefined:
    case '':
      return true;
    case 'NO_PUMP':
      return !p.hasPumps;
    case 'NO_ELECTRICITY':
      return !p.hasElectricity;
    case 'HAS_ELECTRICITY':
      return p.hasElectricity;
    case 'NO_INTERNET':
      return p.internet !== 'GOOD';
    case 'HAS_INTERNET':
      return p.internet === 'GOOD';
    default:
      return true;
  }
}

function lineQuantity(c: CatalogComponent, p: FarmProfile, zones: number): { qty: number; note?: string } {
  let qty: number;
  let note: string | undefined;
  switch (c.quantityRule) {
    case 'PER_HECTARE':
      qty = Math.ceil(c.quantity * Math.max(p.cultivatedAreaHa, 0.1));
      note = `${c.quantity} por hectare × ${p.cultivatedAreaHa} ha cultivados`;
      break;
    case 'PER_ZONE':
      qty = Math.ceil(c.quantity * zones);
      note = `${c.quantity} por zona × ${zones} zona(s)`;
      break;
    default:
      qty = c.quantity;
  }
  if (c.maxQuantity && qty > c.maxQuantity) {
    qty = c.maxQuantity;
    note = `${note ?? ''} (limitado a ${c.maxQuantity})`.trim();
  }
  return { qty, note };
}

export function buildBom(project: CatalogProject, p: FarmProfile, zones: number): BomLine[] {
  return project.components
    .filter((c) => conditionMet(c.condition, p))
    .map((c) => {
      const { qty, note } = lineQuantity(c, p, zones);
      let fullNote = note;
      if (c.condition === 'NO_PUMP') fullNote = 'Incluído porque não tens bomba de água registada';
      if (c.condition === 'NO_ELECTRICITY') fullNote = 'Alimentação solar: não há eletricidade na propriedade';
      return {
        name: c.name,
        spec: c.spec ?? null,
        quantity: qty,
        unitPriceKz: c.unitPriceKz,
        totalKz: Math.round(qty * c.unitPriceKz),
        optional: c.optional,
        note: fullNote,
      };
    });
}

const sumRequired = (lines: BomLine[]) => lines.filter((l) => !l.optional).reduce((s, l) => s + l.totalKz, 0);

function buildPhases(project: CatalogProject, p: FarmProfile, zones: number, total: number): Phase[] {
  if (zones <= 1 || !project.components.some((c) => c.quantityRule !== 'FIXED')) return [];
  const pilot = sumRequired(buildBom(project, { ...p, cultivatedAreaHa: DEFAULT_ZONE_SIZE_HA }, 1));
  if (pilot >= total) return [];
  return [
    {
      name: 'Fase 1 — Piloto numa zona',
      description:
        'Instalar o controlador e uma zona completa para validar o funcionamento e medir resultados reais antes de expandir.',
      costKz: pilot,
    },
    {
      name: `Fase 2 — Expansão para ${zones} zonas`,
      description: 'Replicar sensores e válvulas nas restantes zonas, reutilizando o mesmo controlador.',
      costKz: total - pilot,
    },
  ];
}

function estimateRoi(project: CatalogProject, p: FarmProfile, cost: number): RoiEstimate {
  if (!WATER_CATEGORIES.has(project.category)) {
    return {
      kind: 'INSUFFICIENT_DATA',
      missing: ['Benefício económico direto difícil de quantificar sem histórico de produção e perdas'],
    };
  }
  const missing: string[] = [];
  if (p.annualIrrigationCostKz === null) missing.push('Custos de rega dos últimos 12 meses (água, combustível, energia)');
  if (p.annualLaborCostKz === null) missing.push('Custos de mão de obra dos últimos 12 meses');
  if (p.annualIrrigationCostKz === null && p.annualLaborCostKz === null) {
    return { kind: 'INSUFFICIENT_DATA', missing };
  }
  const irrigationSavings = (p.annualIrrigationCostKz ?? 0) * WATER_SAVINGS_RATE;
  const laborSavings = (p.annualLaborCostKz ?? 0) * LABOR_IRRIGATION_SHARE * 0.5;
  const annualSavingsKz = Math.round(irrigationSavings + laborSavings);
  if (annualSavingsKz <= 0) return { kind: 'INSUFFICIENT_DATA', missing };
  const assumptions = [
    `Poupança de ${WATER_SAVINGS_RATE * 100}% nos custos de rega (limite conservador de estudos de rega por humidade do solo; não medido na tua propriedade).`,
  ];
  if (p.annualLaborCostKz !== null) {
    assumptions.push(
      `${LABOR_IRRIGATION_SHARE * 100}% da mão de obra é dedicada à rega e metade desse tempo é libertado pela automação.`,
    );
  }
  if (missing.length) assumptions.push(`Dados em falta tratados como zero: ${missing.join('; ')}.`);
  return {
    kind: 'ESTIMATE',
    annualSavingsKz,
    paybackMonths: Math.round((cost / (annualSavingsKz / 12)) * 10) / 10,
    assumptions,
  };
}

function cropsByNeed(p: FarmProfile, need: 'HIGH' | 'MEDIUM' | 'LOW') {
  return p.crops.filter((c) => c.waterNeed === need).map((c) => c.name);
}

/** Avalia um projeto para uma propriedade. Devolve `excluded` com motivo quando não se aplica. */
export function evaluateProject(
  project: CatalogProject,
  p: FarmProfile,
): { rec: EngineRecommendation } | { excluded: string } {
  const reasons: Reason[] = [];
  const warnings: string[] = [];
  const add = (code: string, weight: number, text: string) => reasons.push({ code, weight, text });
  const climate = PROVINCE_CLIMATE[p.province as AngolaProvince];
  const isIrrigation = !!project.controlsIrrigation;
  const requires = project.requires ?? [];

  // ── Restrições eliminatórias ──
  if (requires.includes('WATER_SOURCE') && p.waterSource === 'NONE') {
    return { excluded: 'Sem fonte de água registada: não há água para a automação controlar.' };
  }
  if (requires.includes('PUMP') && !p.hasPumps) {
    return { excluded: 'Destina-se a bombas existentes e a propriedade não tem bomba registada.' };
  }
  if (requires.includes('GRID_ELECTRICITY') && !p.hasElectricity) {
    return { excluded: 'Requer ligação à rede elétrica, que não existe na propriedade.' };
  }
  if (!project.worksOffline && p.internet === 'NONE') {
    return { excluded: 'Precisa de internet para funcionar e a propriedade não tem ligação.' };
  }
  if (project.slug.includes('drip') && p.irrigationSystem === 'PIVOT') {
    return { excluded: 'A propriedade já usa pivô central; converter para gota-a-gota não é prioritário.' };
  }

  // ── Relevância: problemas e objetivos declarados ──
  for (const prob of p.problems) {
    if (project.solves.includes(prob)) {
      add(`PROBLEM_${prob}`, 25, `Declaraste "${LABELS.problem[prob]}" — este projeto atua diretamente sobre esse problema.`);
    }
  }
  for (const goal of p.goals) {
    if (project.supportsGoals.includes(goal)) {
      add(`GOAL_${goal}`, 15, `Contribui para o teu objetivo "${LABELS.goal[goal]}".`);
    }
  }
  if (reasons.length === 0) {
    return { excluded: 'Não responde a nenhum problema ou objetivo declarado para esta propriedade.' };
  }

  // ── Contexto da propriedade ──
  if (isIrrigation) {
    if (p.irrigationSystem === 'MANUAL' || p.irrigationSystem === 'NONE') {
      add(
        'IRRIGATION_MANUAL',
        15,
        `A rega é ${p.irrigationSystem === 'MANUAL' ? 'manual' : 'inexistente'} em ${p.cultivatedAreaHa} ha: decidir quando regar com base na humidade real do solo evita regas desnecessárias.`,
      );
    } else if (p.irrigationSystem === 'FURROW') {
      add('IRRIGATION_FURROW', 8, 'A rega por sulcos perde muita água por escoamento e infiltração profunda.');
    }
    const thirsty = cropsByNeed(p, 'HIGH');
    if (thirsty.length) {
      add('CROP_HIGH_WATER', 10, `${thirsty.join(', ')} ${thirsty.length > 1 ? 'têm' : 'tem'} elevada necessidade de água.`);
    }
    if (p.waterAvailability === 'SCARCE' || p.waterAvailability === 'SEASONAL') {
      add('WATER_LIMITED', 10, `A disponibilidade de água é ${LABELS.waterAvailability[p.waterAvailability].toLowerCase()}: cada litro poupado conta.`);
    }
    if (p.waterSource === 'WELL' || p.waterSource === 'BOREHOLE') {
      add('WATER_SOURCE_PUMPED', 5, `A água vem de ${LABELS.waterSource[p.waterSource].toLowerCase()}, o que limita o caudal disponível por dia.`);
    }
    if (p.soilType === 'CLAY' || p.soilType === 'CLAY_LOAM') {
      add('SOIL_CLAY', 5, 'Solo argiloso retém água durante mais tempo: regar por calendário tende a encharcar. Sensores evitam isso.');
    }
    if (p.soilType === 'SANDY' || p.soilType === 'SANDY_LOAM') {
      add('SOIL_SANDY', 5, 'Solo arenoso drena depressa: regas curtas e frequentes, controladas por sensor, reduzem perdas.');
    }
  }
  if (climate === 'ARID' || climate === 'SEMI_ARID') {
    if (WATER_CATEGORIES.has(project.category) || project.category === 'ENVIRONMENTAL_MONITORING') {
      add('CLIMATE_DRY', 8, `${p.province} está numa zona de clima seco/semiárido (classificação regional aproximada).`);
    }
  }
  if (project.category === 'SOIL_MONITORING') {
    if (p.soilType === 'UNKNOWN') add('SOIL_UNKNOWN', 10, 'O tipo de solo é desconhecido: medir é o primeiro passo para decisões de rega e adubação.');
    if (p.hasSensors) add('HAS_SENSORS', -10, 'Já existem sensores na propriedade; verifica se este projeto acrescenta medições novas.');
  }
  if (project.category === 'ENVIRONMENTAL_MONITORING' && climate === 'HIGHLAND') {
    add('CLIMATE_HIGHLAND', 5, `No planalto (${p.province}) as variações de temperatura entre dia e noite são grandes: dados locais ajudam a planear.`);
  }
  if (project.category === 'RESOURCE_MANAGEMENT' && p.hasPumps) {
    add('HAS_PUMPS', 10, 'Tens bombas de água: monitorizar o seu funcionamento evita avarias e funcionamento a seco.');
  }

  // ── Viabilidade técnica ──
  if (project.worksOffline && p.internet !== 'GOOD') {
    add('OFFLINE_OK', 5, 'Funciona sem internet: decide localmente e envia dados quando houver ligação.');
  }
  if (!project.worksOffline && p.internet === 'LIMITED') {
    add('INTERNET_LIMITED', -10, 'Depende de internet e a ligação é limitada.');
    warnings.push('Funcionalidades em tempo real ficam degradadas com internet limitada.');
  }
  if (project.requiresElectricity && !p.hasElectricity) {
    add('NO_ELECTRICITY', -5, 'Sem eletricidade: a lista inclui alimentação solar, o que aumenta o custo.');
  }
  const gap = DIFFICULTY_SCORE[project.difficulty] - TECH_SCORE[p.techLevel];
  if (gap > 1) {
    add('SKILL_GAP', -10, `Complexidade ${LABELS.difficulty[project.difficulty].toLowerCase()} face a um nível tecnológico ${LABELS.techLevel[p.techLevel].toLowerCase()}.`);
    warnings.push('Recomenda-se acompanhamento de um técnico na instalação.');
  } else if (project.difficulty === 'BEGINNER') {
    add('EASY', 5, 'Montagem simples, adequada para começar.');
  }

  // ── Custo e orçamento ──
  const { zones, inferred } = estimateZones(p);
  const bom = buildBom(project, p, zones);
  const cost = sumRequired(bom);
  const phases = buildPhases(project, p, zones, cost);
  if (inferred && project.components.some((c) => c.quantityRule === 'PER_ZONE')) {
    warnings.push(`A propriedade ainda não tem zonas registadas: assumimos ${zones} zona(s) de ~${DEFAULT_ZONE_SIZE_HA} ha. Regista as zonas para um cálculo exato.`);
  }

  let withinBudget = true;
  if (p.budgetKz === null) {
    warnings.push('Sem orçamento indicado: não foi possível verificar a viabilidade financeira.');
  } else if (cost <= p.budgetKz) {
    add('BUDGET_OK', 5, `Custo estimado ${formatKz(cost)} cabe no orçamento de ${formatKz(p.budgetKz)}.`);
  } else if (phases.length && phases[0].costKz <= p.budgetKz) {
    withinBudget = false;
    add('BUDGET_PHASED', 0, `O projeto completo (${formatKz(cost)}) excede o orçamento, mas o piloto (${formatKz(phases[0].costKz)}) cabe.`);
    warnings.push('Recomenda-se implementação faseada, começando pelo piloto.');
  } else {
    withinBudget = false;
    add('BUDGET_OVER', -25, `Custo estimado ${formatKz(cost)} excede o orçamento de ${formatKz(p.budgetKz)}.`);
  }

  const score = Math.max(0, Math.min(100, Math.round(reasons.reduce((s, r) => s + r.weight, 0))));
  if (score < MIN_SCORE) {
    return { excluded: `Pontuação baixa (${score}) para as condições desta propriedade.` };
  }

  const waterCritical =
    (p.problems.includes('DROUGHT') || p.problems.includes('WATER_WASTE')) &&
    p.waterAvailability === 'SCARCE' &&
    WATER_CATEGORIES.has(project.category);
  const priority = score >= 85 && waterCritical ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';

  const main = reasons.filter((r) => r.code.startsWith('PROBLEM_')).sort((a, b) => b.weight - a.weight)[0];
  const problem = main
    ? LABELS.problem[main.code.replace('PROBLEM_', '') as keyof typeof LABELS.problem]
    : LABELS.goal[(reasons.find((r) => r.code.startsWith('GOAL_'))!.code.replace('GOAL_', '')) as keyof typeof LABELS.goal];

  return {
    rec: {
      projectId: project.id,
      projectSlug: project.slug,
      score,
      priority,
      problem,
      reasons: reasons.sort((a, b) => b.weight - a.weight),
      bom,
      estimatedCostKz: cost,
      withinBudget,
      phases,
      roi: estimateRoi(project, p, cost),
      warnings,
    },
  };
}

export function recommend(profile: FarmProfile, catalog: CatalogProject[], limit = 6): EngineResult {
  const recommendations: EngineRecommendation[] = [];
  const excluded: EngineResult['excluded'] = [];
  for (const project of catalog) {
    const r = evaluateProject(project, profile);
    if ('rec' in r) recommendations.push(r.rec);
    else excluded.push({ projectSlug: project.slug, reason: r.excluded });
  }
  recommendations.sort((a, b) => b.score - a.score || a.estimatedCostKz - b.estimatedCostKz);

  const missingData: string[] = [];
  if (profile.budgetKz === null) missingData.push('Orçamento disponível para tecnologia');
  if (profile.soilType === 'UNKNOWN') missingData.push('Tipo de solo');
  if (profile.crops.length === 0) missingData.push('Culturas cultivadas');
  if (profile.zoneCount === 0) missingData.push('Divisão da propriedade em zonas');
  if (profile.annualIrrigationCostKz === null) missingData.push('Registo de despesas de rega (para estimar retorno)');
  if (profile.problems.length === 0) missingData.push('Problemas enfrentados');

  return { version: ENGINE_VERSION, recommendations: recommendations.slice(0, limit), excluded, missingData };
}
