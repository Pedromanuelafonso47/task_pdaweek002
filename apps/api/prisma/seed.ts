/**
 * Seed do CATÁLOGO (dados de referência, não dados de agricultores):
 *  - culturas comuns em Angola com parâmetros agronómicos gerais
 *  - projetos da AgroTech Lab
 *  - conta de administrador inicial
 * Idempotente: pode correr várias vezes.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG } from '../src/modules/projects/catalog/catalog';

const prisma = new PrismaClient();
const ROOT = join(__dirname, '..', '..', '..');

/** Fases por proporção do ciclo (FAO-56: inicial, desenvolvimento, intermédia, final). */
function stages(cycle: number, kc: [number, number, number], names = ['Emergência / estabelecimento', 'Desenvolvimento vegetativo', 'Floração / formação do produto', 'Maturação']) {
  const cuts = [0, 0.15, 0.45, 0.8, 1].map((p) => Math.round(p * cycle));
  const keys = ['initial', 'development', 'mid', 'late'];
  const kcs = [kc[0], (kc[0] + kc[1]) / 2, kc[1], kc[2]];
  return keys.map((key, i) => ({ key, name: names[i], startDay: cuts[i] + (i ? 1 : 0), endDay: cuts[i + 1], kc: Math.round(kcs[i] * 100) / 100 }));
}

// Humidade do solo em % da escala do sensor capacitivo calibrado (seco=0, saturado=100).
// Valores de referência geral — ajustar por solo e calibração local.
const CROPS = [
  { slug: 'milho', name: 'Milho', scientificName: 'Zea mays', category: 'Cereal', cycleDays: 120, waterNeed: 'MEDIUM', soilMoistureMin: 35, soilMoistureMax: 60, tempMin: 18, tempMax: 32, kc: [0.3, 1.2, 0.6] },
  { slug: 'feijao', name: 'Feijão', scientificName: 'Phaseolus vulgaris', category: 'Leguminosa', cycleDays: 90, waterNeed: 'MEDIUM', soilMoistureMin: 40, soilMoistureMax: 60, tempMin: 15, tempMax: 29, kc: [0.4, 1.15, 0.35] },
  { slug: 'mandioca', name: 'Mandioca', scientificName: 'Manihot esculenta', category: 'Tubérculo', cycleDays: 300, waterNeed: 'LOW', soilMoistureMin: 25, soilMoistureMax: 55, tempMin: 20, tempMax: 35, kc: [0.3, 0.8, 0.3] },
  { slug: 'batata-doce', name: 'Batata-doce', scientificName: 'Ipomoea batatas', category: 'Tubérculo', cycleDays: 130, waterNeed: 'MEDIUM', soilMoistureMin: 35, soilMoistureMax: 60, tempMin: 18, tempMax: 32, kc: [0.5, 1.15, 0.65] },
  { slug: 'batata-rena', name: 'Batata-rena', scientificName: 'Solanum tuberosum', category: 'Tubérculo', cycleDays: 110, waterNeed: 'HIGH', soilMoistureMin: 50, soilMoistureMax: 75, tempMin: 12, tempMax: 25, kc: [0.5, 1.15, 0.75] },
  { slug: 'tomate', name: 'Tomate', scientificName: 'Solanum lycopersicum', category: 'Hortícola', cycleDays: 120, waterNeed: 'HIGH', soilMoistureMin: 50, soilMoistureMax: 75, tempMin: 15, tempMax: 30, kc: [0.6, 1.15, 0.8] },
  { slug: 'cebola', name: 'Cebola', scientificName: 'Allium cepa', category: 'Hortícola', cycleDays: 130, waterNeed: 'HIGH', soilMoistureMin: 50, soilMoistureMax: 75, tempMin: 12, tempMax: 28, kc: [0.7, 1.05, 0.75] },
  { slug: 'couve', name: 'Couve', scientificName: 'Brassica oleracea', category: 'Hortícola', cycleDays: 90, waterNeed: 'HIGH', soilMoistureMin: 50, soilMoistureMax: 75, tempMin: 10, tempMax: 26, kc: [0.7, 1.05, 0.95] },
  { slug: 'repolho', name: 'Repolho', scientificName: 'Brassica oleracea var. capitata', category: 'Hortícola', cycleDays: 100, waterNeed: 'HIGH', soilMoistureMin: 50, soilMoistureMax: 75, tempMin: 10, tempMax: 26, kc: [0.7, 1.05, 0.95] },
  { slug: 'pimento', name: 'Pimento', scientificName: 'Capsicum annuum', category: 'Hortícola', cycleDays: 120, waterNeed: 'HIGH', soilMoistureMin: 50, soilMoistureMax: 70, tempMin: 18, tempMax: 30, kc: [0.6, 1.05, 0.9] },
  { slug: 'cenoura', name: 'Cenoura', scientificName: 'Daucus carota', category: 'Hortícola', cycleDays: 100, waterNeed: 'MEDIUM', soilMoistureMin: 45, soilMoistureMax: 70, tempMin: 10, tempMax: 25, kc: [0.7, 1.05, 0.95] },
  { slug: 'alho', name: 'Alho', scientificName: 'Allium sativum', category: 'Hortícola', cycleDays: 150, waterNeed: 'MEDIUM', soilMoistureMin: 40, soilMoistureMax: 65, tempMin: 10, tempMax: 26, kc: [0.7, 1.0, 0.7] },
  { slug: 'amendoim', name: 'Amendoim', scientificName: 'Arachis hypogaea', category: 'Leguminosa', cycleDays: 130, waterNeed: 'MEDIUM', soilMoistureMin: 35, soilMoistureMax: 60, tempMin: 20, tempMax: 33, kc: [0.4, 1.15, 0.6] },
  { slug: 'soja', name: 'Soja', scientificName: 'Glycine max', category: 'Leguminosa', cycleDays: 120, waterNeed: 'MEDIUM', soilMoistureMin: 40, soilMoistureMax: 65, tempMin: 18, tempMax: 32, kc: [0.4, 1.15, 0.5] },
  { slug: 'arroz', name: 'Arroz', scientificName: 'Oryza sativa', category: 'Cereal', cycleDays: 140, waterNeed: 'HIGH', soilMoistureMin: 70, soilMoistureMax: 100, tempMin: 20, tempMax: 35, kc: [1.05, 1.2, 0.9] },
  { slug: 'massambala', name: 'Massambala (sorgo)', scientificName: 'Sorghum bicolor', category: 'Cereal', cycleDays: 120, waterNeed: 'LOW', soilMoistureMin: 25, soilMoistureMax: 50, tempMin: 20, tempMax: 37, kc: [0.3, 1.0, 0.55] },
  { slug: 'massango', name: 'Massango (milheto)', scientificName: 'Pennisetum glaucum', category: 'Cereal', cycleDays: 100, waterNeed: 'LOW', soilMoistureMin: 20, soilMoistureMax: 45, tempMin: 22, tempMax: 38, kc: [0.3, 1.0, 0.3] },
  { slug: 'banana', name: 'Banana', scientificName: 'Musa spp.', category: 'Fruteira', cycleDays: 365, waterNeed: 'HIGH', soilMoistureMin: 55, soilMoistureMax: 80, tempMin: 18, tempMax: 34, kc: [0.5, 1.1, 1.0] },
  { slug: 'cafe', name: 'Café', scientificName: 'Coffea spp.', category: 'Fruteira', cycleDays: 365, waterNeed: 'MEDIUM', soilMoistureMin: 45, soilMoistureMax: 70, tempMin: 16, tempMax: 28, kc: [0.9, 0.95, 0.95] },
  { slug: 'girassol', name: 'Girassol', scientificName: 'Helianthus annuus', category: 'Oleaginosa', cycleDays: 110, waterNeed: 'LOW', soilMoistureMin: 30, soilMoistureMax: 55, tempMin: 18, tempMax: 32, kc: [0.35, 1.0, 0.35] },
] as const;

async function main() {
  for (const { kc, ...c } of CROPS) {
    const data = { ...c, stages: stages(c.cycleDays, kc as unknown as [number, number, number]), notes: 'Parâmetros de referência geral (FAO-56 / literatura agronómica). Ajustar à variedade, solo e calibração local dos sensores.' };
    await prisma.crop.upsert({ where: { slug: c.slug }, create: data, update: data });
  }
  console.log(`✔ ${CROPS.length} culturas`);

  for (const p of CATALOG) {
    const { components, firmwareFile, ...rest } = p;
    const fwPath = firmwareFile ? join(ROOT, firmwareFile) : null;
    const firmware = fwPath && existsSync(fwPath) ? readFileSync(fwPath, 'utf8') : null;
    const data = { ...rest, firmware, architecture: rest.architecture as object, wiring: rest.wiring as object };
    const project = await prisma.project.upsert({ where: { slug: p.slug }, create: data, update: data });
    await prisma.projectComponent.deleteMany({ where: { projectId: project.id } });
    await prisma.projectComponent.createMany({
      data: components.map((c, i) => ({
        projectId: project.id,
        name: c.name,
        spec: c.spec ?? null,
        quantity: c.quantity,
        quantityRule: c.quantityRule ?? 'FIXED',
        maxQuantity: c.maxQuantity ?? null,
        unitPriceKz: c.unitPriceKz,
        optional: c.optional ?? false,
        condition: c.condition ?? null,
        sortOrder: i,
      })),
    });
  }
  console.log(`✔ ${CATALOG.length} projetos AgroTech Lab`);

  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@agrogenius.ao').toLowerCase();
  if (!(await prisma.user.findUnique({ where: { email: adminEmail } }))) {
    const password = process.env.ADMIN_PASSWORD ?? randomBytes(9).toString('base64url');
    await prisma.user.create({
      data: {
        email: adminEmail,
        fullName: 'Administrador AGROGENIUS',
        role: 'ADMIN',
        onboardingCompleted: true,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        organization: { create: { name: 'AGROGENIUS', type: 'COMPANY' } },
      },
    });
    console.log(`✔ Administrador criado: ${adminEmail} / ${process.env.ADMIN_PASSWORD ? '(ADMIN_PASSWORD)' : password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
