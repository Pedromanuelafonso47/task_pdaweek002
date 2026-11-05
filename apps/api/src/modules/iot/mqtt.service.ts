import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt, { type MqttClient } from 'mqtt';

export type MqttHandler = (username: string, channel: 'telemetry' | 'status' | 'ack' | 'event', payload: string) => void | Promise<void>;

/**
 * Ponte MQTT. Tópicos: agrogenius/{deviceUsername}/{telemetry|status|ack|event|cmd|config}
 * Sem MQTT_URL configurado, a plataforma continua funcional via HTTP (/api/iot/ingest) e
 * os comandos ficam disponíveis para polling (/api/iot/device/commands).
 */
@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('MQTT');
  private client?: MqttClient;
  private handlers: MqttHandler[] = [];

  constructor(private readonly config: ConfigService) {}

  get configured() {
    return !!this.config.get<string>('MQTT_URL');
  }

  get connected() {
    return !!this.client?.connected;
  }

  onMessage(h: MqttHandler) {
    this.handlers.push(h);
  }

  onModuleInit() {
    const url = this.config.get<string>('MQTT_URL');
    if (!url) {
      this.logger.warn('MQTT_URL não configurado — IoT a funcionar apenas por HTTP (ver docs/IOT.md).');
      return;
    }
    this.client = mqtt.connect(url, {
      username: this.config.get('MQTT_USERNAME') || undefined,
      password: this.config.get('MQTT_PASSWORD') || undefined,
      clientId: `agrogenius-api-${process.pid}`,
      reconnectPeriod: 5000,
    });
    this.client.on('connect', () => {
      this.logger.log(`Ligado a ${url}`);
      this.client!.subscribe(['agrogenius/+/telemetry', 'agrogenius/+/status', 'agrogenius/+/ack', 'agrogenius/+/event'], { qos: 1 });
    });
    this.client.on('error', (e) => this.logger.error(e.message));
    this.client.on('message', (topic, buf) => {
      const [, username, channel] = topic.split('/');
      if (!username || !['telemetry', 'status', 'ack', 'event'].includes(channel)) return;
      for (const h of this.handlers) {
        Promise.resolve(h(username, channel as 'telemetry', buf.toString())).catch((e: Error) =>
          this.logger.warn(`Mensagem de ${username} rejeitada: ${e.message}`),
        );
      }
    });
  }

  publish(username: string, channel: 'cmd' | 'config', payload: unknown, retain = false): boolean {
    if (!this.client?.connected) return false;
    this.client.publish(`agrogenius/${username}/${channel}`, JSON.stringify(payload), { qos: 1, retain });
    return true;
  }

  async onModuleDestroy() {
    await this.client?.endAsync();
  }
}
