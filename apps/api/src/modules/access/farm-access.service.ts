import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Ponto ÚNICO de isolamento multi-tenant.
 *  - ADMIN: todas as propriedades
 *  - FARMER: propriedades da sua organização
 *  - TECHNICIAN: propriedades com atribuição ativa
 */
@Injectable()
export class FarmAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Filtro Prisma com as propriedades visíveis para o utilizador. */
  scope(user: AuthUser): Prisma.FarmWhereInput {
    const base: Prisma.FarmWhereInput = { deletedAt: null };
    if (user.role === 'ADMIN') return base;
    if (user.role === 'TECHNICIAN') {
      return { ...base, assignments: { some: { technicianId: user.id, revokedAt: null } } };
    }
    return { ...base, organizationId: user.organizationId };
  }

  /** Garante acesso; `write` exige ser da organização (técnicos podem ler e recomendar, não editar a propriedade). */
  async assert(user: AuthUser, farmId: string, mode: 'read' | 'write' = 'read') {
    const farm = await this.prisma.farm.findFirst({ where: { id: farmId, ...this.scope(user) }, select: { id: true, organizationId: true } });
    if (!farm) throw new NotFoundException('Propriedade não encontrada');
    if (mode === 'write' && user.role === 'TECHNICIAN') {
      throw new ForbiddenException('Técnicos não podem alterar dados da propriedade');
    }
    return farm;
  }

  async farmIds(user: AuthUser): Promise<string[]> {
    const farms = await this.prisma.farm.findMany({ where: this.scope(user), select: { id: true } });
    return farms.map((f) => f.id);
  }
}
