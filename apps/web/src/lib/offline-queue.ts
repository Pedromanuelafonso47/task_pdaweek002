'use client';
/**
 * Fila offline para operações essenciais (atividades, colheitas, despesas).
 * Cada operação leva um `clientId` (UUID) que a API usa como chave de idempotência:
 * reenviar a mesma operação nunca cria duplicados.
 */
import { get, set } from 'idb-keyval';
import { api, ApiError } from './api';

export interface QueuedOp {
  id: string;
  path: string;
  method: 'POST' | 'PATCH';
  body: Record<string, unknown> & { clientId: string };
  label: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const KEY = 'agrogenius-offline-queue';
const listeners = new Set<(q: QueuedOp[]) => void>();

async function read(): Promise<QueuedOp[]> {
  try {
    return (await get<QueuedOp[]>(KEY)) ?? [];
  } catch {
    return [];
  }
}
async function write(q: QueuedOp[]) {
  try {
    await set(KEY, q);
  } catch {
    /* IndexedDB indisponível (modo privado) */
  }
  listeners.forEach((l) => l(q));
}

export const offlineQueue = {
  read,
  subscribe(cb: (q: QueuedOp[]) => void) {
    listeners.add(cb);
    read().then(cb);
    return () => listeners.delete(cb);
  },

  /** Tenta enviar já; se não houver rede, guarda para sincronizar depois. */
  async submit<T>(op: Omit<QueuedOp, 'id' | 'createdAt' | 'attempts'>): Promise<{ queued: boolean; result?: T }> {
    try {
      const result = await api<T>(op.path, { method: op.method, body: op.body });
      return { queued: false, result };
    } catch (e) {
      if (e instanceof ApiError && e.offline) {
        const q = await read();
        q.push({ ...op, id: op.body.clientId, createdAt: Date.now(), attempts: 0 });
        await write(q);
        return { queued: true };
      }
      throw e;
    }
  },

  async flush(): Promise<{ sent: number; failed: number }> {
    const q = await read();
    if (!q.length) return { sent: 0, failed: 0 };
    const remaining: QueuedOp[] = [];
    let sent = 0;
    for (const op of q) {
      try {
        await api(op.path, { method: op.method, body: op.body });
        sent++;
      } catch (e) {
        const err = e as ApiError;
        // erros de validação (4xx) não melhoram com novas tentativas: mantém para o utilizador rever
        remaining.push({ ...op, attempts: op.attempts + 1, lastError: err.message });
        if (err.offline) {
          remaining.push(...q.slice(q.indexOf(op) + 1));
          break;
        }
      }
    }
    await write(remaining);
    return { sent, failed: remaining.length };
  },

  async discard(id: string) {
    await write((await read()).filter((o) => o.id !== id));
  },
};
