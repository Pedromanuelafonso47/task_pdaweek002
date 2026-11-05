import { Injectable, Logger } from '@nestjs/common';
import type { NotificationSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface NotifyInput {
  userId: string;
  farmId?: string;
  type: string;
  severity?: NotificationSeverity;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
  /** não repetir a mesma notificação (tipo+propriedade+chave) dentro desta janela */
  dedupeMinutes?: number;
  dedupeKey?: string;
}

/**
 * Canal interno (app + WebSocket). SMS, email e WhatsApp entram como "channels" adicionais:
 * implementar a interface NotificationChannel e registá-la em `channels` (ver docs/NOTIFICATIONS.md).
 */
export interface NotificationChannel {
  name: string;
  send(n: NotifyInput & { id: string }): Promise<void>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');
  private readonly channels: NotificationChannel[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async notify(n: NotifyInput) {
    if (n.dedupeMinutes) {
      const since = new Date(Date.now() - n.dedupeMinutes * 60_000);
      const dup = await this.prisma.notification.findFirst({
        where: {
          userId: n.userId,
          type: n.type,
          farmId: n.farmId,
          createdAt: { gte: since },
          ...(n.dedupeKey ? { data: { path: ['key'], equals: n.dedupeKey } } : {}),
        },
      });
      if (dup) return dup;
    }
    const data = n.dedupeKey ? { ...((n.data as object) ?? {}), key: n.dedupeKey } : n.data;
    const created = await this.prisma.notification.create({
      data: { userId: n.userId, farmId: n.farmId, type: n.type, severity: n.severity ?? 'INFO', title: n.title, body: n.body, data },
    });
    this.realtime.toUser(n.userId, 'notification', created);
    for (const ch of this.channels) {
      ch.send({ ...n, id: created.id }).catch((e: Error) => this.logger.warn(`Canal ${ch.name} falhou: ${e.message}`));
    }
    return created;
  }

  list(userId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    return { id, read: true };
  }

  async markAllRead(userId: string) {
    const r = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { updated: r.count };
  }
}
