import { Controller, Get, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { FarmAccessService } from '../access/farm-access.service';

/** Agregados do dashboard — calculados a partir dos dados reais, nada é estimado aqui. */
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FarmAccessService,
  ) {}

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    const scope = this.access.scope(user);
    const farms = await this.prisma.farm.findMany({
      where: scope,
      select: {
        id: true,
        name: true,
        province: true,
        latitude: true,
        longitude: true,
        boundary: true,
        totalAreaHa: true,
        cultivatedAreaHa: true,
        isDemo: true,
        fields: { select: { id: true, name: true, areaHa: true, boundary: true, color: true, isIrrigationZone: true } },
      },
    });
    const farmIds = farms.map((f) => f.id);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const in60 = new Date(Date.now() + 60 * 86_400_000);

    const [plantings, upcoming, finance, devices, alerts, pending, unread] = await Promise.all([
      this.prisma.planting.findMany({
        where: { farmId: { in: farmIds }, status: { in: ['PLANNED', 'GROWING'] } },
        select: { areaHa: true, estimatedYieldKg: true, crop: { select: { name: true } } },
      }),
      this.prisma.planting.findMany({
        where: { farmId: { in: farmIds }, status: 'GROWING', expectedHarvestAt: { gte: new Date(), lte: in60 } },
        include: { crop: { select: { name: true } }, farm: { select: { id: true, name: true } } },
        orderBy: { expectedHarvestAt: 'asc' },
        take: 5,
      }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { farmId: { in: farmIds }, date: { gte: yearStart } },
        _sum: { amount: true },
      }),
      this.prisma.device.groupBy({ by: ['status'], where: { farmId: { in: farmIds } }, _count: true }),
      this.prisma.notification.findMany({
        where: { userId: user.id, readAt: null, severity: { in: ['WARNING', 'CRITICAL'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.recommendation.findMany({
        where: { farmId: { in: farmIds }, status: 'PENDING' },
        include: { project: { select: { slug: true, title: true, category: true } }, farm: { select: { id: true, name: true } } },
        orderBy: { score: 'desc' },
        take: 4,
      }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    const sum = (t: 'INCOME' | 'EXPENSE') => Number(finance.find((f) => f.type === t)?._sum.amount ?? 0);
    const crops = new Map<string, number>();
    for (const p of plantings) crops.set(p.crop.name, (crops.get(p.crop.name) ?? 0) + Number(p.areaHa));
    const withEstimate = plantings.filter((p) => p.estimatedYieldKg !== null);

    return {
      farms,
      kpis: {
        farmCount: farms.length,
        totalAreaHa: farms.reduce((s, f) => s + Number(f.totalAreaHa), 0),
        cultivatedAreaHa: farms.reduce((s, f) => s + Number(f.cultivatedAreaHa), 0),
        activeCrops: crops.size,
        estimatedProductionKg: withEstimate.length ? withEstimate.reduce((s, p) => s + Number(p.estimatedYieldKg), 0) : null,
        estimateCoverage: plantings.length ? withEstimate.length / plantings.length : 0,
        incomeYtd: sum('INCOME'),
        expenseYtd: sum('EXPENSE'),
        unreadNotifications: unread,
      },
      cropAreas: [...crops.entries()].map(([crop, areaHa]) => ({ crop, areaHa })),
      upcomingHarvests: upcoming,
      devices: Object.fromEntries(devices.map((d) => [d.status, d._count])),
      alerts,
      pendingRecommendations: pending,
    };
  }
}

@Module({ controllers: [DashboardController] })
export class DashboardModule {}
