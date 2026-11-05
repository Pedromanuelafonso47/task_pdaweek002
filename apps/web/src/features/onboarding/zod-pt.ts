import { z } from 'zod';

/** Mensagens de validação genéricas do Zod em português (as específicas vêm dos schemas partilhados). */
try {
  z.config(z.locales.pt());
} catch {
  /* locale indisponível: mantém as mensagens por omissão */
}

/** Converte valores de <input type="number"> vazios em undefined (em vez de NaN). */
export const num = (v: unknown) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v));
export const numOrNull = (v: unknown) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
