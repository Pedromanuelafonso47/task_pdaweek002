import { Injectable, NotFoundException } from '@nestjs/common';
import type { TransactionCreateInput } from '@agrogenius/shared';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { FarmAccessService } from '../access/farm-access.service';

export interface TxFilter {
  farmId?: string;
  type?: 'EXPENSE' | 'INCOME';
  from?: Date;
  to?: Date;
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FarmAccessService,
  ) {}

  private async where(user: AuthUser, f: TxFilter): Promise<Prisma.TransactionWhereInput> {
    if (f.farmId) await this.access.assert(user, f.farmId);
    const farmIds = f.farmId ? [f.farmId] : await this.access.farmIds(user);
    const scope: Prisma.TransactionWhereInput =
      user.role === 'FARMER' && !f.farmId
        ? { organizationId: user.organizationId } // inclui transações gerais sem propriedade
        : { farmId: { in: farmIds } };
    return {
      ...scope,
      ...(f.type ? { type: f.type } : {}),
      ...(f.from || f.to ? { date: { gte: f.from, lte: f.to } } : {}),
    };
  }

  async list(user: AuthUser, f: TxFilter) {
    return this.prisma.transaction.findMany({
      where: await this.where(user, f),
      orderBy: { date: 'desc' },
      take: 500,
      include: { farm: { select: { id: true, name: true } }, planting: { select: { id: true, crop: { select: { name: true } } } } },
    });
  }

  async create(user: AuthUser, input: TransactionCreateInput) {
    if (input.clientId) {
      const existing = await this.prisma.transaction.findUnique({ where: { clientId: input.clientId } });
      if (existing) return existing;
    }
    if (input.farmId) await this.access.assert(user, input.farmId, 'write');
    if (input.plantingId) {
      const p = await this.prisma.planting.findUnique({ where: { id: input.plantingId }, select: { farmId: true } });
      if (!p || (input.farmId && p.farmId !== input.farmId)) throw new NotFoundException('Plantação inválida');
      await this.access.assert(user, p.farmId, 'write');
      input.farmId = p.farmId;
    }
    return this.prisma.transaction.create({ data: { ...input, organizationId: user.organizationId } });
  }

  private async own(user: AuthUser, id: string) {
    const tx = await this.prisma.transaction.findFirst({ where: { id, organizationId: user.role === 'ADMIN' ? undefined : user.organizationId } });
    if (!tx) throw new NotFoundException('Transação não encontrada');
    return tx;
  }

  async update(user: AuthUser, id: string, input: Partial<TransactionCreateInput>) {
    await this.own(user, id);
    if (input.farmId) await this.access.assert(user, input.farmId, 'write');
    return this.prisma.transaction.update({ where: { id }, data: input });
  }

  async remove(user: AuthUser, id: string) {
    await this.own(user, id);
    await this.prisma.transaction.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Resumo financeiro calculado a partir das transações reais. */
  async summary(user: AuthUser, f: TxFilter) {
    const where = await this.where(user, f);
    const txs = await this.prisma.transaction.findMany({
      where,
      select: {
        type: true,
        category: true,
        amount: true,
        date: true,
        farmId: true,
        planting: { select: { id: true, areaHa: true, crop: { select: { name: true } } } },
      },
    });

    let income = 0;
    let expense = 0;
    const byCategory = new Map<string, number>();
    const byMonth = new Map<string, { month: string; income: number; expense: number }>();
    const byCrop = new Map<string, { crop: string; income: number; expense: number; areaHa: number; plantings: Set<string> }>();

    for (const t of txs) {
      const v = Number(t.amount);
      if (t.type === 'INCOME') income += v;
      else {
        expense += v;
        byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + v);
      }
      const m = t.date.toISOString().slice(0, 7);
      const row = byMonth.get(m) ?? { month: m, income: 0, expense: 0 };
      row[t.type === 'INCOME' ? 'income' : 'expense'] += v;
      byMonth.set(m, row);
      if (t.planting) {
        const k = t.planting.crop.name;
        const c = byCrop.get(k) ?? { crop: k, income: 0, expense: 0, areaHa: 0, plantings: new Set<string>() };
        c[t.type === 'INCOME' ? 'income' : 'expense'] += v;
        if (!c.plantings.has(t.planting.id)) {
          c.plantings.add(t.planting.id);
          c.areaHa += Number(t.planting.areaHa);
        }
        byCrop.set(k, c);
      }
    }

    // Custo de produção por hectare, por propriedade
    const farmIds = [...new Set(txs.map((t) => t.farmId).filter((x): x is string => !!x))];
    const farms = await this.prisma.farm.findMany({ where: { id: { in: farmIds } }, select: { id: true, name: true, cultivatedAreaHa: true } });
    const costPerHa = farms.map((farm) => {
      const cost = txs.filter((t) => t.farmId === farm.id && t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
      const area = Number(farm.cultivatedAreaHa);
      return { farmId: farm.id, farm: farm.name, expense: cost, cultivatedAreaHa: area, costPerHa: area > 0 ? Math.round(cost / area) : null };
    });

    return {
      currency: 'AOA',
      income,
      expense,
      balance: income - expense,
      transactions: txs.length,
      byCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
      byMonth: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
      byCrop: [...byCrop.values()].map(({ plantings: _p, ...c }) => ({
        ...c,
        profit: c.income - c.expense,
        costPerHa: c.areaHa > 0 ? Math.round(c.expense / c.areaHa) : null,
      })),
      costPerHa,
    };
  }

  /** Custos de rega e mão de obra dos últimos 12 meses — alimenta o ROI do motor. */
  async annualCosts(farmId: string) {
    const since = new Date(Date.now() - 365 * 86_400_000);
    const rows = await this.prisma.transaction.groupBy({
      by: ['category'],
      where: { farmId, type: 'EXPENSE', date: { gte: since }, category: { in: ['IRRIGATION', 'LABOR', 'FUEL'] } },
      _sum: { amount: true },
    });
    const get = (c: string) => rows.find((r) => r.category === c)?._sum.amount;
    const irrigation = get('IRRIGATION');
    const fuel = get('FUEL');
    const labor = get('LABOR');
    return {
      irrigation: irrigation || fuel ? Number(irrigation ?? 0) + Number(fuel ?? 0) : null,
      labor: labor ? Number(labor) : null,
    };
  }
}
