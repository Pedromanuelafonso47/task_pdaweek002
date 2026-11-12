import type {
  Connectivity,
  Goal,
  IrrigationSystem,
  Problem,
  SoilType,
  TechLevel,
  TerrainType,
  WaterAvailability,
  WaterSource,
} from '@agrogenius/shared';

export const ENGINE_VERSION = 'rules-1.0.0';

export interface FarmCropInput {
  slug: string;
  name: string;
  waterNeed: 'LOW' | 'MEDIUM' | 'HIGH';
  areaHa: number;
}

/** Perfil agrícola estruturado — tudo o que o motor sabe sobre a propriedade. */
export interface FarmProfile {
  province: string;
  totalAreaHa: number;
  cultivatedAreaHa: number;
  terrainType: TerrainType;
  soilType: SoilType;
  waterAvailability: WaterAvailability;
  waterSource: WaterSource;
  irrigationSystem: IrrigationSystem;
  hasElectricity: boolean;
  internet: Connectivity;
  hasSensors: boolean;
  hasPumps: boolean;
  hasMachinery: boolean;
  techLevel: TechLevel;
  budgetKz: number | null;
  goals: Goal[];
  problems: Problem[];
  crops: FarmCropInput[];
  /** número de zonas registadas (0 = ainda não dividida) */
  zoneCount: number;
  /** gastos reais dos últimos 12 meses, a partir das transações; null = sem registos */
  annualIrrigationCostKz: number | null;
  annualLaborCostKz: number | null;
}

export type ComponentCondition =
  | 'NO_PUMP'
  | 'NO_ELECTRICITY'
  | 'HAS_ELECTRICITY'
  | 'NO_INTERNET'
  | 'HAS_INTERNET';

export interface CatalogComponent {
  name: string;
  spec?: string | null;
  quantity: number;
  quantityRule: 'FIXED' | 'PER_HECTARE' | 'PER_ZONE';
  maxQuantity?: number | null;
  unitPriceKz: number;
  optional: boolean;
  condition?: ComponentCondition | string | null;
}

export interface CatalogProject {
  id: string;
  slug: string;
  title: string;
  category:
    | 'SMART_IRRIGATION'
    | 'SOIL_MONITORING'
    | 'ENVIRONMENTAL_MONITORING'
    | 'SMART_FARMING'
    | 'RESOURCE_MANAGEMENT';
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  solves: string[];
  supportsGoals: string[];
  requiresElectricity: boolean;
  worksOffline: boolean;
  requires?: string[];
  controlsIrrigation?: boolean;
  components: CatalogComponent[];
}

export interface Reason {
  code: string;
  text: string;
  weight: number;
}

export interface BomLine {
  name: string;
  spec?: string | null;
  quantity: number;
  unitPriceKz: number;
  totalKz: number;
  optional: boolean;
  /** porque foi incluído/quantidade calculada */
  note?: string;
}

export interface Phase {
  name: string;
  description: string;
  costKz: number;
}

export type RoiEstimate =
  | {
      kind: 'ESTIMATE';
      annualSavingsKz: number;
      paybackMonths: number;
      assumptions: string[];
    }
  | { kind: 'INSUFFICIENT_DATA'; missing: string[] };

export interface EngineRecommendation {
  projectId: string;
  projectSlug: string;
  score: number;
  /** pontuação antes do limite de 100 — usada para desempatar */
  rawScore: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  problem: string;
  reasons: Reason[];
  bom: BomLine[];
  estimatedCostKz: number;
  withinBudget: boolean;
  phases: Phase[];
  roi: RoiEstimate;
  warnings: string[];
}

export interface EngineResult {
  version: string;
  recommendations: EngineRecommendation[];
  /** projetos avaliados mas excluídos, com o motivo — transparência */
  excluded: { projectSlug: string; reason: string }[];
  /** dados que, se fornecidos, melhorariam a análise */
  missingData: string[];
}
