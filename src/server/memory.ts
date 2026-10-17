// What Panga remembers about the freelancer: minimum rate, currency, tone,
// work they never include, and corrections they made to extracted scopes.
// Stored in Backboard (one assistant per workspace) when BACKBOARD_API_KEY is
// set, otherwise in the local database. Memory failures never block a deal.

import { formatMoney } from '@/lib/format';
import { newId } from '@/lib/ids';
import { CURRENCIES, type Currency, type MemoryItem, type Preferences, type Tone } from '@/lib/types';
import { getDb, toIso } from './db';
import { env } from './env';
import { report } from './report';

interface Stored {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string | null;
}

interface Backend {
  kind: 'backboard' | 'local';
  list(ws: string): Promise<Stored[]>;
  add(ws: string, content: string, metadata: Record<string, unknown>): Promise<void>;
  search(ws: string, query: string, limit: number): Promise<Stored[]>;
  remove(ws: string, id: string): Promise<void>;
}

// ---------- Backboard ----------

async function bb<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${env.backboardBaseUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers: { 'X-API-Key': env.backboardKey, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Backboard ${method} ${path} failed with ${res.status}: ${(await res.text()).slice(0, 200)}`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// Concurrent requests from one browser share a single creation call.
const creating = new Map<string, Promise<string>>();

function assistantFor(ws: string): Promise<string> {
  let pending = creating.get(ws);
  if (!pending) {
    pending = findOrCreateAssistant(ws).finally(() => creating.delete(ws));
    creating.set(ws, pending);
  }
  return pending;
}

async function findOrCreateAssistant(ws: string): Promise<string> {
  const db = await getDb();
  await db.query('INSERT INTO workspaces (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [ws]);
  const current = await db.query<{ backboard_assistant_id: string | null }>('SELECT backboard_assistant_id FROM workspaces WHERE id = $1', [ws]);
  if (current.rows[0]?.backboard_assistant_id) return current.rows[0].backboard_assistant_id;
  const created = await bb<{ assistant_id: string }>('POST', '/assistants', {
    name: `Panga workspace ${ws.slice(-8)}`,
    system_prompt: "Remembers one freelancer's quoting preferences and the corrections they make to Panga's scope extraction.",
  });
  const claimed = await db.query<{ backboard_assistant_id: string }>(
    'UPDATE workspaces SET backboard_assistant_id = $2 WHERE id = $1 AND backboard_assistant_id IS NULL RETURNING backboard_assistant_id',
    [ws, created.assistant_id],
  );
  if (claimed.rows.length) return created.assistant_id;
  // Another request won the race; use its assistant.
  const again = await db.query<{ backboard_assistant_id: string }>('SELECT backboard_assistant_id FROM workspaces WHERE id = $1', [ws]);
  return again.rows[0].backboard_assistant_id;
}

interface BbMemory {
  id: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}

const backboard: Backend = {
  kind: 'backboard',
  async list(ws) {
    const id = await assistantFor(ws);
    const body = await bb<{ memories?: BbMemory[] }>('GET', `/assistants/${id}/memories?page=1&page_size=100`);
    return (body.memories ?? []).map((m) => ({ id: m.id, content: m.content, metadata: m.metadata ?? {}, createdAt: m.created_at ?? null }));
  },
  async add(ws, content, metadata) {
    const id = await assistantFor(ws);
    await bb('POST', `/assistants/${id}/memories`, { content, metadata });
  },
  async search(ws, query, limit) {
    const id = await assistantFor(ws);
    const body = await bb<{ memories?: BbMemory[] }>('POST', `/assistants/${id}/memories/search`, { query: query.slice(0, 1000), limit });
    return (body.memories ?? []).map((m) => ({ id: m.id, content: m.content, metadata: m.metadata ?? {}, createdAt: m.created_at ?? null }));
  },
  async remove(ws, memoryId) {
    const id = await assistantFor(ws);
    await bb('DELETE', `/assistants/${id}/memories/${encodeURIComponent(memoryId)}`);
  },
};

// ---------- Local fallback ----------

const local: Backend = {
  kind: 'local',
  async list(ws) {
    const db = await getDb();
    const { rows } = await db.query<{ id: string; content: string; metadata: Record<string, unknown>; created_at: unknown }>(
      'SELECT id, content, metadata, created_at FROM memories WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 200',
      [ws],
    );
    return rows.map((r) => ({ id: r.id, content: r.content, metadata: r.metadata ?? {}, createdAt: toIso(r.created_at) }));
  },
  async add(ws, content, metadata) {
    const db = await getDb();
    await db.query('INSERT INTO memories (id, workspace_id, kind, content, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)', [
      newId('m'),
      ws,
      String(metadata.kind ?? 'note'),
      content,
      JSON.stringify(metadata),
    ]);
  },
  async search(ws, query, limit) {
    const words = new Set(query.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    const all = await local.list(ws);
    return all
      .map((m) => ({ m, score: m.content.toLowerCase().split(/\W+/).filter((w) => words.has(w)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.m);
  },
  async remove(ws, id) {
    const db = await getDb();
    await db.query('DELETE FROM memories WHERE workspace_id = $1 AND id = $2', [ws, id]);
  },
};

function backend(): Backend {
  return env.backboardKey ? backboard : local;
}

export function memoryBackend(): 'backboard' | 'local' {
  return backend().kind;
}

// ---------- Preferences ----------

const TONES: Tone[] = ['english_friendly', 'english_formal', 'hinglish_friendly'];
export const TONE_LABEL: Record<Tone, string> = {
  english_friendly: 'English, friendly',
  english_formal: 'English, formal',
  hinglish_friendly: 'Hinglish, friendly',
};

export const DEFAULT_PREFERENCES: Preferences = { minimumRate: null, currency: 'INR', tone: 'english_friendly', neverInclude: [] };

type PrefKey = 'minimum_rate' | 'currency' | 'tone' | 'never_include';

function kindOf(m: Stored): MemoryItem['kind'] {
  const k = m.metadata.kind;
  return k === 'preference' || k === 'correction' ? k : 'note';
}

function prefsFrom(memories: Stored[]): Preferences {
  const latest = new Map<PrefKey, Stored>();
  for (const m of memories) {
    if (m.metadata.kind !== 'preference') continue;
    const key = m.metadata.key as PrefKey;
    const prev = latest.get(key);
    if (!prev || (m.createdAt ?? '') > (prev.createdAt ?? '')) latest.set(key, m);
  }
  const value = (k: PrefKey) => latest.get(k)?.metadata.value;
  const rate = Number(value('minimum_rate'));
  const currency = value('currency') as Currency;
  const tone = value('tone') as Tone;
  const never = value('never_include');
  return {
    minimumRate: Number.isFinite(rate) && rate > 0 ? rate : null,
    currency: CURRENCIES.includes(currency) ? currency : DEFAULT_PREFERENCES.currency,
    tone: TONES.includes(tone) ? tone : DEFAULT_PREFERENCES.tone,
    neverInclude: Array.isArray(never) ? never.filter((x): x is string => typeof x === 'string').slice(0, 20) : [],
  };
}

export interface MemoryView {
  backend: 'backboard' | 'local';
  preferences: Preferences;
  memories: MemoryItem[];
  error: string | null;
}

export async function loadMemory(ws: string): Promise<MemoryView> {
  const b = backend();
  try {
    const all = await b.list(ws);
    return {
      backend: b.kind,
      preferences: prefsFrom(all),
      memories: all.map((m) => ({ id: m.id, content: m.content, kind: kindOf(m), createdAt: m.createdAt })),
      error: null,
    };
  } catch (err) {
    report(err, { step: 'memory.list' });
    return { backend: b.kind, preferences: DEFAULT_PREFERENCES, memories: [], error: 'Could not reach the memory service.' };
  }
}

export async function getPreferences(ws: string): Promise<Preferences> {
  return (await loadMemory(ws)).preferences;
}

function describe(key: PrefKey, p: Preferences): string {
  switch (key) {
    case 'minimum_rate':
      return `Minimum hourly rate: ${formatMoney(p.minimumRate ?? 0, p.currency)}/h.`;
    case 'currency':
      return `Quotes in ${p.currency}.`;
    case 'tone':
      return `Prefers replies in ${TONE_LABEL[p.tone]}.`;
    case 'never_include':
      return p.neverInclude.length ? `Never includes: ${p.neverInclude.join(', ')}.` : 'No standing exclusions.';
  }
}

export async function savePreferences(ws: string, next: Preferences): Promise<MemoryView> {
  const b = backend();
  const all = await b.list(ws);
  const current = prefsFrom(all);
  const values: Record<PrefKey, unknown> = {
    minimum_rate: next.minimumRate,
    currency: next.currency,
    tone: next.tone,
    never_include: next.neverInclude,
  };
  const before: Record<PrefKey, unknown> = {
    minimum_rate: current.minimumRate,
    currency: current.currency,
    tone: current.tone,
    never_include: current.neverInclude,
  };
  for (const key of Object.keys(values) as PrefKey[]) {
    if (JSON.stringify(values[key]) === JSON.stringify(before[key])) continue;
    if (key === 'minimum_rate' && next.minimumRate == null) continue;
    for (const old of all.filter((m) => m.metadata.kind === 'preference' && m.metadata.key === key)) {
      await b.remove(ws, old.id).catch((err) => report(err, { step: 'memory.remove' }));
    }
    await b.add(ws, describe(key, next), { kind: 'preference', key, value: values[key] });
  }
  return loadMemory(ws);
}

/** Saves the freelancer's corrections to an extracted scope, skipping ones already known. */
export async function rememberCorrections(ws: string, notes: string[]): Promise<number> {
  if (!notes.length) return 0;
  const b = backend();
  try {
    const known = new Set((await b.list(ws)).map((m) => m.content.trim().toLowerCase()));
    let saved = 0;
    for (const note of notes.slice(0, 8)) {
      const key = note.trim().toLowerCase();
      if (known.has(key)) continue;
      await b.add(ws, note, { kind: 'correction' });
      known.add(key);
      saved++;
    }
    return saved;
  } catch (err) {
    report(err, { step: 'memory.corrections' });
    return 0;
  }
}

/** Notes worth giving the scope analyst for this brief. */
export async function recallForBrief(ws: string, briefText: string): Promise<string[]> {
  const b = backend();
  try {
    const [prefs, relevant] = await Promise.all([getPreferences(ws), b.search(ws, briefText.slice(0, 1000), 6)]);
    const lines = relevant.filter((m) => m.metadata.kind !== 'preference').map((m) => m.content);
    if (prefs.neverInclude.length) lines.unshift(`The freelancer never includes: ${prefs.neverInclude.join(', ')}. Still list such work if the client asks for it, so it can be excluded explicitly.`);
    return [...new Set(lines)].slice(0, 8);
  } catch (err) {
    report(err, { step: 'memory.recall' });
    return [];
  }
}

export async function forgetMemory(ws: string, id: string): Promise<void> {
  await backend().remove(ws, id);
}
