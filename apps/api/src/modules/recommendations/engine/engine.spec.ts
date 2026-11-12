import { CATALOG } from '../../projects/catalog/catalog';
import { estimateZones, recommend } from './engine';
import type { CatalogProject, FarmProfile } from './types';

const catalog: CatalogProject[] = CATALOG.map((p, i) => ({
  id: `p${i}`,
  slug: p.slug,
  title: p.title,
  category: p.category,
  difficulty: p.difficulty,
  solves: p.solves,
  supportsGoals: p.supportsGoals,
  requiresElectricity: p.requiresElectricity,
  worksOffline: p.worksOffline,
  requires: p.requires,
  controlsIrrigation: p.controlsIrrigation,
  components: p.components.map((c) => ({
    ...c,
    quantityRule: c.quantityRule ?? 'FIXED',
    optional: c.optional ?? false,
  })),
}));

/** Exemplo do enunciado: Huambo, 5 ha de milho, poço, rega manual, 300 000 Kz. */
const huambo: FarmProfile = {
  province: 'Huambo',
  totalAreaHa: 5,
  cultivatedAreaHa: 5,
  terrainType: 'FLAT',
  soilType: 'CLAY',
  waterAvailability: 'MODERATE',
  waterSource: 'WELL',
  irrigationSystem: 'MANUAL',
  hasElectricity: true,
  internet: 'LIMITED',
  hasSensors: false,
  hasPumps: false,
  hasMachinery: false,
  techLevel: 'BASIC',
  budgetKz: 300_000,
  goals: ['REDUCE_WATER', 'AUTOMATE_IRRIGATION'],
  problems: ['WATER_WASTE'],
  crops: [{ slug: 'milho', name: 'Milho', waterNeed: 'MEDIUM', areaHa: 5 }],
  zoneCount: 0,
  annualIrrigationCostKz: null,
  annualLaborCostKz: null,
};

describe('Motor de recomendações', () => {
  it('recomenda irrigação inteligente com ESP32 em primeiro lugar para o caso Huambo', () => {
    const r = recommend(huambo, catalog);
    expect(r.recommendations[0].projectSlug).toBe('esp32-smart-irrigation');
    const top = r.recommendations[0];
    expect(top.problem).toBe('Desperdício de água');
    expect(top.reasons.map((x) => x.code)).toEqual(
      expect.arrayContaining(['PROBLEM_WATER_WASTE', 'IRRIGATION_MANUAL', 'SOIL_CLAY', 'OFFLINE_OK']),
    );
  });

  it('inclui a bomba na lista de materiais apenas quando não existe bomba', () => {
    const sem = recommend(huambo, catalog).recommendations[0];
    const com = recommend({ ...huambo, hasPumps: true }, catalog).recommendations.find(
      (x) => x.projectSlug === 'esp32-smart-irrigation',
    )!;
    expect(sem.bom.some((l) => l.name.includes('Bomba'))).toBe(true);
    expect(com.bom.some((l) => l.name.includes('Bomba'))).toBe(false);
    expect(com.estimatedCostKz).toBeLessThan(sem.estimatedCostKz);
  });

  it('dimensiona por zonas e propõe faseamento quando o total excede o orçamento', () => {
    expect(estimateZones(huambo)).toEqual({ zones: 4, inferred: true });
    const top = recommend(huambo, catalog).recommendations[0];
    expect(top.estimatedCostKz).toBeGreaterThan(300_000);
    expect(top.withinBudget).toBe(false);
    expect(top.phases).toHaveLength(2);
    expect(top.phases[0].costKz).toBeLessThanOrEqual(300_000);
    expect(top.phases[0].costKz + top.phases[1].costKz).toBe(top.estimatedCostKz);
  });

  it('não inventa retorno do investimento sem dados financeiros', () => {
    const top = recommend(huambo, catalog).recommendations[0];
    expect(top.roi.kind).toBe('INSUFFICIENT_DATA');
  });

  it('calcula ROI marcado como estimativa quando há custos reais registados', () => {
    const top = recommend({ ...huambo, annualIrrigationCostKz: 600_000, annualLaborCostKz: 1_200_000 }, catalog)
      .recommendations[0];
    expect(top.roi.kind).toBe('ESTIMATE');
    if (top.roi.kind === 'ESTIMATE') {
      expect(top.roi.annualSavingsKz).toBe(600_000 * 0.2 + 1_200_000 * 0.15 * 0.5);
      expect(top.roi.assumptions.length).toBeGreaterThan(0);
    }
  });

  it('exclui irrigação quando não há fonte de água', () => {
    const r = recommend({ ...huambo, waterSource: 'NONE' }, catalog);
    expect(r.recommendations.every((x) => !x.projectSlug.includes('irrigation'))).toBe(true);
    expect(r.excluded.find((e) => e.projectSlug === 'esp32-smart-irrigation')?.reason).toMatch(/fonte de água/);
  });

  it('exclui projetos que precisam de internet quando não há ligação', () => {
    const r = recommend({ ...huambo, internet: 'NONE', problems: ['PESTS'], goals: ['PEST_CONTROL'] }, catalog);
    expect(r.recommendations.find((x) => x.projectSlug === 'pest-detection-vision')).toBeUndefined();
  });

  it('nunca recomenda projetos sem ligação a um problema ou objetivo declarado', () => {
    const r = recommend(huambo, catalog);
    for (const rec of r.recommendations) {
      expect(rec.reasons.some((x) => x.code.startsWith('PROBLEM_') || x.code.startsWith('GOAL_'))).toBe(true);
    }
    expect(r.recommendations.find((x) => x.projectSlug === 'soil-ec-monitoring')).toBeUndefined();
  });

  it('adiciona alimentação solar quando não há eletricidade', () => {
    const top = recommend({ ...huambo, hasElectricity: false }, catalog).recommendations.find(
      (x) => x.projectSlug === 'esp32-smart-irrigation',
    )!;
    expect(top.bom.some((l) => l.name.includes('Painel solar'))).toBe(true);
    expect(top.bom.some((l) => l.name.includes('Fonte de alimentação'))).toBe(false);
  });

  it('não recomenda controlo de bombas a quem não tem bomba', () => {
    const sem = recommend(huambo, catalog);
    expect(sem.recommendations.find((x) => x.projectSlug === 'smart-pump-control')).toBeUndefined();
    expect(sem.excluded.find((e) => e.projectSlug === 'smart-pump-control')?.reason).toMatch(/bomba/);
    const com = recommend({ ...huambo, hasPumps: true }, catalog);
    expect(com.recommendations.find((x) => x.projectSlug === 'smart-pump-control')).toBeDefined();
  });

  it('só dá razões de rega a projetos que controlam a rega', () => {
    const r = recommend(huambo, catalog);
    for (const rec of r.recommendations) {
      const irrigationReason = rec.reasons.some((x) => x.code === 'IRRIGATION_MANUAL' || x.code === 'SOIL_CLAY');
      expect(irrigationReason).toBe(['esp32-smart-irrigation', 'automated-drip-irrigation'].includes(rec.projectSlug));
    }
  });

  it('em empate no teto de 100, o projeto com mais razões fica à frente (não o mais barato)', () => {
    const rich = {
      ...huambo,
      hasPumps: true,
      waterAvailability: 'SEASONAL' as const,
      problems: ['WATER_WASTE', 'IRREGULAR_RAIN'] as FarmProfile['problems'],
      goals: ['REDUCE_WATER', 'AUTOMATE_IRRIGATION', 'MONITOR_CLIMATE'] as FarmProfile['goals'],
      zoneCount: 4,
    };
    const r = recommend(rich, catalog);
    expect(r.recommendations[0].projectSlug).toBe('esp32-smart-irrigation');
  });

  it('é determinístico', () => {
    expect(recommend(huambo, catalog)).toEqual(recommend(huambo, catalog));
  });
});
