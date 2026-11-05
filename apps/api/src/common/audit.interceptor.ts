import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth.decorators';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SKIP = [/^\/api\/auth\/(refresh|logout|login)/, /^\/api\/iot\/ingest/, /^\/api\/ai\//];

/** Regista mutações bem-sucedidas em AuditLog (sem guardar o corpo do pedido). */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest();
    if (!MUTATIONS.has(req.method) || SKIP.some((r) => r.test(req.originalUrl))) return next.handle();
    const route: string = req.route?.path ?? req.originalUrl;
    const entity = route.replace(/^\/api\//, '').split('/')[0] || 'unknown';

    return next.handle().pipe(
      tap((result: unknown) => {
        const user: AuthUser | undefined = req.user;
        const resultId =
          result && typeof result === 'object' && 'id' in result ? String((result as { id: unknown }).id) : undefined;
        this.prisma.auditLog
          .create({
            data: {
              userId: user?.id,
              organizationId: user?.organizationId,
              action: `${req.method} ${route}`,
              entity,
              entityId: req.params?.id ?? resultId,
              ip: req.ip,
            },
          })
          .catch((e: Error) => this.logger.warn(`Falha a registar auditoria: ${e.message}`));
      }),
    );
  }
}
