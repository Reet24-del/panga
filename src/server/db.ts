// One database interface over two engines: Tiger Data (Postgres + pgvector)
// in production, and PGlite (Postgres compiled to WASM) for local use. The
// SQL is identical, so local runs exercise the same queries.

import { env } from './env';

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface Db extends Queryable {
  kind: 'postgres' | 'pglite';
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const MIGRATION = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS workspaces (
  id text PRIMARY KEY,
  backboard_assistant_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deals (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  title text NOT NULL,
  stage text NOT NULL,
  currency text NOT NULL,
  offered_price double precision,
  decision text,
  workflow_id text,
  doc jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deals_workspace_idx ON deals (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS past_projects (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  deal_id text,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  requirements text NOT NULL DEFAULT '',
  estimated_hours double precision,
  actual_hours double precision,
  quoted_price double precision,
  currency text,
  lesson text NOT NULL DEFAULT '',
  embedding vector,
  search tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', title || ' ' || summary || ' ' || requirements || ' ' || lesson)
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS past_projects_workspace_idx ON past_projects (workspace_id);
CREATE INDEX IF NOT EXISTS past_projects_search_idx ON past_projects USING gin (search);

CREATE TABLE IF NOT EXISTS memories (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  kind text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_workspace_idx ON memories (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sim_calls (
  token text PRIMARY KEY,
  deal_id text NOT NULL,
  rehearsal_id text NOT NULL,
  expires_at timestamptz NOT NULL
);
`;

async function connectPostgres(url: string): Promise<Db> {
  const pg = await import('pg');
  const Pool = (pg.default ?? pg).Pool;
  const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  pool.on('error', (err: Error) => console.error('[db] idle client error:', err.message));
  const run = (client: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }) =>
    (<T>(sql: string, params?: unknown[]) => client.query(sql, params) as Promise<{ rows: T[] }>) as Queryable['query'];
  return {
    kind: 'postgres',
    query: run(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: run(client) });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function connectPglite(dir: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { vector } = await import('@electric-sql/pglite-pgvector');
  let db: InstanceType<typeof PGlite>;
  if (dir === 'memory') {
    db = await PGlite.create({ extensions: { vector } });
  } else {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(dir, { recursive: true });
    db = await PGlite.create(`${dir}/pglite`, { extensions: { vector } });
  }
  const run = (q: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }) =>
    (<T>(sql: string, params?: unknown[]) => q.query(sql, params) as Promise<{ rows: T[] }>) as Queryable['query'];
  return {
    kind: 'pglite',
    query: run(db),
    transaction: (fn) => db.transaction((tx) => fn({ query: run(tx) })),
    close: () => db.close(),
  };
}

async function migrate(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    // Web app and worker may start together; serialize their migrations.
    if (db.kind === 'postgres') await tx.query('SELECT pg_advisory_xact_lock(724100)');
    for (const statement of MIGRATION.split(';').map((s) => s.trim()).filter(Boolean)) {
      await tx.query(statement);
    }
  });
}

const holder = globalThis as unknown as { __pangaDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!holder.__pangaDb) {
    holder.__pangaDb = (async () => {
      const db = env.databaseUrl ? await connectPostgres(env.databaseUrl) : await connectPglite(env.dataDir);
      await migrate(db);
      return db;
    })().catch((err) => {
      holder.__pangaDb = undefined;
      throw err;
    });
  }
  return holder.__pangaDb;
}

/** For tests: drop the cached connection. */
export async function resetDb(): Promise<void> {
  const current = holder.__pangaDb;
  holder.__pangaDb = undefined;
  if (current) await (await current).close().catch(() => undefined);
}

export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return new Date().toISOString();
}

export function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** pgvector literal for a JS array. */
export function vectorLiteral(values: number[]): string {
  return `[${values.map((v) => (Number.isFinite(v) ? v : 0)).join(',')}]`;
}
