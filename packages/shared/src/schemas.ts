import { z } from 'zod';
import {
  ANGOLA_PROVINCES,
  CONNECTIVITY,
  FARMER_TYPES,
  GOALS,
  IRRIGATION_SYSTEMS,
  PROBLEMS,
  SOIL_TYPES,
  TECH_LEVELS,
  TERRAIN_TYPES,
  WATER_AVAILABILITY,
  WATER_SOURCES,
} from './domain';

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{9,15}$/, 'Número de telefone inválido');

// ─────────────── Auth ───────────────

export const registerSchema = z.object({
  fullName: z.string().trim().min(3, 'Indica o nome completo').max(120),
  email: z.email('Email inválido').toLowerCase(),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(128)
    .regex(/[A-Za-z]/, 'Inclui pelo menos uma letra')
    .regex(/[0-9]/, 'Inclui pelo menos um número'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email('Email inválido').toLowerCase(),
  password: z.string().min(1, 'Indica a palavra-passe'),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ─────────────── Onboarding ───────────────

export const onboardingPersonalSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  phone,
  province: z.enum(ANGOLA_PROVINCES),
  municipality: z.string().trim().min(2, 'Indica o município').max(80),
  locality: z.string().trim().max(80).optional().or(z.literal('')),
  farmerType: z.enum(FARMER_TYPES),
});

const geoPolygon = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(4)).min(1),
});
export type GeoPolygon = z.infer<typeof geoPolygon>;

const farmBase = z.object({
  name: z.string().trim().min(2, 'Indica o nome da propriedade').max(120),
  province: z.enum(ANGOLA_PROVINCES),
  municipality: z.string().trim().max(80).optional().or(z.literal('')),
  locality: z.string().trim().max(80).optional().or(z.literal('')),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  boundary: geoPolygon.nullable().optional(),
  totalAreaHa: z.number().positive('A área deve ser maior que zero').max(1_000_000),
  cultivatedAreaHa: z.number().min(0).max(1_000_000),
  terrainType: z.enum(TERRAIN_TYPES),
  soilType: z.enum(SOIL_TYPES),
  waterAvailability: z.enum(WATER_AVAILABILITY),
  waterSource: z.enum(WATER_SOURCES),
  irrigationSystem: z.enum(IRRIGATION_SYSTEMS),
});

export const onboardingFarmSchema = farmBase.refine((f) => f.cultivatedAreaHa <= f.totalAreaHa, {
  message: 'A área cultivada não pode exceder a área total',
  path: ['cultivatedAreaHa'],
});

export const onboardingCropSchema = z.object({
  cropSlug: z.string().min(1),
  areaHa: z.number().positive(),
  season: z.string().max(60).optional().or(z.literal('')),
  harvestFrequency: z.string().max(60).optional().or(z.literal('')),
  /// produtividade aproximada declarada pelo agricultor (kg/ha)
  approxYieldKgHa: z.number().min(0).max(200_000).nullable().optional(),
});

export const onboardingProductionSchema = z.object({
  crops: z.array(onboardingCropSchema).min(1, 'Adiciona pelo menos uma cultura').max(20),
  problems: z.array(z.enum(PROBLEMS)).max(PROBLEMS.length),
});

export const onboardingInfrastructureSchema = z.object({
  hasElectricity: z.boolean(),
  internet: z.enum(CONNECTIVITY),
  hasSensors: z.boolean(),
  hasPumps: z.boolean(),
  hasMachinery: z.boolean(),
  techLevel: z.enum(TECH_LEVELS),
});

export const onboardingGoalsSchema = z.object({
  goals: z.array(z.enum(GOALS)).min(1, 'Escolhe pelo menos um objetivo'),
  otherGoal: z.string().trim().max(200).optional().or(z.literal('')),
  budgetKz: z.number().min(0, 'Orçamento inválido').max(10_000_000_000),
});

export const onboardingSchema = z
  .object({
    personal: onboardingPersonalSchema,
    farm: onboardingFarmSchema,
    production: onboardingProductionSchema,
    infrastructure: onboardingInfrastructureSchema,
    goals: onboardingGoalsSchema,
  })
  .refine(
    (o) => o.production.crops.reduce((s, c) => s + c.areaHa, 0) <= o.farm.cultivatedAreaHa + 0.001,
    { message: 'A soma das áreas das culturas excede a área cultivada', path: ['production', 'crops'] },
  );
export type OnboardingInput = z.infer<typeof onboardingSchema>;

// ─────────────── Propriedades & zonas ───────────────

export const farmCreateSchema = farmBase
  .extend({
    hasElectricity: z.boolean().default(false),
    internet: z.enum(CONNECTIVITY).default('NONE'),
    hasSensors: z.boolean().default(false),
    hasPumps: z.boolean().default(false),
    hasMachinery: z.boolean().default(false),
    techLevel: z.enum(TECH_LEVELS).default('NONE'),
    budgetKz: z.number().min(0).nullable().optional(),
    goals: z.array(z.enum(GOALS)).default([]),
    problems: z.array(z.enum(PROBLEMS)).default([]),
    otherGoal: z.string().max(200).optional().or(z.literal('')),
  })
  .refine((f) => f.cultivatedAreaHa <= f.totalAreaHa, {
    message: 'A área cultivada não pode exceder a área total',
    path: ['cultivatedAreaHa'],
  });
export type FarmCreateInput = z.infer<typeof farmCreateSchema>;

export const farmUpdateSchema = farmBase
  .extend({
    hasElectricity: z.boolean(),
    internet: z.enum(CONNECTIVITY),
    hasSensors: z.boolean(),
    hasPumps: z.boolean(),
    hasMachinery: z.boolean(),
    techLevel: z.enum(TECH_LEVELS),
    budgetKz: z.number().min(0).nullable(),
    goals: z.array(z.enum(GOALS)),
    problems: z.array(z.enum(PROBLEMS)),
    otherGoal: z.string().max(200).optional().or(z.literal('')),
  })
  .partial();
export type FarmUpdateInput = z.infer<typeof farmUpdateSchema>;

export const fieldCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  areaHa: z.number().positive(),
  boundary: geoPolygon.nullable().optional(),
  soilType: z.enum(SOIL_TYPES).nullable().optional(),
  isIrrigationZone: z.boolean().default(false),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  notes: z.string().max(500).optional(),
});
export const fieldUpdateSchema = fieldCreateSchema.partial();
export type FieldCreateInput = z.infer<typeof fieldCreateSchema>;

// ─────────────── Recomendações ───────────────

export const recommendationStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'DISMISSED', 'IMPLEMENTED']),
});

// ─────────────── Produção ───────────────

const isoDate = z.coerce.date();
/** UUID gerado no cliente para idempotência de operações feitas offline. */
const clientId = z.string().uuid().optional();

export const plantingCreateSchema = z.object({
  cropId: z.string().min(1),
  fieldId: z.string().min(1).nullable().optional(),
  areaHa: z.number().positive(),
  seedVariety: z.string().max(80).optional(),
  seedQuantityKg: z.number().min(0).nullable().optional(),
  season: z.string().max(60).optional(),
  harvestFrequency: z.string().max(60).optional(),
  plantedAt: isoDate.nullable().optional(),
  expectedHarvestAt: isoDate.nullable().optional(),
  status: z.enum(['PLANNED', 'GROWING', 'HARVESTED', 'FAILED']).default('PLANNED'),
  estimatedYieldKg: z.number().min(0).nullable().optional(),
  clientId,
});
export const plantingUpdateSchema = plantingCreateSchema.omit({ clientId: true }).partial();
export type PlantingCreateInput = z.infer<typeof plantingCreateSchema>;

export const ACTIVITY_TYPES = ['SOWING', 'FERTILIZER', 'TREATMENT', 'IRRIGATION', 'WEEDING', 'OBSERVATION', 'OTHER'] as const;
export const activityCreateSchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  date: isoDate,
  product: z.string().max(120).optional(),
  quantity: z.number().min(0).nullable().optional(),
  unit: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
  /** se indicado, cria também uma despesa associada */
  costKz: z.number().min(0).nullable().optional(),
  clientId,
});
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;

export const harvestCreateSchema = z.object({
  date: isoDate,
  quantityKg: z.number().positive(),
  quality: z.string().max(60).optional(),
  notes: z.string().max(1000).optional(),
  /** se indicado, regista a receita da venda */
  saleAmountKz: z.number().min(0).nullable().optional(),
  clientId,
});
export type HarvestCreateInput = z.infer<typeof harvestCreateSchema>;

// ─────────────── Finanças ───────────────

export const TRANSACTION_CATEGORIES = [
  'SEEDS', 'FERTILIZER', 'PESTICIDE', 'LABOR', 'IRRIGATION', 'EQUIPMENT', 'IOT', 'FUEL', 'TRANSPORT', 'RENT', 'SALES', 'SUBSIDY', 'OTHER',
] as const;
export const transactionCreateSchema = z.object({
  farmId: z.string().min(1).nullable().optional(),
  plantingId: z.string().min(1).nullable().optional(),
  type: z.enum(['EXPENSE', 'INCOME']),
  category: z.enum(TRANSACTION_CATEGORIES),
  amount: z.number().positive('O valor deve ser maior que zero'),
  currency: z.string().length(3).default('AOA'),
  date: isoDate,
  description: z.string().max(300).optional(),
  clientId,
});
export const transactionUpdateSchema = transactionCreateSchema.omit({ clientId: true }).partial();
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;

// ─────────────── IoT ───────────────

export const SENSOR_KINDS = [
  'SOIL_MOISTURE', 'SOIL_TEMPERATURE', 'SOIL_PH', 'SOIL_EC', 'AIR_TEMPERATURE', 'AIR_HUMIDITY', 'LIGHT', 'RAIN', 'WATER_LEVEL', 'WATER_FLOW', 'ENERGY',
] as const;
export const ACTUATOR_KINDS = ['PUMP', 'VALVE', 'FAN', 'LIGHT', 'OTHER'] as const;
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM');
const key = z.string().regex(/^[a-z][a-z0-9_]{0,15}$/, 'Chave: minúsculas/números, ex.: sm1');

export const sensorCreateSchema = z.object({
  key,
  kind: z.enum(SENSOR_KINDS),
  unit: z.string().min(1).max(12),
  fieldId: z.string().min(1).nullable().optional(),
  minThreshold: z.number().nullable().optional(),
  maxThreshold: z.number().nullable().optional(),
});
export const sensorUpdateSchema = sensorCreateSchema.omit({ key: true }).partial();

export const actuatorCreateSchema = z.object({
  key,
  kind: z.enum(ACTUATOR_KINDS),
  name: z.string().min(1).max(60),
  maxRuntimeSec: z.number().int().min(10).max(3600).default(1800),
});

export const deviceCreateSchema = z.object({
  farmId: z.string().min(1),
  fieldId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(2).max(80),
  type: z.enum(['CONTROLLER', 'SENSOR_NODE', 'GATEWAY', 'WEATHER_STATION']),
  hardware: z.string().max(40).default('ESP32'),
  serial: z.string().max(80).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  localRules: z.boolean().default(true),
  sensors: z.array(sensorCreateSchema).max(16).default([]),
  actuators: z.array(actuatorCreateSchema).max(8).default([]),
});
export const deviceUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  fieldId: z.string().min(1).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  mode: z.enum(['AUTO', 'MANUAL']),
  status: z.enum(['DISABLED', 'OFFLINE']),
  localRules: z.boolean(),
}).partial();
export type DeviceCreateInput = z.infer<typeof deviceCreateSchema>;

export const ruleCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    enabled: z.boolean().default(true),
    sensorId: z.string().min(1),
    operator: z.enum(['LT', 'GT']).default('LT'),
    threshold: z.number(),
    stopThreshold: z.number(),
    actuatorId: z.string().min(1),
    maxDurationSec: z.number().int().min(30).max(3600),
    cooldownSec: z.number().int().min(60).max(86_400).default(1800),
    waterLevelSensorId: z.string().min(1).nullable().optional(),
    minWaterLevel: z.number().nullable().optional(),
    activeFrom: hhmm.nullable().optional(),
    activeTo: hhmm.nullable().optional(),
  })
  .refine((r) => (r.operator === 'LT' ? r.stopThreshold > r.threshold : r.stopThreshold < r.threshold), {
    message: 'A condição de paragem tem de estar do lado oposto do limite de ativação (histerese)',
    path: ['stopThreshold'],
  })
  .refine((r) => !r.waterLevelSensorId || r.minWaterLevel !== null && r.minWaterLevel !== undefined, {
    message: 'Indica o nível mínimo de água',
    path: ['minWaterLevel'],
  });
export type RuleCreateInput = z.infer<typeof ruleCreateSchema>;

export const commandSchema = z.object({
  action: z.enum(['ON', 'OFF']),
  durationSec: z.number().int().min(10).max(3600).optional(),
});
export type CommandInput = z.infer<typeof commandSchema>;

/** Payload de telemetria enviado pelos dispositivos (MQTT ou HTTP). */
export const telemetrySchema = z.object({
  ts: z.number().int().optional(),
  r: z.record(z.string(), z.number()).default({}),
  a: z.record(z.string(), z.boolean()).optional(),
});
export type TelemetryInput = z.infer<typeof telemetrySchema>;
