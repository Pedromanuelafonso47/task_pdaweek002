import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AuthUser } from '../../common/auth.decorators';
import { FarmAccessService } from '../access/farm-access.service';

/**
 * Atualizações em tempo real. O cliente autentica-se com o JWT de acesso no handshake
 * e entra automaticamente na sala `user:{id}`; pede para seguir uma propriedade com `farm:join`
 * (acesso verificado pelo FarmAccessService).
 */
@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger('Realtime');

  constructor(
    private readonly jwt: JwtService,
    private readonly access: FarmAccessService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('sem token');
      const p = await this.jwt.verifyAsync(token);
      if (p.typ !== 'access') throw new Error('tipo inválido');
      const user: AuthUser = { id: p.sub, email: p.email, role: p.role, organizationId: p.org };
      client.data.user = user;
      await client.join(`user:${user.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('farm:join')
  async joinFarm(client: Socket, farmId: string) {
    const user = client.data.user as AuthUser | undefined;
    if (!user || typeof farmId !== 'string') return { ok: false };
    try {
      await this.access.assert(user, farmId);
      await client.join(`farm:${farmId}`);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  @SubscribeMessage('farm:leave')
  async leaveFarm(client: Socket, farmId: string) {
    await client.leave(`farm:${farmId}`);
    return { ok: true };
  }

  toFarm(farmId: string, event: string, payload: unknown) {
    this.server?.to(`farm:${farmId}`).emit(event, payload);
  }

  toUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
