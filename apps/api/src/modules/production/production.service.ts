import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ActivityCreateInput, HarvestCreateInput, PlantingCreateInput } from '@agrogenius/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { FarmAccessService } from '../access/farm-access.service';

const DAY = 86_400_000;

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FarmAccessService,
  ) {}

  crops() {
    return this.prisma.crop.findMany({ orderBy: { name: 'asc' } });
  }

  async plantings(user: AuthUser, farmId: string) {
    await this.access.assert(user, farmId);
    return this.prisma.planting.findMany({
      where: { farmId },
      orderBy: [{ status: 'asc' }, { plantedAt: 'desc' }],
      include: {
        crop: true,
        field: { select: { id: true, name: true } },
        harvests: { orderBy: { date: 'desc' } },
        activities: { orderBy: { date: 'desc' }, take: 50 },
      },
    });
  }

  private async assertPlanting(user: AuthUser, plantingId: string, mode: 'read' | 'write') {
    const p = await this.prisma.planting.findUnique({ where: { id: plantingId }, select: { id: true, farmId: true, areaHa: true } });
    if (!p) throw new NotFoundException('Plantação não encontrada');
    await this.access.assert(user, p.farmId, mode);
    return p;
  }

  private async checkArea(farmId: string, areaHa: number, fieldId: string | null | undefined, excludeId?: string) {
    const farm = await this.prisma.farm.findUniqueOrThrow({ where: { id: farmId }, select: { cultivatedAreaHa: true, totalAreaHa: true } });
    if (areaHa > Number(farm.totalAreaHa)) throw new BadRequestException('A área da plantação excede a área total da propriedade');
    if (fieldId) {
      const field = await this.prisma.field.findFirst({ where: { id: fieldId, farmId } });
      if (!field) throw new BadRequestException('Zona inválida para esta propriedade');
      if (areaHa > Number(field.areaHa)) throw new BadRequestException(`A área excede a área da zona "${field.name}"`);
    }
    void excludeId;
  }

  async createPlanting(user: AuthUser, farmId: string, input: PlantingCreateInput) {
    await this.access.assert(user, farmId, 'write');
    if (input.clientId) {
      const existing = await this.prisma.planting.findUnique({ where: { clientId: input.clientId } });
      if (existing) return existing;
    }
    await this.checkArea(farmId, input.areaHa, input.fieldId);
    const crop = await this.prisma.crop.findUnique({ where: { id: input.cropId } });
    if (!crop) throw new BadRequestException('Cultura inválida');
    // Previsão de colheita a partir do ciclo da cultura, quando não indicada.
    const expectedHarvestAt =
      input.expectedHarvestAt ?? (input.plantedAt ? new Date(input.plantedAt.getTime() + crop.cycleDays * DAY) : null);
    const planting = await this.prisma.planting.create({
      data: { ...input, farmId, expectedHarvestAt },
    });
    await this.prisma.farmEvent.create({
      data: { farmId, type: 'PLANTING', summary: `Plantação de ${crop.name} registada (${input.areaHa} ha)` },
    });
    return planting;
  }

  async updatePlanting(user: AuthUser, plantingId: string, input: Partial<PlantingCreateInput>) {
    const p = await this.assertPlanting(user, plantingId, 'write');
    if (input.areaHa !== undefined || input.fieldId !== undefined) {
      await this.checkArea(p.farmId, input.areaHa ?? Number(p.areaHa), input.fieldId, plantingId);
    }
    return this.prisma.planting.update({ where: { id: plantingId }, data: input });
  }

  async removePlanting(user: AuthUser, plantingId: string) {
    await this.assertPlanting(user, plantingId, 'write');
    await this.prisma.planting.delete({ where: { id: plantingId } });
    return { id: plantingId, deleted: true };
  }

  async addActivity(user: AuthUser, plantingId: string, input: ActivityCreateInput) {
    const p = await this.assertPlanting(user, plantingId, 'write');
    if (input.clientId) {
      const existing = await this.prisma.cropActivity.findUnique({ where: { clientId: input.clientId } });
      if (existing) return existing;
    }
    const { costKz, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const activity = await tx.cropActivity.create({ data: { ...data, plantingId } });
      if (costKz && costKz > 0) {
        const farm = await tx.farm.findUniqueOrThrow({ where: { id: p.farmId }, select: { organizationId: true } });
        const category =
          input.type === 'FERTILIZER' ? 'FERTILIZER' : input.type === 'TREATMENT' ? 'PESTICIDE' : input.type === 'IRRIGATION' ? 'IRRIGATION' : input.type === 'SOWING' ? 'SEEDS' : 'LABOR';
        await tx.transaction.create({
          data: {
            organizationId: farm.organizationId,
            farmId: p.farmId,
            plantingId,
            type: 'EXPENSE',
            category,
            amount: costKz,
            date: input.date,
            description: input.product ? `${input.product}` : 'Atividade de campo',
          },
        });
      }
      return activity;
    });
  }

  async addHarvest(user: AuthUser, plantingId: string, input: HarvestCreateInput) {
    const p = await this.assertPlanting(user, plantingId, 'write');
    if (input.clientId) {
      const existing = await this.prisma.harvest.findUnique({ where: { clientId: input.clientId } });
      if (existing) return existing;
    }
    const { saleAmountKz, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const harvest = await tx.harvest.create({ data: { ...data, plantingId } });
      if (saleAmountKz && saleAmountKz > 0) {
        const farm = await tx.farm.findUniqueOrThrow({ where: { id: p.farmId }, select: { organizationId: true } });
        await tx.transaction.create({
          data: {
            organizationId: farm.organizationId,
            farmId: p.farmId,
            plantingId,
            type: 'INCOME',
            category: 'SALES',
            amount: saleAmountKz,
            date: input.date,
            description: `Venda de colheita (${input.quantityKg} kg)`,
          },
        });
      }
      return harvest;
    });
  }

  /** Relatório de produtividade: real vs estimado, por cultura e propriedade. */
  async productivity(user: AuthUser, from?: Date, to?: Date) {
    const farmIds = await this.access.farmIds(user);
    const plantings = await this.prisma.planting.findMany({
      where: { farmId: { in: farmIds }, ...(from || to ? { plantedAt: { gte: from, lte: to } } : {}) },
      include: { crop: true, harvests: true, farm: { select: { id: true, name: true } } },
    });
    const byCrop = new Map<string, { crop: string; areaHa: number; harvestedKg: number; estimatedKg: number; plantings: number }>();
    for (const p of plantings) {
      const k = p.crop.name;
      const row = byCrop.get(k) ?? { crop: k, areaHa: 0, harvestedKg: 0, estimatedKg: 0, plantings: 0 };
      row.areaHa += Number(p.areaHa);
      row.harvestedKg += p.harvests.reduce((s, h) => s + Number(h.quantityKg), 0);
      row.estimatedKg += Number(p.estimatedYieldKg ?? 0);
      row.plantings += 1;
      byCrop.set(k, row);
    }
    return [...byCrop.values()].map((r) => ({
      ...r,
      yieldKgHa: r.areaHa > 0 && r.harvestedKg > 0 ? Math.round(r.harvestedKg / r.areaHa) : null,
    }));
  }

  /** Calendário agrícola: plantações planeadas e colheitas previstas. */
  async calendar(user: AuthUser) {
    const farmIds = await this.access.farmIds(user);
    const plantings = await this.prisma.planting.findMany({
      where: { farmId: { in: farmIds }, status: { in: ['PLANNED', 'GROWING'] } },
      include: { crop: { select: { name: true, stages: true, cycleDays: true } }, farm: { select: { id: true, name: true } } },
      orderBy: { expectedHarvestAt: 'asc' },
    });
    const now = Date.now();
    return plantings.map((p) => {
      const days = p.plantedAt ? Math.floor((now - p.plantedAt.getTime()) / DAY) : null;
      const stages = (p.crop.stages as { key: string; name: string; startDay: number; endDay: number }[]) ?? [];
      const stage = days === null ? null : stages.find((s) => days >= s.startDay && days <= s.endDay) ?? null;
      return {
        id: p.id,
        farm: p.farm,
        crop: p.crop.name,
        status: p.status,
        plantedAt: p.plantedAt,
        expectedHarvestAt: p.expectedHarvestAt,
        daysSincePlanting: days,
        currentStage: stage?.name ?? null,
        progress: days === null ? 0 : Math.min(1, Math.max(0, days / p.crop.cycleDays)),
      };
    });
  }
}
