// Browser-side helpers: the private workspace key and JSON calls to the API.

const KEY = 'panga:workspace';
let fallbackKey: string | null = null;

function freshKey(): string {
  return `ws_${globalThis.crypto.randomUUID().replace(/-/g, '')}`;
}

export function isWorkspaceKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,80}$/.test(value);
}

/** This browser's private key. Deal files are visible only to the browser holding it. */
export function workspaceKey(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && isWorkspaceKey(existing)) return existing;
    const created = freshKey();
    localStorage.setItem(KEY, created);
    return created;
  } catch {
    fallbackKey ??= freshKey();
    return fallbackKey;
  }
}

export function setWorkspaceKey(next: string): boolean {
  if (!isWorkspaceKey(next)) return false;
  try {
    localStorage.setItem(KEY, next);
    return true;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Options {
  method?: string;
  body?: unknown;
  form?: FormData;
  keepalive?: boolean;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { 'x-panga-workspace': workspaceKey() };
  let body: BodyInit | undefined;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
      cache: 'no-store',
      keepalive: options.keepalive,
    });
  } catch {
    throw new ApiError("Couldn't reach Panga. Check your connection and try again.", 0, 'network');
  }
  const data = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status, data?.code ?? 'error');
  return data as T;
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}
