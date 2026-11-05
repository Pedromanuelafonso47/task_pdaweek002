import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { LABELS, telemetrySchema, type DeviceCreateInput } from '@agrogenius/shared';
import { Prisma, type Device, type Sensor } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthUser } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { FarmAccessService } from '../access/farm-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AutomationService } from './automation.service';
import { MqttService } from './mqtt.service';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const OFFLINE_AFTER_MS = 15 * 60_000;
/** Leituras com timestamp do dispositivo mais de 7 dias no passado ou 5 min no futuro são corrigidas para "agora". */
const MAX_BACKFILL_MS = 7 * 86_400_000;

@Injectable()
export class IotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('IoT');
  private offlineTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FarmAccessService,
    private readonly automation: AutomationService,
    private readonly mqtt: MqttService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.mqtt.onMessage(async (username, channel, payload) => {
      const device = await this.prisma.device.findUnique({ where: { mqttUsername: username } });
      if (!device) throw new Error('dispositivo desconhecido');
      if (channel === 'telemetry') await this.ingest(device, JSON.parse(payload));
      else if (channel === 'status') await this.setOnline(device, payload === 'online');
      else if (channel === 'ack') {
        const a = JSON.parse(payload) as { cmdId?: string; ok?: boolean; reason?: string };
        if (a.cmdId) await this.automation.ack(device.id, a.cmdId, !!a.ok, a.reason);
      } else if (channel === 'event') {
        const ev = JSON.parse(payload) as { type?: string; zone?: number; reason?: string };
        await this.handleEvent(device, ev);
      }
    });
    this.offlineTimer = setInterval(() => this.detectOffline().catch((e: Error) => this.logger.warn(e.message)), 60_000);
  }

  onModuleDestroy() {
    if (this.offlineTimer) clearInterval(this.offlineTimer);
  }

  // ─────────────────────────── Dispositivos ───────────────────────────

  async list(user: AuthUser, farmId?: string) {
    if (farmId) await this.access.assert(user, farmId);
    const farmIds = farmId ? [farmId] : await this.access.farmIds(user);
    const devices = await this.prisma.device.findMany({
      where: { farmId: { in: farmIds } },
      include: {
        farm: { select: { id: true, name: true } },
        field: { select: { id: true, name: true } },
        sensors: { orderBy: { key: 'asc' } },
        actuators: { orderBy: { key: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    // Última leitura de cada sensor (uma consulta)
    const sensorIds = devices.flatMap((d) => d.sensors.map((s) => s.id));
    const latest = sensorIds.length
      ? await this.prisma.$queryRaw<{ sensorId: string; value: number; recordedAt: Date }[]>`
          SELECT DISTINCT ON ("sensorId") "sensorId", value, "recordedAt"
          FROM "SensorReading" WHERE "sensorId" IN (${Prisma.join(sensorIds)})
          ORDER BY "sensorId", "recordedAt" DESC`
      : [];
    const byId = new Map(latest.map((l) => [l.sensorId, l]));
    return devices.map(({ secretHash: _s, ...d }) => ({
      ...d,
      sensors: d.sensors.map((s) => ({ ...s, last: byId.get(s.id) ?? null })),
    }));
  }

  async get(user: AuthUser, id: string) {
    const d = await this.prisma.device.findUnique({ where: { id }, select: { farmId: true } });
    if (!d) throw new NotFoundException('Dispositivo não encontrado');
    await this.access.assert(user, d.farmId);
    const [device] = (await this.list(user, d.farmId)).filter((x) => x.id === id);
    return { ...device, config: await this.automation.buildConfig(id), broker: { configured: this.mqtt.configured, connected: this.mqtt.connected } };
  }

  /** Regista o dispositivo e devolve as credenciais MQTT. O segredo só é mostrado UMA vez. */
  async create(user: AuthUser, input: DeviceCreateInput) {
    await this.access.assert(user, input.farmId, 'write');
    if (input.fieldId) {
      const f = await this.prisma.field.findFirst({ where: { id: input.fieldId, farmId: input.farmId } });
      if (!f) throw new BadRequestException('Zona inválida');
    }
    const keys = [...input.sensors.map((s) => s.key), ...input.actuators.map((a) => a.key)];
    if (new Set(keys).size !== keys.length) throw new BadRequestException('Chaves de sensores/atuadores repetidas');
    const secret = randomBytes(24).toString('base64url');
    const mqttUsername = `dev_${randomBytes(6).toString('hex')}`;
    const { sensors, actuators, ...data } = input;
    const device = await this.prisma.device.create({
      data: {
        ...data,
        mqttUsername,
        secretHash: hash(secret),
        sensors: { create: sensors.map((s) => ({ ...s, fieldId: s.fieldId ?? input.fieldId ?? null })) },
        actuators: { create: actuators },
      },
      include: { sensors: true, actuators: true },
    });
    await this.prisma.farmEvent.create({ data: { farmId: input.farmId, type: 'DEVICE', summary: `Dispositivo "${device.name}" registado` } });
    const { secretHash: _h, ...safe } = device;
    return { device: safe, credentials: { mqttUsername, secret, topicBase: `agrogenius/${mqttUsername}` } };
  }

  async update(user: AuthUser, id: string, input: Partial<Pick<Device, 'name' | 'fieldId' | 'latitude' | 'longitude' | 'mode' | 'status' | 'localRules'>>) {
    const d = await this.prisma.device.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dispositivo não encontrado');
    await this.access.assert(user, d.farmId, 'write');
    const updated = await this.prisma.device.update({ where: { id }, data: input });
    // Ao desativar ou mudar de modo, desliga tudo por segurança e envia nova configuração
    if (input.status === 'DISABLED' || (input.mode && input.mode !== d.mode)) {
      const on = await this.prisma.actuator.findMany({ where: { deviceId: id, isOn: true } });
      for (const a of on) {
        await this.automation.issue(a.id, { action: 'OFF' }, { source: 'MANUAL', user }).catch(() => undefined);
      }
    }
    await this.automation.pushConfig(id);
    const { secretHash: _h, ...safe } = updated;
    return safe;
  }

  async rotateSecret(user: AuthUser, id: string) {
    const d = await this.prisma.device.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dispositivo não encontrado');
    await this.access.assert(user, d.farmId, 'write');
    const secret = randomBytes(24).toString('base64url');
    await this.prisma.device.update({ where: { id }, data: { secretHash: hash(secret) } });
    return { mqttUsername: d.mqttUsername, secret };
  }

  async remove(user: AuthUser, id: string) {
    const d = await this.prisma.device.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dispositivo não encontrado');
    await this.access.assert(user, d.farmId, 'write');
    await this.prisma.device.delete({ where: { id } });
    return { id, deleted: true };
  }

  async addSensor(user: AuthUser, deviceId: string, input: { key: string; kind: Sensor['kind']; unit: string; fieldId?: string | null; minThreshold?: number | null; maxThreshold?: number | null }) {
    const d = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!d) throw new NotFoundException('Dispositivo não encontrado');
    await this.access.assert(user, d.farmId, 'write');
    return this.prisma.sensor.create({ data: { ...input, deviceId } });
  }

  async updateSensor(user: AuthUser, sensorId: string, input: Partial<Pick<Sensor, 'kind' | 'unit' | 'fieldId' | 'minThreshold' | 'maxThreshold'>>) {
    const s = await this.prisma.sensor.findUnique({ where: { id: sensorId }, include: { device: true } });
    if (!s) throw new NotFoundException('Sensor não encontrado');
    await this.access.assert(user, s.device.farmId, 'write');
    return this.prisma.sensor.update({ where: { id: sensorId }, data: input });
  }

  async addActuator(user: AuthUser, deviceId: string, input: { key: string; kind: 'PUMP' | 'VALVE' | 'FAN' | 'LIGHT' | 'OTHER'; name: string; maxRuntimeSec: number }) {
    const d = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!d) throw new NotFoundException('Dispositivo não encontrado');
    await this.access.assert(user, d.farmId, 'write');
    return this.prisma.actuator.create({ data: { ...input, deviceId } });
  }

  // ─────────────────────────── Leituras ───────────────────────────

  async readings(user: AuthUser, sensorId: string, from: Date, to: Date, bucket: 'raw' | 'hour' | 'day') {
    const s = await this.prisma.sensor.findUnique({ where: { id: sensorId }, include: { device: true } });
    if (!s) throw new NotFoundException('Sensor não encontrado');
    await this.access.assert(user, s.device.farmId);
    if (bucket === 'raw') {
      const rows = await this.prisma.sensorReading.findMany({
        where: { sensorId, recordedAt: { gte: from, lte: to } },
        orderBy: { recordedAt: 'asc' },
        take: 5000,
        select: { value: true, recordedAt: true },
      });
      return { sensor: s, bucket, points: rows.map((r) => ({ t: r.recordedAt, avg: r.value, min: r.value, max: r.value })) };
    }
    const points = await this.prisma.$queryRaw<{ t: Date; avg: number; min: number; max: number; n: bigint }[]>`
      SELECT date_trunc(${bucket}, "recordedAt") AS t, avg(value)::float AS avg, min(value) AS min, max(value) AS max, count(*) AS n
      FROM "SensorReading"
      WHERE "sensorId" = ${sensorId} AND "recordedAt" BETWEEN ${from} AND ${to}
      GROUP BY 1 ORDER BY 1`;
    return { sensor: s, bucket, points: points.map((p) => ({ ...p, n: Number(p.n) })) };
  }

  // ─────────────────── Autenticação de dispositivos ───────────────────

  async authenticateDevice(username: string | undefined, secret: string | undefined) {
    if (!username || !secret) throw new UnauthorizedException('Credenciais do dispositivo em falta');
    const device = await this.prisma.device.findUnique({ where: { mqttUsername: username } });
    const a = Buffer.from(device?.secretHash ?? '0'.repeat(64), 'hex');
    const b = Buffer.from(hash(secret), 'hex');
    if (!device || a.length !== b.length || !timingSafeEqual(a, b) || device.status === 'DISABLED') {
      throw new UnauthorizedException('Credenciais do dispositivo inválidas');
    }
    return device;
  }

  /** ACL MQTT: cada dispositivo só publica/subscreve nos seus tópicos. */
  aclAllows(username: string, topic: string, action: 'publish' | 'subscribe') {
    const base = `agrogenius/${username}/`;
    if (!topic.startsWith(base)) return false;
    const ch = topic.slice(base.length);
    return action === 'publish' ? ['telemetry', 'status', 'ack', 'event'].includes(ch) : ['cmd', 'config'].includes(ch);
  }

  // ─────────────────────────── Ingestão ───────────────────────────

  async ingest(device: Device, raw: unknown) {
    const parsed = telemetrySchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException('Telemetria inválida');
    const { ts, r, a } = parsed.data;
    const now = Date.now();
    let recordedAt = ts ? new Date(ts * 1000) : new Date(now);
    if (recordedAt.getTime() > now + 5 * 60_000 || recordedAt.getTime() < now - MAX_BACKFILL_MS) recordedAt = new Date(now);

    const sensors = await this.prisma.sensor.findMany({ where: { deviceId: device.id, key: { in: Object.keys(r) } } });
    const rows = sensors.filter((s) => Number.isFinite(r[s.key])).map((s) => ({ sensorId: s.id, value: r[s.key], recordedAt }));
    if (rows.length) await this.prisma.sensorReading.createMany({ data: rows });

    if (a) {
      const acts = await this.prisma.actuator.findMany({ where: { deviceId: device.id, key: { in: Object.keys(a) } } });
      for (const act of acts) {
        if (act.isOn !== a[act.key]) {
          await this.prisma.actuator.update({ where: { id: act.id }, data: { isOn: a[act.key], lastChangedAt: new Date() } });
        }
      }
    }
    await this.setOnline(device, true);

    this.realtime.toFarm(device.farmId, 'readings', {
      deviceId: device.id,
      recordedAt,
      values: Object.fromEntries(sensors.map((s) => [s.id, r[s.key]])),
      actuators: a ?? {},
    });

    // Alertas e automação só para leituras recentes (não para dados em atraso do buffer)
    if (now - recordedAt.getTime() < 15 * 60_000) {
      for (const s of sensors) {
        await this.checkThresholds(device, s, r[s.key]);
        await this.automation.evaluateForSensor(s.id, r[s.key]);
      }
    }
    return { accepted: rows.length, ignored: Object.keys(r).length - rows.length };
  }

  private async checkThresholds(device: Device, s: Sensor, value: number) {
    const farm = await this.prisma.farm.findUniqueOrThrow({ where: { id: device.farmId }, select: { ownerId: true, name: true } });
    const label = LABELS.sensorKind[s.kind];
    const notify = (type: string, title: string, severity: 'WARNING' | 'CRITICAL') =>
      this.notifications.notify({
        userId: farm.ownerId,
        farmId: device.farmId,
        type,
        severity,
        title,
        body: `${device.name} · ${label}: ${value} ${s.unit} (${farm.name})`,
        data: { sensorId: s.id, value },
        dedupeMinutes: 60,
        dedupeKey: s.id,
      });
    if (s.minThreshold !== null && value < s.minThreshold) {
      if (s.kind === 'SOIL_MOISTURE') await notify('LOW_MOISTURE', 'Humidade do solo baixa', 'WARNING');
      else if (s.kind === 'WATER_LEVEL') await notify('LOW_RESERVOIR', 'Reservatório com nível baixo', 'CRITICAL');
      else await notify('THRESHOLD', `${label} abaixo do limite`, 'WARNING');
    }
    if (s.maxThreshold !== null && value > s.maxThreshold) {
      if (s.kind === 'AIR_TEMPERATURE' || s.kind === 'SOIL_TEMPERATURE') await notify('HIGH_TEMP', 'Temperatura elevada', 'WARNING');
      else await notify('THRESHOLD', `${label} acima do limite`, 'WARNING');
    }
  }

  private async setOnline(device: Device, online: boolean) {
    if (device.status === 'DISABLED') return;
    const status = online ? 'ONLINE' : 'OFFLINE';
    await this.prisma.device.update({ where: { id: device.id }, data: { status, ...(online ? { lastSeenAt: new Date() } : {}) } });
    if (device.status !== status) {
      this.realtime.toFarm(device.farmId, 'device-status', { deviceId: device.id, status });
      if (online && device.status === 'PENDING') await this.automation.pushConfig(device.id);
    }
  }

  private async handleEvent(device: Device, ev: { type?: string; zone?: number; reason?: string }) {
    if (ev.type === 'DRY_RUN_BLOCKED') {
      const farm = await this.prisma.farm.findUniqueOrThrow({ where: { id: device.farmId }, select: { ownerId: true } });
      await this.notifications.notify({
        userId: farm.ownerId,
        farmId: device.farmId,
        type: 'IRRIGATION_FAILURE',
        severity: 'CRITICAL',
        title: 'Rega bloqueada: sem água',
        body: `${device.name}: a proteção contra funcionamento a seco impediu o arranque da bomba.`,
        dedupeMinutes: 120,
        dedupeKey: device.id,
      });
    }
    this.realtime.toFarm(device.farmId, 'device-event', { deviceId: device.id, ...ev });
  }

  private async detectOffline() {
    const cutoff = new Date(Date.now() - OFFLINE_AFTER_MS);
    const stale = await this.prisma.device.findMany({
      where: { status: 'ONLINE', lastSeenAt: { lt: cutoff } },
      include: { farm: { select: { ownerId: true, name: true } } },
    });
    for (const d of stale) {
      await this.prisma.device.update({ where: { id: d.id }, data: { status: 'OFFLINE' } });
      this.realtime.toFarm(d.farmId, 'device-status', { deviceId: d.id, status: 'OFFLINE' });
      await this.notifications.notify({
        userId: d.farm.ownerId,
        farmId: d.farmId,
        type: 'SENSOR_OFFLINE',
        severity: 'WARNING',
        title: 'Dispositivo desconectado',
        body: `${d.name} (${d.farm.name}) não comunica há mais de 15 minutos. Se tiver regras locais, continua a funcionar sem ligação.`,
        dedupeMinutes: 360,
        dedupeKey: d.id,
      });
    }
  }
}
