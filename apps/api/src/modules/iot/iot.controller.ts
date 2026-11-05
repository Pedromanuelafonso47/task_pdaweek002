import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  actuatorCreateSchema,
  commandSchema,
  deviceCreateSchema,
  deviceUpdateSchema,
  ruleCreateSchema,
  sensorCreateSchema,
  sensorUpdateSchema,
  type CommandInput,
  type DeviceCreateInput,
  type RuleCreateInput,
} from '@agrogenius/shared';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { AutomationService } from './automation.service';
import { IotService } from './iot.service';

@ApiTags('iot — AgroControl')
@ApiBearerAuth()
@Controller('iot')
export class IotController {
  constructor(
    private readonly iot: IotService,
    private readonly automation: AutomationService,
  ) {}

  // ── Dispositivos ──
  @Get('devices')
  list(@CurrentUser() user: AuthUser, @Query('farmId') farmId?: string) {
    return this.iot.list(user, farmId || undefined);
  }

  @Get('devices/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.iot.get(user, id);
  }

  @Post('devices')
  @ApiZodBody(deviceCreateSchema)
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(deviceCreateSchema)) body: DeviceCreateInput) {
    return this.iot.create(user, body);
  }

  @Patch('devices/:id')
  @ApiZodBody(deviceUpdateSchema)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(deviceUpdateSchema)) body: z.infer<typeof deviceUpdateSchema>) {
    return this.iot.update(user, id, body);
  }

  @Post('devices/:id/rotate-secret')
  rotate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.iot.rotateSecret(user, id);
  }

  @Delete('devices/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.iot.remove(user, id);
  }

  @Post('devices/:id/sensors')
  @ApiZodBody(sensorCreateSchema)
  addSensor(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(sensorCreateSchema)) body: z.infer<typeof sensorCreateSchema>) {
    return this.iot.addSensor(user, id, body);
  }

  @Patch('sensors/:id')
  @ApiZodBody(sensorUpdateSchema)
  updateSensor(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(sensorUpdateSchema)) body: z.infer<typeof sensorUpdateSchema>) {
    return this.iot.updateSensor(user, id, body);
  }

  @Post('devices/:id/actuators')
  @ApiZodBody(actuatorCreateSchema)
  addActuator(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(actuatorCreateSchema)) body: z.infer<typeof actuatorCreateSchema>) {
    return this.iot.addActuator(user, id, body);
  }

  @Get('sensors/:id/readings')
  readings(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('bucket') bucket?: string,
  ) {
    const t = to ? new Date(to) : new Date();
    const f = from ? new Date(from) : new Date(t.getTime() - 7 * 86_400_000);
    const b = bucket === 'raw' || bucket === 'day' ? bucket : 'hour';
    return this.iot.readings(user, id, f, t, b);
  }

  // ── Automação ──
  @Get('farms/:farmId/rules')
  rules(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    return this.automation.listRules(user, farmId);
  }

  @Post('farms/:farmId/rules')
  @ApiZodBody(ruleCreateSchema)
  createRule(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string, @Body(new ZodPipe(ruleCreateSchema)) body: RuleCreateInput) {
    return this.automation.createRule(user, farmId, body);
  }

  @Put('rules/:id')
  @ApiZodBody(ruleCreateSchema)
  updateRule(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ruleCreateSchema)) body: RuleCreateInput) {
    return this.automation.updateRule(user, id, body);
  }

  @Delete('rules/:id')
  removeRule(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.automation.removeRule(user, id);
  }

  // ── Comandos ──
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('actuators/:id/command')
  @ApiZodBody(commandSchema)
  command(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(commandSchema)) body: CommandInput) {
    return this.automation.issue(id, body, { source: 'MANUAL', user });
  }

  @Get('farms/:farmId/commands')
  commands(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    return this.automation.history(user, farmId);
  }

  // ── Endpoints para dispositivos (autenticação por credenciais do dispositivo) ──
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post('ingest')
  @HttpCode(202)
  @ApiHeader({ name: 'x-device-user' })
  @ApiHeader({ name: 'x-device-secret' })
  async ingest(@Headers('x-device-user') u: string, @Headers('x-device-secret') s: string, @Body() body: unknown) {
    const device = await this.iot.authenticateDevice(u, s);
    return this.iot.ingest(device, body);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('device/commands')
  async poll(@Headers('x-device-user') u: string, @Headers('x-device-secret') s: string) {
    const device = await this.iot.authenticateDevice(u, s);
    return this.automation.pendingFor(device.id);
  }

  @Public()
  @Get('device/config')
  async config(@Headers('x-device-user') u: string, @Headers('x-device-secret') s: string) {
    const device = await this.iot.authenticateDevice(u, s);
    return this.automation.buildConfig(device.id);
  }

  @Public()
  @Post('device/ack')
  @HttpCode(204)
  async ack(@Headers('x-device-user') u: string, @Headers('x-device-secret') s: string, @Body() body: { cmdId?: string; ok?: boolean; reason?: string }) {
    const device = await this.iot.authenticateDevice(u, s);
    if (body?.cmdId) await this.automation.ack(device.id, body.cmdId, !!body.ok, body.reason);
  }

  /** Webhooks de autenticação/ACL para o broker (EMQX HTTP auth). */
  @Public()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @Post('mqtt/auth')
  @HttpCode(200)
  async mqttAuth(@Body() body: { username?: string; password?: string }) {
    try {
      await this.iot.authenticateDevice(body.username, body.password);
      return { result: 'allow' };
    } catch {
      return { result: 'deny' };
    }
  }

  @Public()
  @Post('mqtt/acl')
  @HttpCode(200)
  mqttAcl(@Body() body: { username?: string; topic?: string; action?: 'publish' | 'subscribe' }) {
    const ok = !!body.username && !!body.topic && !!body.action && this.iot.aclAllows(body.username, body.topic, body.action);
    return { result: ok ? 'allow' : 'deny' };
  }
}
