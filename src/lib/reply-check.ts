// Checks a drafted reply for money amounts Panga did not calculate, so a
// model-invented price can't slip into a message the freelancer sends.

export interface MoneyMention {
  raw: string;
  amount: number;
}

const NUMBER = String.raw`(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d+))?`;
const BEFORE = new RegExp(
  String.raw`(?:₹|\brs\.?|\binr|\$|€|£|\busd|\beur|\bgbp)\s?${NUMBER}\s?(k|lakhs?|lacs?|l)?\b`,
  'gi',
);
const AFTER = new RegExp(
  String.raw`\b${NUMBER}\s?(k|lakhs?|lacs?|crores?)?\s?(?:rupees|rs\b|inr\b|dollars|usd\b|euros?|pounds)`,
  'gi',
);
// "15k" and "1.5 lakh" are how clients write prices in chat, even without a symbol.
const BARE = new RegExp(String.raw`\b${NUMBER}\s?(k|lakhs?|lacs?|crores?)\b`, 'gi');
// "25-30k", "₹25 to 30 thousand": the suffix belongs to both ends of the range.
const RANGE = new RegExp(
  String.raw`(?:₹|\brs\.?\s?|\$)?\b(\d+(?:\.\d+)?)\s?(?:-|–|to)\s?(?:₹|\brs\.?\s?|\$)?(\d+(?:\.\d+)?)\s?(k|lakhs?|lacs?|thousand)\b`,
  'gi',
);

function toAmount(whole: string, fraction: string | undefined, suffix: string | undefined): number {
  const base = Number(`${whole.replace(/,/g, '')}${fraction ? `.${fraction}` : ''}`);
  const s = (suffix ?? '').toLowerCase();
  if (s === 'k' || s === 'thousand') return base * 1_000;
  if (s.startsWith('lakh') || s.startsWith('lac') || s === 'l') return base * 100_000;
  if (s.startsWith('crore')) return base * 10_000_000;
  return base;
}

export function findMoneyMentions(text: string): MoneyMention[] {
  const hits: { start: number; end: number; mention: MoneyMention }[] = [];
  for (const m of text.matchAll(RANGE)) {
    const start = m.index ?? 0;
    const raw = m[0].trim();
    for (const value of [m[1], m[2]]) {
      const amount = Math.round(toAmount(value, undefined, m[3]));
      if (amount > 0) hits.push({ start, end: start + m[0].length, mention: { raw, amount } });
    }
  }
  for (const re of [BEFORE, AFTER, BARE]) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (hits.some((h) => start < h.end && h.start < end)) continue;
      const amount = Math.round(toAmount(m[1], m[2], m[3]));
      if (!Number.isFinite(amount) || amount <= 0) continue;
      hits.push({ start, end, mention: { raw: m[0].trim(), amount } });
    }
  }
  return hits.sort((a, b) => a.start - b.start).map((h) => h.mention);
}

/** Amounts in the text that aren't in the allowed list. */
export function unknownAmounts(text: string, allowed: number[]): MoneyMention[] {
  const ok = new Set(allowed.filter((n) => Number.isFinite(n)).map((n) => Math.round(n)));
  return findMoneyMentions(text).filter((m) => !ok.has(m.amount));
}
