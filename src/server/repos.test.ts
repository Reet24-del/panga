// Runs the real SQL against an in-memory Postgres (PGlite with pgvector).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDb, resetDb, withLibpqSsl } from './db';
import { createSimCall, deleteDeal, getOwnedDeal, insertDeal, listDeals, resolveSimCall, updateDeal } from './deals-repo';
import { DEFAULT_PREFERENCES, loadMemory, recallForBrief, rememberCorrections, savePreferences } from './memory';
import { newDeal } from './pipeline';
import { addProject, findSimilarProjects, keywordQuery, listProjects, upsertProjectForDeal } from './projects-repo';

const WS = 'ws_repo_test_0001';
const OTHER = 'ws_repo_test_0002';

beforeAll(async () => {
  process.env.PANGA_DATA_DIR = 'memory';
  delete process.env.DATABASE_URL;
  delete process.env.BACKBOARD_API_KEY;
  delete process.env.DO_MODEL_ACCESS_KEY;
  await resetDb();
});

afterAll(async () => {
  await resetDb();
});

function deal(title = 'Bakery website') {
  return newDeal({ workspaceId: WS, title, currency: 'INR', offeredPrice: 20000, minimumRate: 800, sources: [{ kind: 'brief', label: '', text: 'We need a bakery website with online orders.' }] });
}

describe('postgres urls', () => {
  it('reads sslmode=require the libpq way, so private CAs like Tiger Cloud connect', () => {
    const url = 'postgres://tsdbadmin:p%40ss@abc.tsdb.cloud.timescale.com:31234/tsdb?sslmode=require';
    const out = new URL(withLibpqSsl(url));
    expect(out.searchParams.get('uselibpqcompat')).toBe('true');
    expect(out.searchParams.get('sslmode')).toBe('require');
    expect(out.password).toBe('p%40ss');
  });

  it('leaves stricter or already-explicit URLs alone', () => {
    for (const url of [
      'postgres://u:p@h:5432/db?sslmode=verify-full',
      'postgres://u:p@h:5432/db?sslmode=require&uselibpqcompat=false',
      'postgres://u:p@h:5432/db',
      'not a url',
    ]) {
      expect(withLibpqSsl(url)).toBe(url);
    }
  });
});

describe('deals', () => {
  it('stores, scopes to the workspace, updates and lists', async () => {
    const d = deal();
    await insertDeal(d);
    expect((await getOwnedDeal(d.id, WS)).title).toBe('Bakery website');
    await expect(getOwnedDeal(d.id, OTHER)).rejects.toThrow(/belongs to another browser/);

    const updated = await updateDeal(d.id, (x) => {
      x.stage = 'review';
      x.summary = 'A bakery site';
    });
    expect(updated.stage).toBe('review');
    expect(updated.assumptions.minimumRate).toBe(800);

    const list = await listDeals(WS);
    expect(list[0]).toMatchObject({ id: d.id, stage: 'review', offeredPrice: 20000, currency: 'INR' });
    expect(await listDeals(OTHER)).toEqual([]);
  });

  it('serialises concurrent updates without losing writes', async () => {
    const d = deal('Concurrent');
    await insertDeal(d);
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        updateDeal(d.id, (x) => {
          x.questions.push({ id: `Q${i}`, text: `q${i}`, requirementId: null, state: 'open' });
        }),
      ),
    );
    expect((await getOwnedDeal(d.id, WS)).questions).toHaveLength(5);
  });

  it('deletes a deal with its call tokens and past project', async () => {
    const d = deal('To delete');
    await insertDeal(d);
    await createSimCall('call_token_abcdef', d.id, 'r1');
    expect(await resolveSimCall('call_token_abcdef')).toEqual({ dealId: d.id, rehearsalId: 'r1' });
    await upsertProjectForDeal(WS, d.id, { title: 'To delete', summary: '', requirements: '', estimatedHours: 10, actualHours: 12, quotedPrice: 1, currency: 'INR', lesson: '' });
    expect(await deleteDeal(d.id, OTHER)).toBe(false);
    expect(await deleteDeal(d.id, WS)).toBe(true);
    expect(await resolveSimCall('call_token_abcdef')).toBeNull();
    expect((await listProjects(WS)).some((p) => p.dealId === d.id)).toBe(false);
  });
});

describe('past projects', () => {
  it('finds similar projects by keywords when embeddings are off', async () => {
    await addProject(WS, {
      title: 'Saree boutique Shopify store',
      summary: 'Online store with 150 products migrated from Instagram',
      requirements: 'Product migration (12 h); Payments (4 h)',
      estimatedHours: 40,
      actualHours: 71,
      quotedPrice: 25000,
      currency: 'INR',
      lesson: 'Product migration took twice as long: photos needed cropping.',
    });
    await addProject(WS, { title: 'Dentist landing page', summary: 'One page with booking form', requirements: '', estimatedHours: 10, actualHours: 9, quotedPrice: 8000, currency: 'INR', lesson: '' });
    const similar = await findSimilarProjects(WS, 'Clothing store: migrate 200 products from Instagram, UPI payments');
    expect(similar[0]?.title).toBe('Saree boutique Shopify store');
    expect(similar[0]?.actualHours).toBe(71);
    expect(similar.some((s) => s.title === 'Dentist landing page')).toBe(false);
    expect(await findSimilarProjects(OTHER, 'store products instagram')).toEqual([]);
  });

  it('builds an OR keyword query from distinctive words', () => {
    expect(keywordQuery('A simple online store; migrate 200 Instagram products!')).toBe('migrate | instagram | products');
  });
});

describe('memory (local fallback)', () => {
  it('saves preferences as memories and reads back the latest', async () => {
    const view = await savePreferences(WS, { ...DEFAULT_PREFERENCES, minimumRate: 750, tone: 'hinglish_friendly', neverInclude: ['logo design'] });
    expect(view.backend).toBe('local');
    expect(view.preferences).toMatchObject({ minimumRate: 750, tone: 'hinglish_friendly', neverInclude: ['logo design'] });
    const again = await savePreferences(WS, { ...view.preferences, minimumRate: 900 });
    expect(again.preferences.minimumRate).toBe(900);
    expect(again.memories.filter((m) => m.content.startsWith('Minimum hourly rate'))).toHaveLength(1);
  });

  it('stores preference values as JSON text, never as a text `value` (Backboard rejects that), and still reads old ones', async () => {
    const ws = 'ws_prefs_format_000000000001';
    await savePreferences(ws, { ...DEFAULT_PREFERENCES, tone: 'english_formal', neverInclude: ['hosting'] });
    const db = await getDb();
    const { rows } = await db.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM memories WHERE workspace_id = $1 AND kind = 'preference'", [ws]);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.metadata).not.toHaveProperty('value');
      expect(typeof r.metadata.json).toBe('string');
    }
    await db.query('INSERT INTO memories (id, workspace_id, kind, content, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)', [
      'mem_old_format_1',
      ws,
      'preference',
      'Quotes in USD.',
      JSON.stringify({ kind: 'preference', key: 'currency', value: 'USD' }),
    ]);
    expect((await loadMemory(ws)).preferences).toMatchObject({ currency: 'USD', tone: 'english_formal', neverInclude: ['hosting'] });
  });

  it('remembers corrections once and recalls relevant ones for a brief', async () => {
    const note = 'The freelancer estimates "Product migration" at 20 h when the client says "200 products on Instagram".';
    expect(await rememberCorrections(WS, [note, note])).toBe(1);
    expect(await rememberCorrections(WS, [note])).toBe(0);
    const recalled = await recallForBrief(WS, 'We have 300 products on Instagram to migrate');
    expect(recalled[0]).toContain('never includes: logo design');
    expect(recalled).toContain(note);
    expect((await loadMemory(WS)).memories.some((m) => m.kind === 'correction')).toBe(true);
  });
});
