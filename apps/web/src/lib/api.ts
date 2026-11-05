/**
 * Cliente HTTP da API.
 * - Token de acesso só em memória (nunca em localStorage → mitigação de XSS).
 * - Refresh token em cookie httpOnly; renovação automática e única em caso de 401.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export const session = {
  get token() {
    return accessToken;
  },
  set(token: string | null) {
    accessToken = token;
  },
  onLost(cb: () => void) {
    onSessionLost = cb;
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
  /** true quando o pedido falhou por falta de rede (candidato à fila offline) */
  get offline() {
    return this.status === 0;
  }
}

export async function refreshSession(): Promise<{ user: unknown; accessToken: string } | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    accessToken = data.accessToken;
    return data;
  } catch {
    return null;
  }
}

async function tryRefresh() {
  refreshing ??= refreshSession()
    .then((r) => !!r)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

type Opts = Omit<RequestInit, 'body'> & { body?: unknown; raw?: boolean };

export async function api<T = unknown>(path: string, opts: Opts = {}, retried = false): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.body !== undefined && !(opts.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...opts,
      headers,
      credentials: 'include',
      body: opts.body === undefined ? undefined : opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, 'Sem ligação ao servidor. Verifica a tua internet.');
  }

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return api<T>(path, opts, true);
    accessToken = null;
    onSessionLost?.();
  }
  if (!res.ok) {
    let body: { message?: string | string[]; errors?: { path: string; message: string }[] } = {};
    try {
      body = await res.json();
    } catch {
      /* corpo vazio */
    }
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(res.status, msg || `Erro ${res.status}`, body.errors);
  }
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}

/** Descarrega um ficheiro autenticado (ex.: relatórios PDF). */
export async function download(path: string, fallbackName: string) {
  const res = await api<Response>(path, { raw: true });
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
