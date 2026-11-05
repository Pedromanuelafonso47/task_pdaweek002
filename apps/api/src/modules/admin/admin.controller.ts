import { BadRequestException, Body, Controller, Delete, Get, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { PrismaService } from '../../prisma/prisma.service';
import { FarmAccessService } from '../access/farm-access.service';

const userUpdateSchema = z.object({ role: z.enum(['FARMER', 'TECHNICIAN', 'ADMIN']), isActive: z.boolean() }).partial();
const technicianCreateSchema = z.object({
  fullName: z.string().trim().min(3),
  email: z.email().toLowerCase(),
  password: z.string().min(8),
  phone: z.string().optional(),
});
const assignSchema = z.object({ technicianEmail: z.email().toLowerCase() });

@ApiTags('admin')
@ApiBearerAuth()
@Controller()
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FarmAccessService,
  ) {}

  @Roles('ADMIN')
  @Get('admin/stats')
  async stats() {
    const [users, farms, area, devices, readings, recs, byProvince, byRole] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.farm.count({ where: { deletedAt: null } }),
      this.prisma.farm.aggregate({ where: { deletedAt: null }, _sum: { totalAreaHa: true, cultivatedAreaHa: true } }),
      this.prisma.device.groupBy({ by: ['status'], _count: true }),
      this.prisma.sensorReading.count({ where: { recordedAt: { gte: new Date(Date.now() - 86_400_000) } } }),
      this.prisma.recommendation.groupBy({ by: ['status'], _count: true }),
      this.prisma.farm.groupBy({ by: ['province'], where: { deletedAt: null }, _count: true, _sum: { totalAreaHa: true } }),
      this.prisma.user.groupBy({ by: ['role'], _count: true }),
    ]);
    return {
      users,
      farms,
      totalAreaHa: Number(area._sum.totalAreaHa ?? 0),
      cultivatedAreaHa: Number(area._sum.cultivatedAreaHa ?? 0),
      devices: Object.fromEntries(devices.map((d) => [d.status, d._count])),
      readings24h: readings,
      recommendations: Object.fromEntries(recs.map((r) => [r.status, r._count])),
      byProvince: byProvince.map((p) => ({ province: p.province, farms: p._count, areaHa: Number(p._sum.totalAreaHa ?? 0) })),
      byRole: Object.fromEntries(byRole.map((r) => [r.role, r._count])),
    };
  }

  @Roles('ADMIN')
  @Get('admin/users')
  users(@Query('q') q?: string) {
    return this.prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { fullName: { contains: q, mode: 'insensitive' } }] } : {},
      select: {
        id: true, email: true, fullName: true, role: true, isActive: true, province: true, createdAt: true, lastLoginAt: true,
        organization: { select: { name: true, type: true } },
        _count: { select: { ownedFarms: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @Roles('ADMIN')
  @Patch('admin/users/:id')
  @ApiZodBody(userUpdateSchema)
  async updateUser(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body(new ZodPipe(userUpdateSchema)) body: z.infer<typeof userUpdateSchema>) {
    if (id === me.id && (body.role !== undefined || body.isActive === false)) {
      throw new BadRequestException('Não podes alterar o teu próprio perfil de acesso');
    }
    const u = await this.prisma.user.update({ where: { id }, data: body, select: { id: true, role: true, isActive: true } });
    if (body.isActive === false) {
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return u;
  }

  @Roles('ADMIN')
  @Post('admin/technicians')
  @ApiZodBody(technicianCreateSchema)
  async createTechnician(@Body(new ZodPipe(technicianCreateSchema)) body: z.infer<typeof technicianCreateSchema>) {
    const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
    const u = await this.prisma.user.create({
      data: {
        email: body.email, fullName: body.fullName, phone: body.phone, passwordHash, role: 'TECHNICIAN', onboardingCompleted: true,
        organization: { create: { name: body.fullName, type: 'INDIVIDUAL' } },
      },
    });
    return { id: u.id, email: u.email, role: u.role };
  }

  // ── Atribuição de técnicos (o agricultor autoriza o acesso à sua propriedade) ──
  @Get('farms/:farmId/technicians')
  async technicians(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    await this.access.assert(user, farmId);
    return this.prisma.technicianAssignment.findMany({
      where: { farmId, revokedAt: null },
      include: { technician: { select: { id: true, fullName: true, email: true, phone: true } } },
    });
  }

  @Roles('FARMER', 'ADMIN')
  @Post('farms/:farmId/technicians')
  @ApiZodBody(assignSchema)
  async assign(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string, @Body(new ZodPipe(assignSchema)) body: z.infer<typeof assignSchema>) {
    await this.access.assert(user, farmId, 'write');
    const tech = await this.prisma.user.findUnique({ where: { email: body.technicianEmail } });
    if (!tech || tech.role !== 'TECHNICIAN') throw new BadRequestException('Não existe nenhum técnico com esse email');
    return this.prisma.technicianAssignment.upsert({
      where: { technicianId_farmId: { technicianId: tech.id, farmId } },
      create: { technicianId: tech.id, farmId },
      update: { revokedAt: null, grantedAt: new Date() },
    });
  }

  @Roles('FARMER', 'ADMIN')
  @Delete('farms/:farmId/technicians/:technicianId')
  async revoke(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string, @Param('technicianId') technicianId: string) {
    await this.access.assert(user, farmId, 'write');
    await this.prisma.technicianAssignment.updateMany({ where: { farmId, technicianId }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }

  @Roles('ADMIN')
  @Get('admin/audit')
  audit(@Query('entity') entity?: string) {
    return this.prisma.auditLog.findMany({
      where: entity ? { entity } : {},
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @Get('users/me')
  async me(@CurrentUser() user: AuthUser) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { organization: true } });
    const { passwordHash: _p, ...rest } = u;
    return rest;
  }
}

@Module({ controllers: [AdminController] })
export class AdminModule {}
