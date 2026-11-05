import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const DAY = 86_400_000;

/**
 * Lembretes periódicos (corre de hora a hora, em processo).
 * Com várias instâncias da API, mover para uma fila com bloqueio (BullMQ + Redis) para não duplicar.
 * A deduplicação por janela já evita repetições mesmo com reinícios.
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Scheduler');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    setTimeout(() => this.run(), 30_000);
    this.timer = setInterval(() => this.run(), 3600_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run() {
    try {
      await this.harvestReminders();
      await this.maintenanceReminders();
    } catch (e) {
      this.logger.warn(`Falha nos lembretes: ${(e as Error).message}`);
    }
  }

  /** Colheitas previstas nos próximos 7 dias. */
  async harvestReminders() {
    const soon = await this.prisma.planting.findMany({
      where: { status: 'GROWING', expectedHarvestAt: { gte: new Date(), lte: new Date(Date.now() + 7 * DAY) }, farm: { deletedAt: null } },
      include: { crop: { select: { name: true } }, farm: { select: { id: true, name: true, ownerId: true } }, field: { select: { name: true } } },
    });
    for (const p of soon) {
      const days = Math.max(0, Math.ceil((p.expectedHarvestAt!.getTime() - Date.now()) / DAY));
      await this.notifications.notify({
        userId: p.farm.ownerId,
        farmId: p.farm.id,
        type: 'HARVEST_SOON',
        title: `Colheita de ${p.crop.name} prevista ${days === 0 ? 'hoje' : `em ${days} dia(s)`}`,
        body: `${p.farm.name}${p.field ? ` · ${p.field.name}` : ''}: confirma a maturação no campo e prepara mão de obra e armazenamento. A data é uma previsão pelo ciclo da cultura.`,
        dedupeMinutes: 7 * 24 * 60,
        dedupeKey: p.id,
      });
    }
  }

  /** Manutenção dos projetos IoT concluídos: lembrete mensal com a primeira tarefa da lista do projeto. */
  async maintenanceReminders() {
    const done = await this.prisma.farmProject.findMany({
      where: { status: 'COMPLETED', completedAt: { lte: new Date(Date.now() - 30 * DAY) }, farm: { deletedAt: null } },
      include: { project: { select: { title: true, maintenance: true } }, farm: { select: { id: true, name: true, ownerId: true } } },
    });
    for (const fp of done) {
      if (!fp.project.maintenance.length) continue;
      await this.notifications.notify({
        userId: fp.farm.ownerId,
        farmId: fp.farm.id,
        type: 'MAINTENANCE',
        title: `Manutenção: ${fp.project.title}`,
        body: `${fp.farm.name}: ${fp.project.maintenance.join(' ')}`,
        dedupeMinutes: 30 * 24 * 60,
        dedupeKey: fp.id,
      });
    }
  }
}
