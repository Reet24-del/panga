// Quote verification. A requirement is only "evidenced" when the quote the
// model gave can be found in the client's own words. The match tolerates
// differences in case, curly quotes, dashes and whitespace, and the stored
// quote is always the exact text from the source, never the model's version.

import type { Evidence, Source } from './types';

const CHAR_MAP: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '‛': "'",
  '′': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '‟': '"',
  '″': '"',
  '–': '-',
  '—': '-',
  '−': '-',
  '…': '...',
  ' ': ' ',
  '​': '',
};

interface Normalized {
  text: string;
  /** map[i] is the index in the original string of normalized character i. */
  map: number[];
}

function normalize(input: string): Normalized {
  let text = '';
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < input.length; i++) {
    const mapped = (CHAR_MAP[input[i]] ?? input[i]).toLowerCase();
    for (const c of mapped) {
      if (/\s/.test(c)) {
        pendingSpace = text.length > 0;
        continue;
      }
      if (pendingSpace) {
        text += ' ';
        map.push(i);
        pendingSpace = false;
      }
      text += c;
      map.push(i);
    }
  }
  return { text, map };
}

const WRAPPING = /^["'`‘’“”]+|["'`‘’“”]+$/g;

/** Removes wrapping quote marks, leading/trailing ellipses and trailing punctuation. */
export function cleanQuote(quote: string): string {
  return quote
    .trim()
    .replace(WRAPPING, '')
    .trim()
    .replace(/^(\.\.\.|…)\s*/, '')
    .replace(/\s*(\.\.\.|…)$/, '')
    .replace(/[\s.,;:!?]+$/, '')
    .trim();
}

export interface QuoteMatch {
  start: number;
  end: number;
  text: string;
}

/** Finds quote inside source. Returns the original span, or null. */
export function locateQuote(source: string, quote: string): QuoteMatch | null {
  const cleaned = cleanQuote(quote);
  if (!cleaned) return null;
  const exact = source.indexOf(cleaned);
  if (exact >= 0) return { start: exact, end: exact + cleaned.length, text: cleaned };

  const s = normalize(source);
  const q = normalize(cleaned);
  if (!q.text) return null;
  const at = s.text.indexOf(q.text);
  if (at < 0) return null;
  const start = s.map[at];
  const end = s.map[at + q.text.length - 1] + 1;
  return { start, end, text: source.slice(start, end) };
}

export const MIN_QUOTE_CHARS = 4;
export const MAX_QUOTE_CHARS = 400;

export interface QuoteCandidate {
  sourceId?: string | null;
  text: string;
}

/**
 * Verifies a model-supplied quote against the sources. The named source is
 * searched first, then the others, since models sometimes cite the wrong one.
 * Elided quotes ("we want ... a store") are rejected: they are not verbatim.
 */
export function findEvidence(sources: Source[], candidate: QuoteCandidate): Evidence | null {
  const cleaned = cleanQuote(candidate.text ?? '');
  if (cleaned.length < MIN_QUOTE_CHARS || cleaned.length > MAX_QUOTE_CHARS) return null;
  if (/(\.\.\.|…)/.test(cleaned)) return null;
  const named = candidate.sourceId ? sources.filter((s) => s.id === candidate.sourceId) : [];
  const ordered = [...named, ...sources.filter((s) => !named.includes(s))];
  for (const source of ordered) {
    const match = locateQuote(source.text, cleaned);
    if (match) return { sourceId: source.id, quote: match.text, start: match.start, end: match.end };
  }
  return null;
}

/** Drops duplicate and overlapping evidence, keeping the longer span. */
export function dedupeEvidence(list: Evidence[]): Evidence[] {
  const sorted = [...list].sort((a, b) => b.end - b.start - (a.end - a.start));
  const kept: Evidence[] = [];
  for (const e of sorted) {
    const overlaps = kept.some((k) => k.sourceId === e.sourceId && e.start < k.end && k.start < e.end);
    if (!overlaps) kept.push(e);
  }
  return kept.sort((a, b) => (a.sourceId === b.sourceId ? a.start - b.start : a.sourceId.localeCompare(b.sourceId)));
}

export interface Highlight {
  start: number;
  end: number;
  key: string;
}

export interface Segment {
  text: string;
  keys: string[];
}

/** Splits text into segments so overlapping highlights can be rendered without HTML strings. */
export function segmentText(text: string, highlights: Highlight[]): Segment[] {
  const valid = highlights.filter((h) => h.start >= 0 && h.end <= text.length && h.end > h.start);
  const cuts = new Set<number>([0, text.length]);
  for (const h of valid) {
    cuts.add(h.start);
    cuts.add(h.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    if (a === b) continue;
    const keys = valid.filter((h) => h.start <= a && h.end >= b).map((h) => h.key);
    const last = segments[segments.length - 1];
    if (last && last.keys.join() === keys.join()) last.text += text.slice(a, b);
    else segments.push({ text: text.slice(a, b), keys });
  }
  return segments;
}
