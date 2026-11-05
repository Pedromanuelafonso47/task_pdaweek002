/** Rótulos em português para os códigos de domínio. */

export const LABELS = {
  role: { FARMER: 'Agricultor', TECHNICIAN: 'Técnico agrícola', ADMIN: 'Administrador' },
  farmerType: {
    FAMILY: 'Agricultor familiar',
    COMMERCIAL: 'Agricultor comercial',
    COOPERATIVE: 'Cooperativa',
    ENTERPRISE: 'Empresa agrícola',
  },
  terrain: {
    FLAT: 'Plano',
    GENTLE_SLOPE: 'Declive suave',
    STEEP_SLOPE: 'Declive acentuado',
    VALLEY: 'Vale / baixa',
    MIXED: 'Misto',
  },
  soil: {
    CLAY: 'Argiloso',
    SANDY: 'Arenoso',
    LOAM: 'Franco',
    SILT: 'Siltoso',
    CLAY_LOAM: 'Franco-argiloso',
    SANDY_LOAM: 'Franco-arenoso',
    LATERITIC: 'Laterítico',
    UNKNOWN: 'Não sei',
  },
  waterAvailability: {
    SCARCE: 'Escassa',
    SEASONAL: 'Sazonal',
    MODERATE: 'Moderada',
    ABUNDANT: 'Abundante',
  },
  waterSource: {
    WELL: 'Poço',
    BOREHOLE: 'Furo (captação profunda)',
    RIVER: 'Rio',
    LAKE: 'Lagoa',
    RAINWATER: 'Água da chuva',
    MUNICIPAL: 'Rede pública',
    DAM: 'Barragem / represa',
    NONE: 'Sem fonte própria',
  },
  irrigation: {
    NONE: 'Sem irrigação',
    MANUAL: 'Manual (regador / balde)',
    FURROW: 'Por sulcos',
    SPRINKLER: 'Aspersão',
    DRIP: 'Gota-a-gota',
    PIVOT: 'Pivô central',
  },
  connectivity: { NONE: 'Sem internet', LIMITED: 'Limitada', GOOD: 'Boa' },
  techLevel: { NONE: 'Nenhuma', BASIC: 'Básica', INTERMEDIATE: 'Intermédia', ADVANCED: 'Avançada' },
  goal: {
    REDUCE_WATER: 'Reduzir o consumo de água',
    INCREASE_YIELD: 'Aumentar a produtividade',
    MONITOR_SOIL: 'Monitorizar o solo',
    AUTOMATE_IRRIGATION: 'Automatizar a irrigação',
    REDUCE_COSTS: 'Reduzir custos',
    MONITOR_CLIMATE: 'Monitorizar o clima',
    PEST_CONTROL: 'Controlar pragas',
  },
  problem: {
    WATER_WASTE: 'Desperdício de água',
    DROUGHT: 'Seca / falta de água',
    IRREGULAR_RAIN: 'Chuvas irregulares',
    PESTS: 'Pragas',
    DISEASES: 'Doenças nas culturas',
    LOW_YIELD: 'Baixa produtividade',
    SOIL_DEGRADATION: 'Solo degradado / pouco fértil',
    HIGH_LABOR_COST: 'Custo elevado de mão de obra',
    HEAT_STRESS: 'Calor excessivo',
    FLOODING: 'Encharcamento / inundações',
    NO_DATA: 'Não tenho dados sobre a produção',
  },
  projectCategory: {
    SMART_IRRIGATION: 'Irrigação inteligente',
    SOIL_MONITORING: 'Monitorização do solo',
    ENVIRONMENTAL_MONITORING: 'Monitorização ambiental',
    SMART_FARMING: 'Agricultura inteligente',
    RESOURCE_MANAGEMENT: 'Gestão de recursos',
  },
  difficulty: { BEGINNER: 'Iniciante', INTERMEDIATE: 'Intermédio', ADVANCED: 'Avançado' },
  priority: { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', CRITICAL: 'Crítica' },
  activity: {
    SOWING: "Sementeira", FERTILIZER: "Adubação", TREATMENT: "Tratamento fitossanitário", IRRIGATION: "Rega",
    WEEDING: "Sacha / monda", OBSERVATION: "Observação", OTHER: "Outra",
  },
  plantingStatus: { PLANNED: "Planeada", GROWING: "Em crescimento", HARVESTED: "Colhida", FAILED: "Perdida" },
  transactionCategory: {
    SEEDS: "Sementes", FERTILIZER: "Fertilizantes", PESTICIDE: "Fitofármacos", LABOR: "Mão de obra", IRRIGATION: "Rega (água/energia)",
    EQUIPMENT: "Equipamentos", IOT: "Investimento IoT", FUEL: "Combustível", TRANSPORT: "Transporte", RENT: "Renda",
    SALES: "Vendas", SUBSIDY: "Subsídios / apoios", OTHER: "Outros",
  },
  sensorKind: {
    SOIL_MOISTURE: "Humidade do solo", SOIL_TEMPERATURE: "Temperatura do solo", SOIL_PH: "pH do solo", SOIL_EC: "Condutividade elétrica",
    AIR_TEMPERATURE: "Temperatura do ar", AIR_HUMIDITY: "Humidade do ar", LIGHT: "Luminosidade", RAIN: "Chuva",
    WATER_LEVEL: "Nível de água", WATER_FLOW: "Caudal", ENERGY: "Energia",
  },
  actuatorKind: { PUMP: "Bomba", VALVE: "Válvula", FAN: "Ventilador", LIGHT: "Iluminação", OTHER: "Outro" },
  deviceType: { CONTROLLER: "Controlador", SENSOR_NODE: "Nó de sensores", GATEWAY: "Gateway", WEATHER_STATION: "Estação meteorológica" },
  deviceStatus: { PENDING: "A aguardar ligação", ONLINE: "Online", OFFLINE: "Offline", DISABLED: "Desativado" },
  commandStatus: { PENDING: "Pendente", SENT: "Enviado", ACKED: "Confirmado", REJECTED: "Rejeitado", FAILED: "Falhou", EXPIRED: "Expirado" },
  recommendationStatus: {
    PENDING: 'Pendente',
    ACCEPTED: 'Aceite',
    DISMISSED: 'Descartada',
    IMPLEMENTED: 'Implementada',
  },
} as const;

/** Formata valores em Kwanza: 300000 → "300 000 Kz". */
export function formatKz(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 0 }).format(n)} Kz`;
}
