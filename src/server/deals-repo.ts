// Deals are stored as one JSON document each, with the fields used for
// listing and ownership checks copied into columns.

import type { Deal, DealSummary } from '@/lib/types';
import { getDb, toIso, type Queryable } from './db';
import { HttpError } from './errors';

interface DealRow {
  doc: Deal;
}

function columns(deal: Deal): unknown[] {
  return [
    deal.id,
    deal.workspaceId,
    deal.title,
    deal.stage,
    deal.currency,
    deal.offeredPrice,
    deal.decision?.approvedAt ? deal.decision.choice : null,
    deal.workflowId,
    JSON.stringify(deal),
    deal.createdAt,
    deal.updatedAt,
  ];
}

export async function insertDeal(deal: Deal): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO deals (id, workspace_id, title, stage, currency, offered_price, decision, workflow_id, doc, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
    columns(deal),
  );
}

export async function getDeal(id: string): Promise<Deal | null> {
  const db = await getDb();
  const { rows } = await db.query<DealRow>('SELECT doc FROM deals WHERE id = $1', [id]);
  return rows[0]?.doc ?? null;
}

/** Loads a deal and checks it belongs to the caller's workspace. */
export async function getOwnedDeal(id: string, workspaceId: string): Promise<Deal> {
  const deal = await getDeal(id);
  if (!deal || deal.workspaceId !== workspaceId) throw new HttpError(404, 'This deal file does not exist or belongs to another browser.', 'not_found');
  return deal;
}

async function write(tx: Queryable, deal: Deal): Promise<void> {
  const [id, workspaceId, title, stage, currency, price, decision, workflowId, doc, , updatedAt] = columns(deal);
  await tx.query(
    `UPDATE deals SET title = $3, stage = $4, currency = $5, offered_price = $6, decision = $7, workflow_id = $8, doc = $9::jsonb, updated_at = $10
     WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId, title, stage, currency, price, decision, workflowId, doc, updatedAt],
  );
}

/**
 * Read-modify-write under a row lock, so the web app and the worker can both
 * update a deal (for example, a replay finishing while the freelancer edits scope).
 */
export async function updateDeal(id: string, mutate: (deal: Deal) => void | Promise<void>): Promise<Deal> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const { rows } = await tx.query<DealRow>('SELECT doc FROM deals WHERE id = $1 FOR UPDATE', [id]);
    const deal = rows[0]?.doc;
    if (!deal) throw new HttpError(404, 'Deal not found.', 'not_found');
    await mutate(deal);
    deal.updatedAt = new Date().toISOString();
    await write(tx, deal);
    return deal;
  });
}

export async function listDeals(workspaceId: string): Promise<DealSummary[]> {
  const db = await getDb();
  const { rows } = await db.query<{
    id: string;
    title: string;
    stage: DealSummary['stage'];
    currency: DealSummary['currency'];
    offered_price: number | null;
    decision: DealSummary['decision'];
    updated_at: unknown;
  }>(
    `SELECT id, title, stage, currency, offered_price, decision, updated_at
     FROM deals WHERE workspace_id = $1 ORDER BY updated_at DESC LIMIT 100`,
    [workspaceId],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    stage: r.stage,
    currency: r.currency,
    offeredPrice: r.offered_price,
    decision: r.decision,
    updatedAt: toIso(r.updated_at),
  }));
}

/** Deletes the deal, its rehearsal call tokens and the past project made from it. */
export async function deleteDeal(id: string, workspaceId: string): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const { rows } = await tx.query<{ id: string }>('DELETE FROM deals WHERE id = $1 AND workspace_id = $2 RETURNING id', [id, workspaceId]);
    if (!rows.length) return false;
    await tx.query('DELETE FROM sim_calls WHERE deal_id = $1', [id]);
    await tx.query('DELETE FROM past_projects WHERE deal_id = $1 AND workspace_id = $2', [id, workspaceId]);
    return true;
  });
}

// Rehearsal call tokens: ElevenLabs calls Panga's simulated-client endpoint
// with a token that maps back to one deal and one rehearsal.

export async function createSimCall(token: string, dealId: string, rehearsalId: string, ttlMinutes = 60): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM sim_calls WHERE expires_at < now()");
  await db.query(
    `INSERT INTO sim_calls (token, deal_id, rehearsal_id, expires_at) VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [token, dealId, rehearsalId, String(ttlMinutes)],
  );
}

export async function resolveSimCall(token: string): Promise<{ dealId: string; rehearsalId: string } | null> {
  const db = await getDb();
  const { rows } = await db.query<{ deal_id: string; rehearsal_id: string }>(
    'SELECT deal_id, rehearsal_id FROM sim_calls WHERE token = $1 AND expires_at > now()',
    [token],
  );
  return rows[0] ? { dealId: rows[0].deal_id, rehearsalId: rows[0].rehearsal_id } : null;
}
