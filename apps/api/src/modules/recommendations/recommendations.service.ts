import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Goal, Problem } from '@agrogenius/shared';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { FarmAccessService } from '../access/farm-access.service';
import { FinanceService } from '../finance/finance.service';
import { buildBom, estimateZones, recommend } from './engine/engine';
import type { CatalogProject, FarmProfile } from './engine/types';

const projectSummary = {
  select: { id: true, slug: true, title: true, tagline: true, category: true, difficulty: true, implementationDays: true },
} as const;

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FarmAccessService,
    private readonly finance: FinanceService,
  ) {}

  /** Constrói o perfil agrícola estruturado a partir dos dados reais da propriedade. */
  async buildProfile(farmId: string): Promise<FarmProfile> {
    const farm = await this.prisma.farm.findUniqueOrThrow({
      where: { id: farmId },
      include: {
        plantings: { where: { status: { in: ['PLANNED', 'GROWING'] } }, include: { crop: true } },
        _count: { select: { fields: true } },
      },
    });
    const costs = await this.finance.annualCosts(farmId);
    const crops = new Map<string, FarmProfile['crops'][number]>();
    for (const p of farm.plantings) {
      const c = crops.get(p.crop.slug) ?? { slug: p.crop.slug, name: p.crop.name, waterNeed: p.crop.waterNeed, areaHa: 0 };
      c.areaHa += Number(p.areaHa);
      crops.set(p.crop.slug, c);
    }
    return {
      province: farm.province,
      totalAreaHa: Number(farm.totalAreaHa),
      cultivatedAreaHa: Number(farm.cultivatedAreaHa),
      terrainType: farm.terrainType,
      soilType: farm.soilType,
      waterAvailability: farm.waterAvailability,
      waterSource: farm.waterSource,
      irrigationSystem: farm.irrigationSystem,
      hasElectricity: farm.hasElectricity,
      internet: farm.internet,
      hasSensors: farm.hasSensors,
      hasPumps: farm.hasPumps,
      hasMachinery: farm.hasMachinery,
      techLevel: farm.techLevel,
      budgetKz: farm.budgetKz === null ? null : Number(farm.budgetKz),
      goals: farm.goals as Goal[],
      problems: farm.problems as Problem[],
      crops: [...crops.values()],
      zoneCount: farm._count.fields,
      annualIrrigationCostKz: costs.irrigation,
      annualLaborCostKz: costs.labor,
    };
  }

  async catalog(): Promise<CatalogProject[]> {
    const projects = await this.prisma.project.findMany({
      where: { published: true },
      include: { components: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { slug: 'asc' },
    });
    return projects.map((p) => ({
      id: p.id,
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
        name: c.name,
        spec: c.spec,
        quantity: c.quantity,
        quantityRule: c.quantityRule,
        maxQuantity: c.maxQuantity,
        unitPriceKz: Number(c.unitPriceKz),
        optional: c.optional,
        condition: c.condition,
      })),
    }));
  }

  /** Corre o motor e sincroniza as recomendações guardadas, preservando decisões do agricultor. */
  async generate(user: AuthUser, farmId: string) {
    await this.access.assert(user, farmId);
    const [profile, catalog] = await Promise.all([this.buildProfile(farmId), this.catalog()]);
    const result = recommend(profile, catalog);

    await this.prisma.$transaction(async (tx) => {
      const keep = new Set(result.recommendations.map((r) => r.projectId));
      // Remove pendentes que deixaram de se aplicar (ex.: dados da propriedade mudaram)
      await tx.recommendation.deleteMany({
        where: { farmId, source: 'ENGINE', status: 'PENDING', projectId: { notIn: [...keep] } },
      });
      for (const r of result.recommendations) {
        const data = {
          engineVersion: result.version,
          score: r.score,
          rawScore: r.rawScore,
          priority: r.priority,
          problem: r.problem,
          reasons: r.reasons as unknown as Prisma.InputJsonValue,
          bom: r.bom as unknown as Prisma.InputJsonValue,
          estimatedCostKz: r.estimatedCostKz,
          withinBudget: r.withinBudget,
          roi: r.roi as unknown as Prisma.InputJsonValue,
          phases: r.phases as unknown as Prisma.InputJsonValue,
          warnings: r.warnings,
        };
        await tx.recommendation.upsert({
          where: { farmId_projectId_source: { farmId, projectId: r.projectId, source: 'ENGINE' } },
          create: { ...data, farmId, projectId: r.projectId, source: 'ENGINE' },
          update: data, // estado (aceite/descartada) mantém-se
        });
      }
    });

    const owner = await this.prisma.farm.findUniqueOrThrow({ where: { id: farmId }, select: { ownerId: true, name: true } });
    if (result.recommendations.length) {
      await this.prisma.notification.create({
        data: {
          userId: owner.ownerId,
          farmId,
          type: 'NEW_RECOMMENDATION',
          title: 'Recomendações atualizadas',
          body: `${result.recommendations.length} projeto(s) analisado(s) para ${owner.name}.`,
        },
      });
    }
    return this.list(user, farmId);
  }

  async list(user: AuthUser, farmId: string) {
    await this.access.assert(user, farmId);
    const [items, profile, catalog] = await Promise.all([
      this.prisma.recommendation.findMany({
        where: { farmId },
        include: {
          project: projectSummary,
          validatedBy: { select: { id: true, fullName: true } },
          author: { select: { id: true, fullName: true } },
        },
        orderBy: [{ status: 'asc' }, { rawScore: 'desc' }],
      }),
      this.buildProfile(farmId),
      this.catalog(),
    ]);
    // Análise de transparência recalculada (determinística e barata)
    const analysis = recommend(profile, catalog);
    return {
      items,
      analysis: {
        version: analysis.version,
        excluded: analysis.excluded.map((e) => ({ ...e, title: catalog.find((c) => c.slug === e.projectSlug)?.title ?? e.projectSlug })),
        missingData: analysis.missingData,
        profile,
      },
    };
  }

  async get(user: AuthUser, id: string) {
    const rec = await this.prisma.recommendation.findUnique({
      where: { id },
      include: {
        project: { include: { components: { orderBy: { sortOrder: 'asc' } } } },
        farm: { select: { id: true, name: true, budgetKz: true, province: true } },
        validatedBy: { select: { id: true, fullName: true } },
        farmProject: true,
      },
    });
    if (!rec) throw new NotFoundException('Recomendação não encontrada');
    await this.access.assert(user, rec.farmId);
    return rec;
  }

  async pending(user: AuthUser) {
    const farmIds = await this.access.farmIds(user);
    return this.prisma.recommendation.findMany({
      where: { farmId: { in: farmIds }, status: 'PENDING' },
      include: { project: projectSummary, farm: { select: { id: true, name: true } } },
      orderBy: { rawScore: 'desc' },
      take: 10,
    });
  }

  async setStatus(user: AuthUser, id: string, status: 'PENDING' | 'ACCEPTED' | 'DISMISSED' | 'IMPLEMENTED') {
    const rec = await this.prisma.recommendation.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Recomendação não encontrada');
    if (user.role === 'TECHNICIAN') throw new ForbiddenException('Só o agricultor decide sobre as recomendações');
    await this.access.assert(user, rec.farmId, 'write');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.recommendation.update({ where: { id }, data: { status } });
      if (status === 'ACCEPTED' || status === 'IMPLEMENTED') {
        await tx.farmProject.upsert({
          where: { recommendationId: id },
          create: {
            farmId: rec.farmId,
            projectId: rec.projectId,
            recommendationId: id,
            status: status === 'IMPLEMENTED' ? 'COMPLETED' : 'PLANNED',
            completedAt: status === 'IMPLEMENTED' ? new Date() : null,
          },
          update: { status: status === 'IMPLEMENTED' ? 'COMPLETED' : 'PLANNED', completedAt: status === 'IMPLEMENTED' ? new Date() : null },
        });
      }
      return updated;
    });
  }

  /** Técnico cria uma recomendação manual (com justificação própria). */
  async createManual(user: AuthUser, farmId: string, input: { projectSlug: string; problem: string; justification: string; priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }) {
    await this.access.assert(user, farmId);
    const project = await this.prisma.project.findUnique({ where: { slug: input.projectSlug } });
    if (!project) throw new BadRequestException('Projeto inexistente');
    const [profile, catalog] = await Promise.all([this.buildProfile(farmId), this.catalog()]);
    const engineView = recommend(profile, catalog, 100).recommendations.find((r) => r.projectId === project.id);
    // O custo vem sempre do dimensionamento do motor — o técnico não introduz preços à mão.
    const cat = catalog.find((c) => c.id === project.id)!;
    const bom = engineView?.bom ?? buildBom(cat, profile, estimateZones(profile).zones);
    const cost = bom.filter((l) => !l.optional).reduce((s, l) => s + l.totalKz, 0);
    return this.prisma.recommendation.upsert({
      where: { farmId_projectId_source: { farmId, projectId: project.id, source: 'TECHNICIAN' } },
      create: {
        farmId,
        projectId: project.id,
        source: 'TECHNICIAN',
        authorId: user.id,
        validatedById: user.id,
        validatedAt: new Date(),
        score: engineView?.score ?? 50,
        priority: input.priority,
        problem: input.problem,
        reasons: [{ code: 'TECHNICIAN', text: input.justification, weight: 0 }],
        bom: bom as unknown as Prisma.InputJsonValue,
        estimatedCostKz: cost,
        withinBudget: profile.budgetKz === null ? true : cost <= profile.budgetKz,
        warnings: [],
      },
      update: { problem: input.problem, priority: input.priority, reasons: [{ code: 'TECHNICIAN', text: input.justification, weight: 0 }] },
    });
  }

  async farmProjects(user: AuthUser, farmId: string) {
    await this.access.assert(user, farmId);
    return this.prisma.farmProject.findMany({
      where: { farmId },
      include: { project: projectSummary, recommendation: { select: { id: true, estimatedCostKz: true, priority: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Acompanhamento da implementação real (datas, custo real). Concluir regista o investimento IoT nas finanças. */
  async updateFarmProject(
    user: AuthUser,
    id: string,
    input: { status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'; startedAt?: Date | null; completedAt?: Date | null; actualCostKz?: number | null; notes?: string | null },
  ) {
    const fp = await this.prisma.farmProject.findUnique({ where: { id }, include: { project: { select: { title: true } } } });
    if (!fp) throw new NotFoundException('Projeto não encontrado');
    await this.access.assert(user, fp.farmId, 'write');
    const data = { ...input };
    if (input.status === 'IN_PROGRESS' && !fp.startedAt && input.startedAt === undefined) data.startedAt = new Date();
    if (input.status === 'COMPLETED' && !fp.completedAt && input.completedAt === undefined) data.completedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.farmProject.update({ where: { id }, data });
      if (fp.recommendationId && input.status === 'COMPLETED') {
        await tx.recommendation.update({ where: { id: fp.recommendationId }, data: { status: 'IMPLEMENTED' } });
      }
      const cost = input.actualCostKz ?? null;
      if (input.status === 'COMPLETED' && cost && cost > 0 && !fp.actualCostKz) {
        const farm = await tx.farm.findUniqueOrThrow({ where: { id: fp.farmId }, select: { organizationId: true } });
        await tx.transaction.create({
          data: { organizationId: farm.organizationId, farmId: fp.farmId, type: 'EXPENSE', category: 'IOT', amount: cost, date: data.completedAt ?? new Date(), description: `Implementação: ${fp.project.title}` },
        });
      }
      await tx.farmEvent.create({ data: { farmId: fp.farmId, type: 'PROJECT', summary: `Projeto "${fp.project.title}": ${input.status ?? 'atualizado'}` } });
      return updated;
    });
  }

  /** Técnico valida uma recomendação do motor. */
  async validate(user: AuthUser, id: string) {
    const rec = await this.prisma.recommendation.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Recomendação não encontrada');
    await this.access.assert(user, rec.farmId);
    return this.prisma.recommendation.update({ where: { id }, data: { validatedById: user.id, validatedAt: new Date() } });
  }
}
