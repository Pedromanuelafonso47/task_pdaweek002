/** Tipos das respostas da API (subconjuntos usados na interface). */

export type GeoPolygon = { type: 'Polygon'; coordinates: [number, number][][] };

export interface FarmSummary {
  id: string;
  name: string;
  province: string;
  municipality: string | null;
  locality: string | null;
  latitude: number | null;
  longitude: number | null;
  boundary: GeoPolygon | null;
  totalAreaHa: string;
  cultivatedAreaHa: string;
  soilType: string;
  terrainType: string;
  waterAvailability: string;
  waterSource: string;
  irrigationSystem: string;
  hasElectricity: boolean;
  internet: string;
  hasSensors: boolean;
  hasPumps: boolean;
  hasMachinery: boolean;
  techLevel: string;
  budgetKz: string | null;
  goals: string[];
  problems: string[];
  otherGoal: string | null;
  isDemo: boolean;
  createdAt: string;
  _count?: { fields: number; devices: number; plantings: number };
  plantings?: { id: string; crop: { name: string } }[];
}

export interface Field {
  id: string;
  farmId: string;
  name: string;
  areaHa: string;
  boundary: GeoPolygon | null;
  soilType: string | null;
  isIrrigationZone: boolean;
  color: string | null;
  notes: string | null;
}

export interface Crop {
  id: string;
  slug: string;
  name: string;
  scientificName: string | null;
  category: string;
  cycleDays: number;
  waterNeed: 'LOW' | 'MEDIUM' | 'HIGH';
  soilMoistureMin: number;
  soilMoistureMax: number;
  tempMin: number;
  tempMax: number;
  stages: { key: string; name: string; startDay: number; endDay: number; kc: number }[];
  notes: string | null;
}

export interface Sensor {
  id: string;
  deviceId: string;
  fieldId: string | null;
  key: string;
  kind: string;
  unit: string;
  minThreshold: number | null;
  maxThreshold: number | null;
  last?: { value: number; recordedAt: string } | null;
}

export interface Actuator {
  id: string;
  deviceId: string;
  key: string;
  kind: 'PUMP' | 'VALVE' | 'FAN' | 'LIGHT' | 'OTHER';
  name: string;
  isOn: boolean;
  maxRuntimeSec: number;
  lastChangedAt: string | null;
}

export interface Device {
  id: string;
  farmId: string;
  fieldId: string | null;
  name: string;
  type: string;
  hardware: string;
  mqttUsername: string;
  status: 'PENDING' | 'ONLINE' | 'OFFLINE' | 'DISABLED';
  mode: 'AUTO' | 'MANUAL';
  localRules: boolean;
  lastSeenAt: string | null;
  latitude: number | null;
  longitude: number | null;
  farm?: { id: string; name: string };
  field?: { id: string; name: string } | null;
  sensors: Sensor[];
  actuators: Actuator[];
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
  note?: string;
}
export type Roi =
  | { kind: 'ESTIMATE'; annualSavingsKz: number; paybackMonths: number; assumptions: string[] }
  | { kind: 'INSUFFICIENT_DATA'; missing: string[] };

export interface Recommendation {
  id: string;
  farmId: string;
  projectId: string;
  source: 'ENGINE' | 'TECHNICIAN';
  engineVersion: string | null;
  score: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  problem: string;
  reasons: Reason[];
  bom: BomLine[];
  estimatedCostKz: string;
  withinBudget: boolean;
  roi: Roi | null;
  phases: { name: string; description: string; costKz: number }[] | null;
  warnings: string[];
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED' | 'IMPLEMENTED';
  validatedBy?: { id: string; fullName: string } | null;
  validatedAt: string | null;
  project: { id: string; slug: string; title: string; tagline: string; category: string; difficulty: string; implementationDays: number };
}

export interface ProjectListItem {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  category: string;
  difficulty: string;
  implementationDays: number;
  solves: string[];
  supportsGoals: string[];
  requiresElectricity: boolean;
  worksOffline: boolean;
  description: string;
  hasFirmware: boolean;
  componentCount: number;
  baseCostKz: number;
  isFavorite: boolean;
}

export interface ArchNode {
  id: string;
  label: string;
  kind: 'sensor' | 'controller' | 'actuator' | 'cloud' | 'power' | 'water' | 'user';
}

export interface ProjectDetail extends Omit<ProjectListItem, 'hasFirmware' | 'componentCount'> {
  howItWorks: string[];
  architecture: { nodes: ArchNode[]; edges: { from: string; to: string; label?: string }[] };
  wiring: { from: string; to: string; note?: string }[];
  firmware: string | null;
  assemblySteps: string[];
  maintenance: string[];
  benefits: string[];
  limitations: string[];
  useCases: string[];
  components: {
    id: string;
    name: string;
    spec: string | null;
    quantity: number;
    quantityRule: 'FIXED' | 'PER_HECTARE' | 'PER_ZONE';
    maxQuantity: number | null;
    unitPriceKz: string;
    priceSource: string;
    optional: boolean;
    condition: string | null;
  }[];
}

export interface Notification {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string;
  farmId: string | null;
  readAt: string | null;
  createdAt: string;
}
