import { describe, expect, it } from 'vitest';
import { TagStripper, buildPressurePlan, guessRequirement, parseClientTurn } from './rehearsal';
import { req } from './test-helpers';

const IDS = new Set(['R1', 'R2', 'R4']);

describe('parseClientTurn', () => {
  it('reads and removes a valid tag', () => {
    expect(parseClientTurn('[R4] Uploading the 200 products is included, right?', IDS)).toEqual({
      text: 'Uploading the 200 products is included, right?',
      requirementId: 'R4',
    });
  });

  it('drops unknown tags and speaker labels', () => {
    expect(parseClientTurn('[R9] Client: "So that is included?"', IDS)).toEqual({ text: 'So that is included?', requirementId: null });
  });

  it('drops stray punctuation left after the tag', () => {
    expect(parseClientTurn('[R2] , Hello! Payments are included, right?', IDS).text).toBe('Hello! Payments are included, right?');
  });

  it('accepts untagged replies', () => {
    expect(parseClientTurn('Okay, fine.', IDS)).toEqual({ text: 'Okay, fine.', requirementId: null });
  });

  it('strips stray tags inside the text', () => {
    expect(parseClientTurn('[PRICE] 15k is fine [R2] na?', IDS).text).toBe('15k is fine na?');
  });
});

describe('TagStripper', () => {
  it('never emits the tag when it arrives in pieces', () => {
    const s = new TagStripper(IDS);
    const out = [s.feed('[R'), s.feed('4] Upload'), s.feed('ing is included?'), s.flush()].join('');
    expect(out).toBe('Uploading is included?');
    expect(s.requirementId).toBe('R4');
  });

  it('passes untagged text straight through', () => {
    const s = new TagStripper(IDS);
    expect(s.feed('Hello ')).toBe('Hello ');
    expect(s.feed('there')).toBe('there');
    expect(s.requirementId).toBeNull();
  });

  it('gives up on a bracket that never closes', () => {
    const s = new TagStripper(IDS);
    expect(s.feed('[this is a long aside without a close')).toBe('[this is a long aside without a close');
  });

  it('skips a thinking block before the reply', () => {
    const s = new TagStripper(IDS);
    const out = [s.feed('<think>plan'), s.feed(' it</think>[R1] '), s.feed('Is that included?'), s.flush()].join('');
    expect(out).toBe('Is that included?');
    expect(s.requirementId).toBe('R1');
  });

  it('flushes a short buffered tag-only reply as empty', () => {
    const s = new TagStripper(IDS);
    expect(s.feed('[R2')).toBe('');
    expect(s.flush()).toBe('[R2');
  });
});

describe('guessRequirement', () => {
  const requirements = [
    req('R1', 20, { title: 'Online store build', evidence: [{ sourceId: 'S1', quote: 'a simple online store for my clothing brand', start: 0, end: 1 }] }),
    req('R3', 15, { title: 'Product catalog upload', evidence: [{ sourceId: 'S2', quote: 'we have around 200 products on Instagram', start: 0, end: 1 }] }),
    req('R9', 3, { title: 'Hosting', status: 'inferred', evidence: [] }),
  ];

  it('links an untagged line to the item it talks about', () => {
    expect(guessRequirement('Since my products are all on Instagram, you will just move those 200 items over, right?', requirements)).toBe('R3');
  });

  it('stays unlinked when nothing clearly matches', () => {
    expect(guessRequirement('Hello! Thanks for joining the call.', requirements)).toBeNull();
    expect(guessRequirement('What about hosting?', requirements)).toBeNull();
  });
});

describe('buildPressurePlan', () => {
  const requirements = [
    req('R1', 12, { title: 'Store setup' }),
    req('R2', 6, { title: 'Mobile', hidden: true }),
    req('R3', 2, { title: 'Hosting', status: 'inferred', evidence: [] }),
    req('R4', 13, { title: 'Migration', hidden: true, category: 'content' }),
    req('R5', 4, { title: 'Updates', hidden: true, category: 'support', status: 'removed' }),
  ];

  it('puts gaps with open questions first and never uses unevidenced work', () => {
    const plan = buildPressurePlan({
      requirements,
      questions: [{ id: 'Q1', text: 'Who uploads?', requirementId: 'R4', state: 'open' }],
      offeredPrice: 15000,
      currency: 'INR',
    });
    expect(plan.map((p) => p.requirementId)).toEqual(['R4', 'R2', 'R1', null]);
    expect(plan[3].angle).toContain('₹15,000');
  });

  it('respects the limit', () => {
    const plan = buildPressurePlan({ requirements, questions: [], offeredPrice: null, currency: 'INR' }, 2);
    expect(plan).toHaveLength(2);
  });
});
