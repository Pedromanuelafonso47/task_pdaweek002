import { BadRequestException, PipeTransform, applyDecorators } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { z } from 'zod';

/** Valida e transforma o corpo do pedido com um schema Zod partilhado (@agrogenius/shared). */
export class ZodPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.infer<T> {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      throw new BadRequestException({
        message: 'Dados inválidos',
        errors: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return r.data;
  }
}

/** Documenta o corpo no Swagger a partir do mesmo schema Zod — uma única fonte de verdade. */
export function ApiZodBody(schema: z.ZodType) {
  let jsonSchema: Record<string, unknown> = { type: 'object' };
  try {
    jsonSchema = z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' }) as Record<string, unknown>;
    delete jsonSchema.$schema;
  } catch {
    /* schemas não representáveis: documentação genérica */
  }
  return applyDecorators(ApiBody({ schema: jsonSchema as never }));
}
