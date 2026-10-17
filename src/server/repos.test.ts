// Runs the real SQL against an in-memory Postgres (PGlite with pgvector).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetDb } from './db';
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
