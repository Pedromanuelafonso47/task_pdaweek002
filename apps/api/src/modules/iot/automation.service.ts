import { BadRequestException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { CommandInput, RuleCreateInput } from '@agrogenius/shared';
import type { Actuator, AutomationRule, Device } from '@prisma/client';
import type { AuthUser } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { FarmAccessService } from '../access/farm-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MqttService } from './mqtt.service';
import { evaluateRule, HARD_MAX_RUN_SEC, validateCommand } from './safety';

const COMMAND_TTL_MS = 2 * 60_000;

export const angolaHHMM = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Luanda', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

@Injectable()
export class AutomationService {
  private readonly logger = new Logger('Automation');

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FarmAccessService,
    private readonly mqtt: MqttService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────────────────────── Regras ─────────────────────────────

  async listRules(user: AuthUser, farmId: string) {
    await this.access.assert(user, farmId);
    return this.prisma.automationRule.findMany({
      where: { farmId },
      include: {
        sensor: { select: { id: true, key: true, kind: true, unit: true, device: { select: { id: true, name: true } } } },
        actuator: { select: { id: true, key: true, kind: true, name: true, isOn: true, device: { select: { id: true, name: true, mode: true } } } },
        waterLevelSensor: { select: { id: true, key: true, unit: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async validateRule(farmId: string, input: RuleCreateInput) {
    const sensor = await this.prisma.sensor.findFirst({ where: { id: input.sensorId, device: { farmId } } });
    const actuator = await this.prisma.actuator.findFirst({ where: { id: input.actuatorId, device: { farmId } } });
    if (!sensor || !actuator) throw new BadRequestException('Sensor ou atuador não pertencem a esta propriedade');
    if (input.maxDurationSec > Math.min(actuator.maxRuntimeSec, HARD_MAX_RUN_SEC)) {
      throw new BadRequestException(`Duração máxima excede o limite do atuador (${actuator.maxRuntimeSec} s)`);
    }
    if (actuator.kind === 'PUMP' && !input.waterLevelSensorId) {
      throw new BadRequestException('Regras que ligam bombas exigem um sensor de nível de água (proteção contra funcionamento a seco)');
    }
    if (input.waterLevelSensorId) {
      const wl = await this.prisma.sensor.findFirst({ where: { id: input.waterLevelSensorId, device: { farmId }, kind: 'WATER_LEVEL' } });
      if (!wl) throw new BadRequestException('O sensor de proteção tem de ser um sensor de nível de água desta propriedade');
    }
    return { sensor, actuator };
  }

  async createRule(user: AuthUser, farmId: string, input: RuleCreateInput) {
    await this.access.assert(user, farmId, 'write');
    const { actuator } = await this.validateRule(farmId, input);
    const rule = await this.prisma.automationRule.create({ data: { ...input, farmId } });
    await this.pushConfig(actuator.deviceId);
    return rule;
  }

  async updateRule(user: AuthUser, ruleId: string, input: RuleCreateInput) {
    const rule = await this.prisma.automationRule.findUnique({ where: { id: ruleId }, include: { actuator: true } });
    if (!rule) throw new NotFoundException('Regra não encontrada');
    await this.access.assert(user, rule.farmId, 'write');
    const { actuator } = await this.validateRule(rule.farmId, input);
    const updated = await this.prisma.automationRule.update({ where: { id: ruleId }, data: input });
    await this.pushConfig(actuator.deviceId);
    if (actuator.deviceId !== rule.actuator.deviceId) await this.pushConfig(rule.actuator.deviceId);
    return updated;
  }

  async removeRule(user: AuthUser, ruleId: string) {
    const rule = await this.prisma.automationRule.findUnique({ where: { id: ruleId }, include: { actuator: true } });
    if (!rule) throw new NotFoundException('Regra não encontrada');
    await this.access.assert(user, rule.farmId, 'write');
    await this.prisma.automationRule.delete({ where: { id: ruleId } });
    await this.pushConfig(rule.actuator.deviceId);
    return { id: ruleId, deleted: true };
  }

  /** Configuração executada localmente pelo firmware (guardada em NVS). */
  async buildConfig(deviceId: string) {
    const device = await this.prisma.device.findUniqueOrThrow({ where: { id: deviceId } });
    const rules = await this.prisma.automationRule.findMany({
      where: { enabled: true, actuator: { deviceId } },
      include: { sensor: true, actuator: true },
      orderBy: { actuator: { key: 'asc' } },
    });
    return {
      mode: device.mode,
      zones: rules.map((r) => ({
        sensor: r.sensor.key,
        valve: r.actuator.key,
        start: r.threshold,
        stop: r.stopThreshold,
        maxSec: Math.min(r.maxDurationSec, r.actuator.maxRuntimeSec, HARD_MAX_RUN_SEC),
        cooldownSec: r.cooldownSec,
      })),
    };
  }

  async pushConfig(deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || !device.localRules) return false;
    const cfg = await this.buildConfig(deviceId);
    return this.mqtt.publish(device.mqttUsername, 'config', cfg, true);
  }

  // ─────────────────────────── Comandos ────────────────────────────

  private async waterContext(actuator: Actuator & { device: Device }, rule?: AutomationRule | null) {
    // 1) sensor definido na regra; 2) qualquer sensor de nível no mesmo dispositivo
    const sensorId =
      rule?.waterLevelSensorId ??
      (await this.prisma.automationRule.findFirst({ where: { actuatorId: actuator.id, waterLevelSensorId: { not: null } } }))?.waterLevelSensorId ??
      (await this.prisma.sensor.findFirst({ where: { deviceId: actuator.deviceId, kind: 'WATER_LEVEL' } }))?.id;
    if (!sensorId) return null;
    const sensor = await this.prisma.sensor.findUniqueOrThrow({ where: { id: sensorId } });
    const last = await this.prisma.sensorReading.findFirst({ where: { sensorId }, orderBy: { recordedAt: 'desc' } });
    const min = rule?.minWaterLevel ?? sensor.minThreshold ?? 1;
    return { value: last?.value ?? null, min, recordedAt: last?.recordedAt ?? null };
  }

  /** Emite um comando validado. Usado por utilizadores (MANUAL) e pelo motor de regras (RULE). */
  async issue(
    actuatorId: string,
    input: CommandInput,
    origin: { source: 'MANUAL'; user: AuthUser } | { source: 'RULE'; rule: AutomationRule },
  ) {
    const actuator = await this.prisma.actuator.findUnique({ where: { id: actuatorId }, include: { device: true } });
    if (!actuator) throw new NotFoundException('Atuador não encontrado');
    if (origin.source === 'MANUAL') await this.access.assert(origin.user, actuator.device.farmId, 'write');

    const since = new Date(Date.now() - 60_000);
    const commandsLastMinute = await this.prisma.command.count({ where: { actuatorId, createdAt: { gte: since } } });
    const verdict = validateCommand({
      action: input.action,
      durationSec: input.durationSec,
      source: origin.source,
      actuator: { kind: actuator.kind, maxRuntimeSec: actuator.maxRuntimeSec },
      device: { status: actuator.device.status, mode: actuator.device.mode, lastSeenAt: actuator.device.lastSeenAt },
      water: actuator.kind === 'PUMP' ? await this.waterContext(actuator, origin.source === 'RULE' ? origin.rule : null) : null,
      commandsLastMinute,
      now: new Date(),
    });

    const base = {
      actuatorId,
      action: input.action,
      durationSec: input.action === 'ON' ? input.durationSec : null,
      issuedById: origin.source === 'MANUAL' ? origin.user.id : null,
      ruleId: origin.source === 'RULE' ? origin.rule.id : null,
    };

    if (!verdict.ok) {
      // Comandos rejeitados ficam no histórico — auditabilidade
      await this.prisma.command.create({ data: { ...base, status: 'REJECTED', reason: verdict.reason } });
      throw new UnprocessableEntityException({ message: verdict.reason });
    }

    const cmd = await this.prisma.command.create({ data: { ...base, status: 'PENDING', reason: verdict.warnings.join(' ') || null } });
    const sent = this.mqtt.publish(actuator.device.mqttUsername, 'cmd', {
      cmdId: cmd.id,
      actuator: actuator.key,
      action: input.action,
      durationSec: input.durationSec,
    });
    const final = sent ? await this.prisma.command.update({ where: { id: cmd.id }, data: { status: 'SENT' } }) : cmd;
    this.realtime.toFarm(actuator.device.farmId, 'command', { ...final, actuatorKey: actuator.key, deviceId: actuator.deviceId });
    return { ...final, warnings: verdict.warnings, delivery: sent ? 'MQTT' : 'POLLING' };
  }

  async history(user: AuthUser, farmId: string) {
    await this.access.assert(user, farmId);
    return this.prisma.command.findMany({
      where: { actuator: { device: { farmId } } },
      include: {
        actuator: { select: { key: true, name: true, kind: true, device: { select: { name: true } } } },
        issuedBy: { select: { fullName: true } },
        rule: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** Confirmação vinda do dispositivo. */
  async ack(deviceId: string, cmdId: string, ok: boolean, reason?: string) {
    const cmd = await this.prisma.command.findFirst({ where: { id: cmdId, actuator: { deviceId } }, include: { actuator: { include: { device: true } } } });
    if (!cmd) return;
    const updated = await this.prisma.command.update({
      where: { id: cmdId },
      data: { status: ok ? 'ACKED' : 'REJECTED', ackAt: new Date(), reason: reason || cmd.reason },
    });
    if (ok) {
      await this.prisma.actuator.update({ where: { id: cmd.actuatorId }, data: { isOn: cmd.action === 'ON', lastChangedAt: new Date() } });
    } else if (cmd.action === 'ON') {
      const farm = await this.prisma.farm.findUniqueOrThrow({ where: { id: cmd.actuator.device.farmId }, select: { ownerId: true } });
      await this.notifications.notify({
        userId: farm.ownerId,
        farmId: cmd.actuator.device.farmId,
        type: 'IRRIGATION_FAILURE',
        severity: 'WARNING',
        title: `${cmd.actuator.name}: comando recusado pelo dispositivo`,
        body: reason || 'O dispositivo recusou o comando.',
      });
    }
    this.realtime.toFarm(cmd.actuator.device.farmId, 'command', updated);
  }

  /** Comandos pendentes para dispositivos sem MQTT (polling HTTP). */
  async pendingFor(deviceId: string) {
    const cutoff = new Date(Date.now() - COMMAND_TTL_MS);
    await this.prisma.command.updateMany({
      where: { actuator: { deviceId }, status: { in: ['PENDING', 'SENT'] }, createdAt: { lt: cutoff } },
      data: { status: 'EXPIRED' },
    });
    const cmds = await this.prisma.command.findMany({
      where: { actuator: { deviceId }, status: 'PENDING' },
      include: { actuator: { select: { key: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (cmds.length) await this.prisma.command.updateMany({ where: { id: { in: cmds.map((c) => c.id) } }, data: { status: 'SENT' } });
    return cmds.map((c) => ({ cmdId: c.id, actuator: c.actuator.key, action: c.action, durationSec: c.durationSec }));
  }

  /** Avaliação no servidor — só para dispositivos com localRules=false e em modo AUTO. */
  async evaluateForSensor(sensorId: string, value: number) {
    const rules = await this.prisma.automationRule.findMany({
      where: { sensorId, enabled: true, actuator: { device: { localRules: false, mode: 'AUTO' } } },
      include: { actuator: true },
    });
    const now = new Date();
    for (const rule of rules) {
      const action = evaluateRule(rule, value, rule.actuator.isOn, now, angolaHHMM(now));
      if (!action) continue;
      try {
        await this.issue(rule.actuatorId, { action, durationSec: action === 'ON' ? rule.maxDurationSec : undefined }, { source: 'RULE', rule });
        if (action === 'ON') await this.prisma.automationRule.update({ where: { id: rule.id }, data: { lastTriggeredAt: now } });
      } catch (e) {
        this.logger.warn(`Regra "${rule.name}" não executada: ${(e as Error).message}`);
      }
    }
  }
}
