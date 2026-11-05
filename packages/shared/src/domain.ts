/**
 * Códigos de domínio partilhados entre API e Web.
 * Os valores coincidem com os enums do Prisma (apps/api/prisma/schema.prisma).
 */

export const ROLES = ['FARMER', 'TECHNICIAN', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const FARMER_TYPES = ['FAMILY', 'COMMERCIAL', 'COOPERATIVE', 'ENTERPRISE'] as const;
export const TERRAIN_TYPES = ['FLAT', 'GENTLE_SLOPE', 'STEEP_SLOPE', 'VALLEY', 'MIXED'] as const;
export const SOIL_TYPES = ['CLAY', 'SANDY', 'LOAM', 'SILT', 'CLAY_LOAM', 'SANDY_LOAM', 'LATERITIC', 'UNKNOWN'] as const;
export const WATER_AVAILABILITY = ['SCARCE', 'SEASONAL', 'MODERATE', 'ABUNDANT'] as const;
export const WATER_SOURCES = ['WELL', 'BOREHOLE', 'RIVER', 'LAKE', 'RAINWATER', 'MUNICIPAL', 'DAM', 'NONE'] as const;
export const IRRIGATION_SYSTEMS = ['NONE', 'MANUAL', 'FURROW', 'SPRINKLER', 'DRIP', 'PIVOT'] as const;
export const CONNECTIVITY = ['NONE', 'LIMITED', 'GOOD'] as const;
export const TECH_LEVELS = ['NONE', 'BASIC', 'INTERMEDIATE', 'ADVANCED'] as const;

export const GOALS = [
  'REDUCE_WATER',
  'INCREASE_YIELD',
  'MONITOR_SOIL',
  'AUTOMATE_IRRIGATION',
  'REDUCE_COSTS',
  'MONITOR_CLIMATE',
  'PEST_CONTROL',
] as const;

export const PROBLEMS = [
  'WATER_WASTE',
  'DROUGHT',
  'IRREGULAR_RAIN',
  'PESTS',
  'DISEASES',
  'LOW_YIELD',
  'SOIL_DEGRADATION',
  'HIGH_LABOR_COST',
  'HEAT_STRESS',
  'FLOODING',
  'NO_DATA',
] as const;

export type FarmerType = (typeof FARMER_TYPES)[number];
export type TerrainType = (typeof TERRAIN_TYPES)[number];
export type SoilType = (typeof SOIL_TYPES)[number];
export type WaterAvailability = (typeof WATER_AVAILABILITY)[number];
export type WaterSource = (typeof WATER_SOURCES)[number];
export type IrrigationSystem = (typeof IRRIGATION_SYSTEMS)[number];
export type Connectivity = (typeof CONNECTIVITY)[number];
export type TechLevel = (typeof TECH_LEVELS)[number];
export type Goal = (typeof GOALS)[number];
export type Problem = (typeof PROBLEMS)[number];

/** As 21 províncias de Angola (divisão político-administrativa de 2024). */
export const ANGOLA_PROVINCES = [
  'Bengo',
  'Benguela',
  'Bié',
  'Cabinda',
  'Cuando',
  'Cubango',
  'Cuanza Norte',
  'Cuanza Sul',
  'Cunene',
  'Huambo',
  'Huíla',
  'Icolo e Bengo',
  'Luanda',
  'Lunda Norte',
  'Lunda Sul',
  'Malanje',
  'Moxico',
  'Moxico Leste',
  'Namibe',
  'Uíge',
  'Zaire',
] as const;
export type AngolaProvince = (typeof ANGOLA_PROVINCES)[number];

/**
 * Zona agroclimática APROXIMADA por província — usada apenas como sinal fraco no motor
 * de recomendações (nunca como diagnóstico). Fonte: classificação geral do clima de Angola.
 */
export type ClimateZone = 'ARID' | 'SEMI_ARID' | 'HIGHLAND' | 'HUMID_TROPICAL' | 'SUBHUMID';
export const PROVINCE_CLIMATE: Record<AngolaProvince, ClimateZone> = {
  Namibe: 'ARID',
  Cunene: 'SEMI_ARID',
  Benguela: 'SEMI_ARID',
  Luanda: 'SEMI_ARID',
  'Icolo e Bengo': 'SEMI_ARID',
  Huambo: 'HIGHLAND',
  Bié: 'HIGHLAND',
  Huíla: 'HIGHLAND',
  'Cuanza Sul': 'SUBHUMID',
  Bengo: 'SUBHUMID',
  Malanje: 'SUBHUMID',
  'Cuanza Norte': 'HUMID_TROPICAL',
  Uíge: 'HUMID_TROPICAL',
  Zaire: 'SUBHUMID',
  Cabinda: 'HUMID_TROPICAL',
  'Lunda Norte': 'HUMID_TROPICAL',
  'Lunda Sul': 'SUBHUMID',
  Moxico: 'SUBHUMID',
  'Moxico Leste': 'SUBHUMID',
  Cuando: 'SEMI_ARID',
  Cubango: 'SEMI_ARID',
};

/** Coordenadas aproximadas da capital provincial — centro inicial do mapa. */
export const PROVINCE_CENTER: Record<AngolaProvince, [number, number]> = {
  Bengo: [-8.58, 13.66],
  Benguela: [-12.58, 13.41],
  Bié: [-12.38, 16.93],
  Cabinda: [-5.55, 12.2],
  Cuando: [-15.16, 19.17],
  Cubango: [-14.66, 17.69],
  'Cuanza Norte': [-9.3, 14.91],
  'Cuanza Sul': [-11.21, 13.84],
  Cunene: [-17.07, 15.73],
  Huambo: [-12.78, 15.74],
  Huíla: [-14.92, 13.49],
  'Icolo e Bengo': [-8.98, 13.75],
  Luanda: [-8.84, 13.23],
  'Lunda Norte': [-7.37, 20.83],
  'Lunda Sul': [-9.66, 20.39],
  Malanje: [-9.54, 16.34],
  Moxico: [-11.78, 19.92],
  'Moxico Leste': [-11.9, 22.6],
  Namibe: [-15.19, 12.15],
  Uíge: [-7.61, 15.06],
  Zaire: [-6.27, 14.24],
};
