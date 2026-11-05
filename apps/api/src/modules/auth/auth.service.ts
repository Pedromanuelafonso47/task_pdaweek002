import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { LoginInput, RegisterInput } from '@agrogenius/shared';
import type { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  publicUser(u: User) {
    const { passwordHash: _ignored, ...rest } = u;
    return rest;
  }

  async register(input: RegisterInput, meta: SessionMeta) {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ConflictException('Já existe uma conta com este email');
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    // Cada agricultor começa com a sua própria organização (tenant); cooperativas podem agregar mais tarde.
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        role: 'FARMER',
        organization: { create: { name: input.fullName, type: 'INDIVIDUAL' } },
      },
    });
    return this.issueSession(user, meta);
  }

  async login(input: LoginInput, meta: SessionMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Mesmo erro para email inexistente e palavra-passe errada (não revela contas).
    const valid = user && user.isActive && (await argon2.verify(user.passwordHash, input.password));
    if (!user || !valid) throw new UnauthorizedException('Email ou palavra-passe incorretos');
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueSession(user, meta);
  }

  /** Rotação: cada refresh token só pode ser usado uma vez. Reutilização ⇒ revoga a família inteira. */
  async refresh(rawToken: string | undefined, meta: SessionMeta) {
    if (!rawToken) throw new UnauthorizedException('Sessão em falta');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) }, include: { user: true } });
    if (!stored) throw new UnauthorizedException('Sessão inválida');
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sessão revogada por motivos de segurança. Inicia sessão novamente.');
    }
    if (stored.expiresAt < new Date() || !stored.user.isActive) throw new UnauthorizedException('Sessão expirada');
    const session = await this.issueSession(stored.user, meta, stored.familyId);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: session.refreshTokenId },
    });
    return session;
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { organization: true } });
    return this.publicUser(user);
  }

  private async issueSession(user: User, meta: SessionMeta, familyId: string = randomUUID()) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, org: user.organizationId, typ: 'access' },
      { expiresIn: this.config.get('JWT_ACCESS_TTL', '15m') },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const days = Number(this.config.get('REFRESH_TTL_DAYS', 30));
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    const rt = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        familyId,
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 255),
        ip: meta.ip,
      },
    });
    return { user: this.publicUser(user), accessToken, refreshToken, refreshTokenId: rt.id, refreshExpiresAt: expiresAt };
  }
}
