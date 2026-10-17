import { describe, expect, it } from 'vitest';
import { cleanQuote, dedupeEvidence, findEvidence, locateQuote, segmentText } from './evidence';
import type { Source } from './types';
import sample from './sample-deal.json';

const SOURCES: Source[] = sample.sources.map((s, i) => ({ id: `S${i + 1}`, kind: s.kind as Source['kind'], label: s.label, text: s.text }));

describe('locateQuote', () => {
  const text = 'Most customers will buy from phone, so it must look good on mobile.';

  it('finds an exact quote', () => {
    expect(locateQuote(text, 'buy from phone')).toEqual({ start: 20, end: 34, text: 'buy from phone' });
  });

  it('tolerates case, whitespace and curly quotes, and returns the original text', () => {
    const src = 'He said “launch   before Diwali” — okay?';
    const m = locateQuote(src, '"Launch before diwali"');
    expect(m).not.toBeNull();
    expect(m!.text).toBe('launch   before Diwali');
    expect(src.slice(m!.start, m!.end)).toBe('launch   before Diwali');
  });

  it('matches across a line break the model flattened', () => {
    const src = 'banners for\nevery sale';
    expect(locateQuote(src, 'banners for every sale')?.text).toBe('banners for\nevery sale');
  });

  it('returns null when the words are not in the source', () => {
    expect(locateQuote(text, 'fully responsive design')).toBeNull();
  });
});

describe('cleanQuote', () => {
  it('removes wrapping quotes, ellipses and trailing punctuation', () => {
    expect(cleanQuote('  "...total 15k is fine na?"  ')).toBe('total 15k is fine na');
    expect(cleanQuote('‘UPI and cards both should work.’')).toBe('UPI and cards both should work');
  });
});

describe('findEvidence', () => {
  it('verifies a quote from the sample WhatsApp thread', () => {
    const e = findEvidence(SOURCES, { sourceId: 'S2', text: 'we have around 200 products on Instagram' });
    expect(e?.sourceId).toBe('S2');
    expect(SOURCES[1].text.slice(e!.start, e!.end)).toBe('we have around 200 products on Instagram');
  });

  it('searches other sources when the model cites the wrong one', () => {
    const e = findEvidence(SOURCES, { sourceId: 'S2', text: 'Most customers will buy from phone' });
    expect(e?.sourceId).toBe('S1');
  });

  it('rejects elided, too-short and invented quotes', () => {
    expect(findEvidence(SOURCES, { text: 'we have ... products' })).toBeNull();
    expect(findEvidence(SOURCES, { text: 'UPI' })).toBeNull();
    expect(findEvidence(SOURCES, { text: 'needs a loyalty programme' })).toBeNull();
  });

  it('accepts an unknown source id', () => {
    expect(findEvidence(SOURCES, { sourceId: 'S9', text: 'UPI and cards both should work' })?.sourceId).toBe('S2');
  });
});

describe('dedupeEvidence', () => {
  it('keeps the longer of two overlapping spans', () => {
    const out = dedupeEvidence([
      { sourceId: 'S1', quote: 'online store', start: 10, end: 22 },
      { sourceId: 'S1', quote: 'simple online store', start: 3, end: 22 },
      { sourceId: 'S2', quote: 'online store', start: 10, end: 22 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].quote).toBe('simple online store');
  });
});

describe('segmentText', () => {
  it('splits text at highlight boundaries, including overlaps', () => {
    const segs = segmentText('abcdefgh', [
      { start: 1, end: 4, key: 'x' },
      { start: 3, end: 6, key: 'y' },
    ]);
    expect(segs).toEqual([
      { text: 'a', keys: [] },
      { text: 'bc', keys: ['x'] },
      { text: 'd', keys: ['x', 'y'] },
      { text: 'ef', keys: ['y'] },
      { text: 'gh', keys: [] },
    ]);
  });

  it('ignores out-of-range highlights', () => {
    expect(segmentText('abc', [{ start: 2, end: 9, key: 'z' }])).toEqual([{ text: 'abc', keys: [] }]);
  });
});
