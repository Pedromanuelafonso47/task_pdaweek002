import type { PhotoKey } from './photos';

export type IllustrationKind = 'irrigation' | 'drip' | 'reservoir' | 'pump' | 'soil' | 'weather' | 'greenhouse' | 'camera' | 'energy';

/**
 * Imagem real e ilustração "a funcionar" de cada projeto da AgroTech Lab.
 * As fotografias mostram sistemas semelhantes no terreno — a interface indica sempre que são ilustrativas.
 */
export const PROJECT_MEDIA: Record<string, { photo: PhotoKey; illustration: IllustrationKind }> = {
  'esp32-smart-irrigation': { photo: 'rede-sensores-campo', illustration: 'irrigation' },
  'automated-drip-irrigation': { photo: 'kit-gota-a-gota', illustration: 'drip' },
  'reservoir-level-monitoring': { photo: 'bomba-manual-agua', illustration: 'reservoir' },
  'smart-pump-control': { photo: 'bomba-solar-comunidade', illustration: 'pump' },
  'soil-moisture-network': { photo: 'sensor-humidade-solo', illustration: 'soil' },
  'soil-ph-monitoring': { photo: 'angola-bie-feijao', illustration: 'soil' },
  'soil-temperature-monitoring': { photo: 'instalacao-sensores-solo', illustration: 'soil' },
  'soil-ec-monitoring': { photo: 'linhas-gota-a-gota', illustration: 'soil' },
  'agricultural-weather-station': { photo: 'estacao-meteorologica', illustration: 'weather' },
  'rain-gauge-alerts': { photo: 'angola-malanje-rio-lucala', illustration: 'weather' },
  'microclimate-node': { photo: 'estacao-meteo-compacta', illustration: 'weather' },
  'greenhouse-monitoring': { photo: 'estufa-pimentos', illustration: 'greenhouse' },
  'crop-monitoring-camera': { photo: 'milho-plantacao', illustration: 'camera' },
  'pest-detection-vision': { photo: 'tomates-campo', illustration: 'camera' },
  'ventilation-control': { photo: 'colheita-milho', illustration: 'greenhouse' },
  'water-consumption-monitoring': { photo: 'gota-a-gota-couve', illustration: 'drip' },
  'energy-monitoring': { photo: 'painel-solar-rega', illustration: 'energy' },
  'smart-reservoir-management': { photo: 'rega-manual-balde', illustration: 'reservoir' },
};

export const CATEGORY_PHOTO: Record<string, PhotoKey> = {
  SMART_IRRIGATION: 'kit-gota-a-gota',
  SOIL_MONITORING: 'instalacao-sensores-solo',
  ENVIRONMENTAL_MONITORING: 'estacao-meteorologica',
  SMART_FARMING: 'estufa-pimentos',
  RESOURCE_MANAGEMENT: 'bomba-solar-comunidade',
};

export function mediaFor(slug: string) {
  return PROJECT_MEDIA[slug] ?? { photo: 'horta-comunitaria' as PhotoKey, illustration: 'irrigation' as IllustrationKind };
}
