import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, ProjectCategory, Difficulty } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ProjectQuery {
  q?: string;
  category?: ProjectCategory;
  difficulty?: Difficulty;
  maxCostKz?: number;
  offline?: boolean;
  favorites?: boolean;
}

const sumCost = (components: { unitPriceKz: Prisma.Decimal; quantity: number; optional: boolean; condition: string | null }[]) => {
  // Custo base de referência: 1 zona, com eletricidade, componentes obrigatórios e sem condições
  const base = components.filter((c) => !c.optional && (!c.condition || c.condition === 'HAS_ELECTRICITY' || c.condition === 'NO_PUMP'));
  return Math.round(base.reduce((s, c) => s + Number(c.unitPriceKz) * c.quantity, 0));
};

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, q: ProjectQuery) {
    const where: Prisma.ProjectWhereInput = {
      published: true,
      ...(q.category ? { category: q.category } : {}),
      ...(q.difficulty ? { difficulty: q.difficulty } : {}),
      ...(q.offline ? { worksOffline: true } : {}),
      ...(q.favorites ? { favorites: { some: { userId } } } : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { tagline: { contains: q.q, mode: 'insensitive' } },
              { description: { contains: q.q, mode: 'insensitive' } },
              { components: { some: { name: { contains: q.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const projects = await this.prisma.project.findMany({
      where,
      orderBy: [{ category: 'asc' }, { difficulty: 'asc' }],
      include: {
        components: { select: { unitPriceKz: true, quantity: true, optional: true, condition: true } },
        favorites: { where: { userId }, select: { userId: true } },
      },
    });
    return projects
      .map(({ components, favorites, firmware, architecture, wiring, ...p }) => ({
        ...p,
        hasFirmware: !!firmware,
        componentCount: components.length,
        baseCostKz: sumCost(components),
        isFavorite: favorites.length > 0,
      }))
      .filter((p) => (q.maxCostKz ? p.baseCostKz <= q.maxCostKz : true));
  }

  async get(userId: string, slug: string) {
    const p = await this.prisma.project.findUnique({
      where: { slug },
      include: {
        components: { orderBy: { sortOrder: 'asc' } },
        favorites: { where: { userId }, select: { userId: true } },
      },
    });
    if (!p || !p.published) throw new NotFoundException('Projeto não encontrado');
    const { favorites, ...rest } = p;
    return { ...rest, baseCostKz: sumCost(p.components), isFavorite: favorites.length > 0 };
  }

  async compare(userId: string, slugs: string[]) {
    const unique = [...new Set(slugs)].slice(0, 4);
    return Promise.all(unique.map((s) => this.get(userId, s)));
  }

  async toggleFavorite(userId: string, slug: string) {
    const p = await this.prisma.project.findUnique({ where: { slug }, select: { id: true } });
    if (!p) throw new NotFoundException('Projeto não encontrado');
    const key = { userId_projectId: { userId, projectId: p.id } };
    const existing = await this.prisma.favorite.findUnique({ where: key });
    if (existing) {
      await this.prisma.favorite.delete({ where: key });
      return { slug, isFavorite: false };
    }
    await this.prisma.favorite.create({ data: { userId, projectId: p.id } });
    return { slug, isFavorite: true };
  }
}
