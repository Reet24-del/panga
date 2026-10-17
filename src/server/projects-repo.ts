// The freelancer's library of past projects, stored in Tiger Data (Postgres
// with pgvector). Search is hybrid: vector similarity when embeddings are
// configured, plus Postgres full-text ranking on the same rows.

import { newId } from '@/lib/ids';
import type { Currency, PastProject, SimilarProject } from '@/lib/types';
import { getDb, toIso, toNumberOrNull, vectorLiteral } from './db';
import { embed } from './embeddings';

interface ProjectRow {
  id: string;
  title: string;
  summary: string;
  requirements: string;
  estimated_hours: number | null;
  actual_hours: number | null;
  quoted_price: number | null;
  currency: string | null;
  lesson: string;
  deal_id: string | null;
  created_at: unknown;
}

function toProject(r: ProjectRow): PastProject {
  return {
    id: r.id,
    title: r.title,
    summary: r.summary,
    requirements: r.requirements,
    estimatedHours: toNumberOrNull(r.estimated_hours),
    actualHours: toNumberOrNull(r.actual_hours),
    quotedPrice: toNumberOrNull(r.quoted_price),
    currency: (r.currency as Currency | null) ?? null,
    lesson: r.lesson,
    dealId: r.deal_id,
    createdAt: toIso(r.created_at),
  };
}

export interface NewProject {
  title: string;
  summary: string;
  requirements: string;
  estimatedHours: number | null;
  actualHours: number | null;
  quotedPrice: number | null;
  currency: Currency | null;
  lesson: string;
  dealId?: string | null;
}

export function projectText(p: Pick<NewProject, 'title' | 'summary' | 'requirements' | 'lesson'>): string {
  return [p.title, p.summary, p.requirements, p.lesson].filter(Boolean).join('\n');
}

export async function addProject(workspaceId: string, p: NewProject): Promise<PastProject> {
  const db = await getDb();
  const vectors = await embed([projectText(p)]);
  const id = newId('p');
  const { rows } = await db.query<ProjectRow>(
    `INSERT INTO past_projects (id, workspace_id, deal_id, title, summary, requirements, estimated_hours, actual_hours, quoted_price, currency, lesson, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector)
     ON CONFLICT (id) DO NOTHING
     RETURNING id, title, summary, requirements, estimated_hours, actual_hours, quoted_price, currency, lesson, deal_id, created_at`,
    [
      id,
      workspaceId,
      p.dealId ?? null,
      p.title.slice(0, 200),
      p.summary.slice(0, 2000),
      p.requirements.slice(0, 4000),
      p.estimatedHours,
      p.actualHours,
      p.quotedPrice,
      p.currency,
      p.lesson.slice(0, 2000),
      vectors ? vectorLiteral(vectors[0]) : null,
    ],
  );
  return toProject(rows[0]);
}

/** Replaces the past project made from a deal (re-recording an outcome). */
export async function upsertProjectForDeal(workspaceId: string, dealId: string, p: NewProject): Promise<PastProject> {
  const db = await getDb();
  await db.query('DELETE FROM past_projects WHERE workspace_id = $1 AND deal_id = $2', [workspaceId, dealId]);
  return addProject(workspaceId, { ...p, dealId });
}

export async function listProjects(workspaceId: string): Promise<PastProject[]> {
  const db = await getDb();
  const { rows } = await db.query<ProjectRow>(
    `SELECT id, title, summary, requirements, estimated_hours, actual_hours, quoted_price, currency, lesson, deal_id, created_at
     FROM past_projects WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [workspaceId],
  );
  return rows.map(toProject);
}

export async function deleteProject(workspaceId: string, id: string): Promise<boolean> {
  const db = await getDb();
  const { rows } = await db.query<{ id: string }>('DELETE FROM past_projects WHERE workspace_id = $1 AND id = $2 RETURNING id', [workspaceId, id]);
  return rows.length > 0;
}

const STOPWORDS = new Set(
  'the and for with from that this your have will what when also only just like need needs want site store online simple page pages work items more into them they their'.split(' '),
);

/** Builds an OR full-text query from the most distinctive words. */
export function keywordQuery(text: string): string {
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, 24).join(' | ');
}

export async function findSimilarProjects(workspaceId: string, text: string, limit = 3, excludeDealId?: string): Promise<SimilarProject[]> {
  const db = await getDb();
  const vectors = await embed([text]);
  const vector = vectors ? vectorLiteral(vectors[0]) : null;
  const tsQuery = keywordQuery(text) || 'zzzznomatch';
  const { rows } = await db.query<ProjectRow & { score: number }>(
    `WITH q AS (SELECT $2::vector AS v, to_tsquery('simple', $3) AS tq)
     SELECT p.id, p.title, p.summary, p.requirements, p.estimated_hours, p.actual_hours, p.quoted_price, p.currency, p.lesson, p.deal_id, p.created_at,
       (CASE WHEN q.v IS NOT NULL AND p.embedding IS NOT NULL AND vector_dims(p.embedding) = vector_dims(q.v)
             THEN 0.7 * (1 - (p.embedding <=> q.v)) ELSE 0 END)
       + 0.3 * LEAST(ts_rank(p.search, q.tq) * 10, 1) AS score
     FROM past_projects p, q
     WHERE p.workspace_id = $1 AND ($5::text IS NULL OR p.deal_id IS DISTINCT FROM $5)
     ORDER BY score DESC, p.created_at DESC
     LIMIT $4`,
    [workspaceId, vector, tsQuery, limit * 2, excludeDealId ?? null],
  );
  return rows
    .filter((r) => Number(r.score) > 0.05)
    .slice(0, limit)
    .map((r) => {
      const p = toProject(r);
      return {
        id: p.id,
        title: p.title,
        summary: p.summary,
        estimatedHours: p.estimatedHours,
        actualHours: p.actualHours,
        lesson: p.lesson,
        score: Math.round(Number(r.score) * 100) / 100,
      };
    });
}
