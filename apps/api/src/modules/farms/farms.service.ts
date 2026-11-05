import { BadRequestException, Injectable } from '@nestjs/common';
import type { FarmCreateInput, FarmUpdateInput, FieldCreateInput } from '@agrogenius/shared';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { FarmAccessService } from '../access/farm-access.service';

const json = (v: unknown) => (v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue | undefined));

@Injectable()
export class FarmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FarmAccessService,
  ) {}

  list(user: AuthUser) {
    return this.prisma.farm.findMany({
      where: this.access.scope(user),
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { fields: true, devices: true, plantings: true } },
        plantings: { where: { status: { in: ['PLANNED', 'GROWING'] } }, include: { crop: { select: { name: true } } } },
      },
    });
  }

  async get(user: AuthUser, id: string) {
    await this.access.assert(user, id);
    return this.prisma.farm.findUniqueOrThrow({
      where: { id },
      include: {
        fields: { orderBy: { createdAt: 'asc' } },
        plantings: { include: { crop: true, field: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
        devices: { include: { sensors: true, actuators: true } },
        farmProjects: { include: { project: { select: { slug: true, title: true, category: true } } } },
        history: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
  }

  async create(user: AuthUser, input: FarmCreateInput) {
    const { boundary, ...rest } = input;
    const farm = await this.prisma.farm.create({
      data: {
        ...rest,
        boundary: json(boundary),
        organizationId: user.organizationId,
        ownerId: user.id,
        history: { create: { type: 'CREATED', summary: 'Propriedade registada' } },
      },
    });
    return farm;
  }

  async update(user: AuthUser, id: string, input: FarmUpdateInput) {
    await this.access.assert(user, id, 'write');
    const { boundary, ...rest } = input;
    if (rest.cultivatedAreaHa !== undefined || rest.totalAreaHa !== undefined) {
      const cur = await this.prisma.farm.findUniqueOrThrow({ where: { id }, select: { totalAreaHa: true, cultivatedAreaHa: true } });
      const total = rest.totalAreaHa ?? Number(cur.totalAreaHa);
      const cult = rest.cultivatedAreaHa ?? Number(cur.cultivatedAreaHa);
      if (cult > total) {
        throw new BadRequestException('A área cultivada não pode exceder a área total');
      }
    }
    return this.prisma.farm.update({
      where: { id },
      data: {
        ...rest,
        ...(boundary !== undefined ? { boundary: json(boundary) } : {}),
        history: { create: { type: 'UPDATED', summary: 'Dados da propriedade atualizados', data: { fields: Object.keys(input) } } },
      },
    });
  }

  /** Remoção lógica: mantém histórico financeiro e de auditoria. */
  async remove(user: AuthUser, id: string) {
    await this.access.assert(user, id, 'write');
    await this.prisma.farm.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  // ── Zonas ──
  async listFields(user: AuthUser, farmId: string) {
    await this.access.assert(user, farmId);
    return this.prisma.field.findMany({
      where: { farmId },
      orderBy: { createdAt: 'asc' },
      include: { plantings: { where: { status: { in: ['PLANNED', 'GROWING'] } }, include: { crop: true } }, sensors: true },
    });
  }

  async createField(user: AuthUser, farmId: string, input: FieldCreateInput) {
    await this.access.assert(user, farmId, 'write');
    const { boundary, ...rest } = input;
    return this.prisma.field.create({ data: { ...rest, boundary: json(boundary), farmId } });
  }

  async updateField(user: AuthUser, farmId: string, fieldId: string, input: Partial<FieldCreateInput>) {
    await this.access.assert(user, farmId, 'write');
    const { boundary, ...rest } = input;
    return this.prisma.field.update({
      where: { id: fieldId, farmId },
      data: { ...rest, ...(boundary !== undefined ? { boundary: json(boundary) } : {}) },
    });
  }

  async removeField(user: AuthUser, farmId: string, fieldId: string) {
    await this.access.assert(user, farmId, 'write');
    await this.prisma.field.delete({ where: { id: fieldId, farmId } });
    return { id: fieldId, deleted: true };
  }
}
