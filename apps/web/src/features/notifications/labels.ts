export const NOTIFICATION_TYPES: Record<string, string> = {
  LOW_MOISTURE: 'Humidade baixa',
  HIGH_TEMP: 'Temperatura elevada',
  SENSOR_OFFLINE: 'Sensor desconectado',
  IRRIGATION_FAILURE: 'Falha na irrigação',
  LOW_RESERVOIR: 'Reservatório baixo',
  HARVEST_SOON: 'Próxima colheita',
  MAINTENANCE: 'Manutenção',
  NEW_RECOMMENDATION: 'Recomendações',
  THRESHOLD: 'Limite de sensor',
};

export const SEVERITY_LABELS = { INFO: 'Informação', WARNING: 'Aviso', CRITICAL: 'Crítico' } as const;
