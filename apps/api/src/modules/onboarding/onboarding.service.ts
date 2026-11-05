import { BadRequestException, Injectable } from '@nestjs/common';
import type { OnboardingInput } from '@agrogenius/shared';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationsService } from '../recommendations/recommendations.service';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recs: RecommendationsService,
  ) {}

  async getDraft(user: AuthUser) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { onboardingDraft: true, onboardingCompleted: true, fullName: true, email: true },
    });
    return u;
  }

  async saveDraft(user: AuthUser, draft: unknown) {
    const size = JSON.stringify(draft ?? null).length;
    if (size > 50_000) throw new BadRequestException('Rascunho demasiado grande');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { onboardingDraft: draft === null ? Prisma.DbNull : (draft as Prisma.InputJsonValue) },
    });
    return { saved: true };
  }

  /** Converte o onboarding num perfil agrícola estruturado e gera as primeiras recomendações. */
  async complete(user: AuthUser, input: OnboardingInput) {
    const crops = await this.prisma.crop.findMany({ where: { slug: { in: input.production.crops.map((c) => c.cropSlug) } } });
    const bySlug = new Map(crops.map((c) => [c.slug, c]));
    const unknown = input.production.crops.filter((c) => !bySlug.has(c.cropSlug));
    if (unknown.length) throw new BadRequestException(`Cultura desconhecida: ${unknown.map((u) => u.cropSlug).join(', ')}`);

    const { personal, farm, production, infrastructure, goals } = input;
    const farmId = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          fullName: personal.fullName,
          phone: personal.phone,
          province: personal.province,
          municipality: personal.municipality,
          locality: personal.locality || null,
          farmerType: personal.farmerType,
          onboardingCompleted: true,
          onboardingDraft: Prisma.DbNull,
        },
      });
      if (personal.farmerType === 'COOPERATIVE' || personal.farmerType === 'ENTERPRISE') {
        await tx.organization.update({
          where: { id: user.organizationId },
          data: { type: personal.farmerType === 'COOPERATIVE' ? 'COOPERATIVE' : 'COMPANY' },
        });
      }
      const created = await tx.farm.create({
        data: {
          organizationId: user.organizationId,
          ownerId: user.id,
          name: farm.name,
          province: farm.province,
          municipality: farm.municipality || null,
          locality: farm.locality || null,
          latitude: farm.latitude ?? null,
          longitude: farm.longitude ?? null,
          boundary: farm.boundary ? (farm.boundary as Prisma.InputJsonValue) : Prisma.DbNull,
          totalAreaHa: farm.totalAreaHa,
          cultivatedAreaHa: farm.cultivatedAreaHa,
          terrainType: farm.terrainType,
          soilType: farm.soilType,
          waterAvailability: farm.waterAvailability,
          waterSource: farm.waterSource,
          irrigationSystem: farm.irrigationSystem,
          ...infrastructure,
          goals: goals.goals,
          otherGoal: goals.otherGoal || null,
          budgetKz: goals.budgetKz,
          problems: production.problems,
          history: { create: { type: 'ONBOARDING', summary: 'Propriedade registada no onboarding' } },
        },
      });
      for (const c of production.crops) {
        await tx.planting.create({
          data: {
            farmId: created.id,
            cropId: bySlug.get(c.cropSlug)!.id,
            areaHa: c.areaHa,
            season: c.season || null,
            harvestFrequency: c.harvestFrequency || null,
            status: 'GROWING',
            estimatedYieldKg: c.approxYieldKgHa ? Math.round(c.approxYieldKgHa * c.areaHa) : null,
          },
        });
      }
      return created.id;
    });

    const recommendations = await this.recs.generate(user, farmId);
    return { farmId, recommendations };
  }
}
