import { describe, expect, it } from 'vitest';
import sample from '@/lib/sample-deal.json';
import { req } from '@/lib/test-helpers';
import type { Deal } from '@/lib/types';
import { newDeal } from './pipeline';
import { DealPatchSchema, applyPatch } from './schemas';
import { fileKeyBelongsTo } from './spaces';

function deal(): Deal {
  const d = newDeal({
    workspaceId: 'ws_schema_test_01',
    title: 'Test',
    currency: 'INR',
    offeredPrice: 15000,
    minimumRate: null,
    sources: sample.sources.map((s) => ({ kind: s.kind as 'brief' | 'chat', label: s.label, text: s.text })),
  });
  const text = d.sources[1].text;
  const quote = 'we have around 200 products on Instagram';
  const start = text.indexOf(quote);
  d.requirements = [
    req('R1', 13, {
      evidence: [{ sourceId: 'S2', quote, start, end: start + quote.length }],
      suggestedHours: 13,
      research: { query: 'q', summary: 'From the server [1]', sources: [], at: '2026-10-17T00:00:00Z' },
    }),
  ];
  d.priceEvidence = { sourceId: 'S1', quote: 'Our budget is ₹15,000', start: 0, end: 5 };
  return d;
}

const patch = (d: Deal, changes: Record<string, unknown>) => DealPatchSchema.parse({ requirements: d.requirements, ...changes });

describe('applyPatch', () => {
  it('keeps evidence that matches the source exactly', () => {
    const d = deal();
    applyPatch(d, patch(d, {}));
    expect(d.requirements[0].evidence).toHaveLength(1);
    expect(d.requirements[0].status).toBe('confirmed');
  });

  it('drops tampered evidence, so the item falls back to inferred', () => {
    const d = deal();
    const forged = structuredClone(d.requirements);
    forged[0].evidence[0].quote = 'we have around 2000 products on Instagram';
    applyPatch(d, patch(d, { requirements: forged }));
    expect(d.requirements[0].evidence).toEqual([]);
    expect(d.requirements[0].status).toBe('inferred');
  });

  it('accepts an item the freelancer confirmed without a quote', () => {
    const d = deal();
    const edited = [...structuredClone(d.requirements), req('R2', 3, { evidence: [], confirmedWithoutQuote: true, status: 'inferred', addedBy: 'freelancer' })];
    applyPatch(d, patch(d, { requirements: edited }));
    expect(d.requirements[1].status).toBe('confirmed');
    expect(d.requirements[1].addedBy).toBe('freelancer');
  });

  it("keeps server-owned fields: research and Panga's original suggestion", () => {
    const d = deal();
    const edited = structuredClone(d.requirements);
    edited[0].suggestedHours = 1;
    edited[0].research = { query: 'x', summary: 'injected', sources: [], at: '' };
    edited[0].addedBy = 'freelancer';
    applyPatch(d, patch(d, { requirements: edited }));
    expect(d.requirements[0].suggestedHours).toBe(13);
    expect(d.requirements[0].research?.summary).toBe('From the server [1]');
    expect(d.requirements[0].addedBy).toBe('panga');
  });

  it('clears price evidence when the freelancer changes the price', () => {
    const d = deal();
    applyPatch(d, DealPatchSchema.parse({ offeredPrice: 18000.4 }));
    expect(d.offeredPrice).toBe(18000);
    expect(d.priceEvidence).toBeNull();
  });

  it('unlinks questions from work that no longer exists', () => {
    const d = deal();
    applyPatch(d, DealPatchSchema.parse({ questions: [{ id: 'Q1', text: 'Who uploads?', requirementId: 'R9', state: 'ask_client' }] }));
    expect(d.questions[0].requirementId).toBeNull();
  });

  it('rejects malformed edits', () => {
    expect(DealPatchSchema.safeParse({ assumptions: { minimumRate: -5 } }).success).toBe(false);
    expect(DealPatchSchema.safeParse({ requirements: [{ id: 'X1' }] }).success).toBe(false);
  });
});

describe('fileKeyBelongsTo', () => {
  it('only allows keys inside the caller’s workspace folder', () => {
    expect(fileKeyBelongsTo('workspaces/ws_a1b2c3d4/f_1-brief.pdf', 'ws_a1b2c3d4')).toBe(true);
    expect(fileKeyBelongsTo('workspaces/ws_other000/f_1-brief.pdf', 'ws_a1b2c3d4')).toBe(false);
    expect(fileKeyBelongsTo('workspaces/ws_a1b2c3d4/../ws_other000/f.pdf', 'ws_a1b2c3d4')).toBe(false);
  });
});
