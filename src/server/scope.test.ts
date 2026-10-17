import { describe, expect, it } from 'vitest';
import { defaultAssumptions } from '@/lib/economics';
import sample from '@/lib/sample-deal.json';
import type { Rehearsal, Source } from '@/lib/types';
import { req } from '@/lib/test-helpers';
import { ExtractionSchema, ReplaySchema, buildCommitments, buildScope, quoteStatesAmount } from './scope';

const SOURCES: Source[] = sample.sources.map((s, i) => ({ id: `S${i + 1}`, kind: s.kind as Source['kind'], label: s.label, text: s.text }));
const ASSUMPTIONS = { ...defaultAssumptions('INR'), commsHours: 0 };

const EXTRACTION = ExtractionSchema.parse({
  summary: 'An online clothing store for a small Pune label.',
  offered_price: { amount: 15000, currency: 'INR', source: 'S1', quote: 'Our budget is ₹15,000' },
  requirements: [
    { title: 'Store setup and theme', category: 'build', detail: 'x', quotes: [{ source: 'S1', text: 'a simple online store for my clothing brand' }], suggested_hours: 12, hidden: false },
    { title: 'Mobile layouts', category: 'design', quotes: [{ source: 'S1', text: 'Most customers will buy from phone' }, { source: 'S1', text: 'fully responsive design' }], suggested_hours: '6', hidden: 'true' },
    { title: 'Product migration', category: 'CONTENT', quotes: ['we have around 200 products on Instagram'], suggested_hours: 13.3, hidden: true },
    { title: 'Hosting setup', category: 'devops', quotes: [], suggested_hours: 2, inferred: true },
    { title: 'store setup and theme', quotes: [] },
  ],
  questions: [
    { text: 'Who uploads the 200 products?', requirement: 2 },
    { text: 'What is the launch date?', requirement: null },
    { text: 'Which payment gateway?', requirement: 'R9' },
  ],
});

describe('buildScope', () => {
  const scope = buildScope(SOURCES, EXTRACTION, { statedPrice: null, assumptions: ASSUMPTIONS });

  it('keeps verified quotes as exact source text and counts rejections', () => {
    expect(scope.requirements.map((r) => r.id)).toEqual(['R1', 'R2', 'R3', 'R4']);
    expect(scope.quotesChecked).toBe(5);
    expect(scope.quotesRejected).toBe(1);
    const mobile = scope.requirements[1];
    expect(mobile.evidence).toHaveLength(1);
    expect(SOURCES[0].text.slice(mobile.evidence[0].start, mobile.evidence[0].end)).toBe('Most customers will buy from phone');
  });

  it('marks unquoted work as inferred, so it is not priced', () => {
    expect(scope.requirements[3].status).toBe('inferred');
    expect(scope.requirements[0].status).toBe('confirmed');
  });

  it('normalises categories, flags and hours', () => {
    expect(scope.requirements[2].category).toBe('content');
    expect(scope.requirements[3].category).toBe('other');
    expect(scope.requirements[1].hidden).toBe(true);
    expect(scope.requirements[1].hours).toBe(6);
    expect(scope.requirements[2].hours).toBe(13.5);
    expect(scope.requirements[2].hoursSource).toBe('suggested');
  });

  it('links questions to requirement ids and drops unknown links', () => {
    expect(scope.questions.map((q) => q.requirementId)).toEqual(['R3', null, null]);
  });

  it('accepts a price only when its quote states it', () => {
    expect(scope.offeredPrice).toBe(15000);
    expect(scope.priceEvidence?.quote).toBe('Our budget is ₹15,000');
  });

  it("lets the freelancer's own price win", () => {
    const s = buildScope(SOURCES, EXTRACTION, { statedPrice: 18000, assumptions: ASSUMPTIONS });
    expect(s.offeredPrice).toBe(18000);
    expect(s.priceEvidence).toBeNull();
  });

  it('pre-selects a starter package that fits the budget', () => {
    // 15000 / 700 = 21.4 h minus one 3 h round: store setup (12) fits, then mobile (6).
    expect(scope.requirements.filter((r) => r.inStarter).map((r) => r.id)).toEqual(['R1', 'R2']);
  });

  it('rejects a price whose quote does not mention it', () => {
    const ex = ExtractionSchema.parse({ ...EXTRACTION, offered_price: { amount: 20000, quote: 'Our budget is ₹15,000', source: 'S1' } });
    expect(buildScope(SOURCES, ex, { statedPrice: null, assumptions: ASSUMPTIONS }).offeredPrice).toBeNull();
  });
});

describe('quoteStatesAmount', () => {
  it('reads symbols, shorthand and plain digits', () => {
    expect(quoteStatesAmount('total 15k is fine na', 15000)).toBe(true);
    expect(quoteStatesAmount('budget 15000 max', 15000)).toBe(true);
    expect(quoteStatesAmount('budget is tight', 15000)).toBe(false);
  });
});

describe('ExtractionSchema', () => {
  it('requires at least one requirement', () => {
    expect(ExtractionSchema.safeParse({ requirements: [] }).success).toBe(false);
  });

  it('tolerates a malformed price and questions', () => {
    const r = ExtractionSchema.parse({ requirements: [{ title: 'x' }], offered_price: 'about 15k', questions: 'none' });
    expect(r.offered_price).toBeNull();
    expect(r.questions).toEqual([]);
  });
});

describe('buildCommitments', () => {
  const rehearsal: Rehearsal = {
    id: 'r1',
    mode: 'text',
    difficulty: 'hell',
    status: 'ended',
    startedAt: '',
    endedAt: '',
    replay: null,
    turns: [
      { id: 't1', role: 'client', text: 'Uploading the 200 products is included, right?', requirementId: 'R3' },
      { id: 't2', role: 'freelancer', text: 'Haan, products upload kar denge. Small changes are fine.', requirementId: null },
    ],
  };
  const requirements = [req('R1', 1), req('R3', 1)];

  it('keeps commitments quoted from freelancer turns only', () => {
    const parsed = ReplaySchema.parse({
      commitments: [
        { turn: 'T2', quote: 'products upload kar denge', kind: 'ambiguous', requirement: 'r3', suggestion: 'Cap it at 200 products.' },
        { turn: 'T2', quote: 'small changes are fine', kind: 'weird', requirement: null },
        { turn: 'T1', quote: 'Uploading the 200 products is included', kind: 'in_scope' },
        { turn: 'T2', quote: 'I will do it for free', kind: 'price' },
      ],
    });
    const out = buildCommitments(rehearsal, requirements, parsed);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ turnId: 't2', quote: 'products upload kar denge', kind: 'ambiguous', requirementId: 'R3' });
    expect(out[1]).toMatchObject({ quote: 'Small changes are fine', kind: 'ambiguous', requirementId: null });
  });

  it('links an unlinked promise to the item whose words it repeats, but never extra work', () => {
    const items = [
      req('R1', 1),
      req('R6', 1, { title: 'Ongoing maintenance', evidence: [{ sourceId: 'S2', quote: 'small changes later also, like banners for every sale', start: 0, end: 5 }] }),
    ];
    const call: Rehearsal = {
      ...rehearsal,
      turns: [rehearsal.turns[0], { id: 't2', role: 'freelancer', text: 'I will add the sale banners whenever you need them.', requirementId: null }],
    };
    const parsed = ReplaySchema.parse({
      commitments: [
        { turn: 'T2', quote: 'I will add the sale banners whenever you need them', kind: 'ambiguous', requirement: null },
        { turn: 'T2', quote: 'add the sale banners', kind: 'out_of_scope', requirement: null },
      ],
    });
    const out = buildCommitments(call, items, parsed);
    expect(out[0].requirementId).toBe('R6');
    expect(out[1].requirementId).toBeNull();
  });

  it('replaces internal item ids in suggestions with the item names', () => {
    const parsed = ReplaySchema.parse({
      commitments: [{ turn: 'T2', quote: 'products upload kar denge', kind: 'price', suggestion: 'List which items (R1 and R3) are in the 15k price.' }],
    });
    expect(buildCommitments(rehearsal, requirements, parsed)[0].suggestion).toBe('List which items “Item R1” and “Item R3” are in the 15k price.');
  });
});
