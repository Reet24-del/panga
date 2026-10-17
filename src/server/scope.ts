// Turns the scope analyst's JSON into verified requirements, questions and a
// price. Pure: no model, no database. Quotes that can't be found in the
// client's words are dropped and counted.

import { z } from 'zod';
import { autoFitStarter } from '@/lib/economics';
import { dedupeEvidence, findEvidence, locateQuote } from '@/lib/evidence';
import { newId } from '@/lib/ids';
import { guessRequirement } from '@/lib/rehearsal';
import { findMoneyMentions } from '@/lib/reply-check';
import {
  CATEGORIES,
  type Assumptions,
  type Category,
  type Commitment,
  type CommitmentClass,
  type Evidence,
  type Question,
  type Rehearsal,
  type Requirement,
  type Source,
} from '@/lib/types';

const flag = z.preprocess((v) => v === true || v === 'true', z.boolean());
const hours = z.preprocess((v) => (v == null || v === '' ? null : Number(v)), z.number().nullable()).catch(null);

const QuoteSchema = z.union([
  z.string().transform((text) => ({ source: null as string | null, text })),
  z.object({ source: z.string().nullish(), text: z.string() }).transform((q) => ({ source: q.source ?? null, text: q.text })),
]);

export const ExtractionSchema = z.object({
  summary: z.string().optional(),
  offered_price: z
    .object({ amount: z.coerce.number(), currency: z.string().nullish(), source: z.string().nullish(), quote: z.string().nullish() })
    .nullish()
    .catch(null),
  requirements: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        category: z.string().nullish(),
        detail: z.string().nullish(),
        quotes: z.array(QuoteSchema).nullish(),
        hidden: flag.optional(),
        inferred: flag.optional(),
        suggested_hours: hours.optional(),
      }),
    )
    .min(1, 'list at least one requirement'),
  questions: z
    .array(z.object({ text: z.string().trim().min(3), requirement: z.union([z.number(), z.string(), z.null()]).optional() }))
    .nullish()
    .catch([]),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

function category(value: string | null | undefined): Category {
  const v = (value ?? '').toLowerCase().trim() as Category;
  return CATEGORIES.includes(v) ? v : 'other';
}

function clampHours(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(400, Math.round(value * 2) / 2);
}

/** True when the quote actually states this amount ("₹15,000", "15k", "15000"). */
export function quoteStatesAmount(quote: string, amount: number): boolean {
  const rounded = Math.round(amount);
  if (findMoneyMentions(quote).some((m) => m.amount === rounded)) return true;
  return quote.replace(/[,\s]/g, '').includes(String(rounded));
}

export interface ScopeBuild {
  summary: string;
  requirements: Requirement[];
  questions: Question[];
  offeredPrice: number | null;
  priceEvidence: Evidence | null;
  quotesChecked: number;
  quotesRejected: number;
}

export function buildScope(
  sources: Source[],
  extraction: Extraction,
  opts: { statedPrice: number | null; assumptions: Assumptions },
): ScopeBuild {
  let checked = 0;
  let rejected = 0;
  const seen = new Set<string>();
  const requirements: Requirement[] = [];
  const byIndex = new Map<number, string>();

  extraction.requirements.slice(0, 15).forEach((r, index) => {
    const key = r.title.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) return;
    seen.add(key);
    const found: Evidence[] = [];
    for (const q of (r.quotes ?? []).slice(0, 4)) {
      checked++;
      const e = findEvidence(sources, { sourceId: q.source, text: q.text });
      if (e) found.push(e);
      else rejected++;
    }
    const evidence = dedupeEvidence(found);
    const h = clampHours(r.suggested_hours);
    const id = `R${requirements.length + 1}`;
    byIndex.set(index, id);
    requirements.push({
      id,
      title: r.title.slice(0, 80),
      detail: (r.detail ?? '').trim().slice(0, 300),
      category: category(r.category),
      hidden: Boolean(r.hidden),
      evidence,
      status: evidence.length ? 'confirmed' : 'inferred',
      confirmedWithoutQuote: false,
      hours: h,
      hoursSource: 'suggested',
      suggestedHours: h,
      inStarter: false,
      starterHours: h,
      research: null,
      addedBy: 'panga',
    });
  });

  const ids = new Set(requirements.map((r) => r.id));
  const ref = (value: number | string | null | undefined): string | null => {
    if (typeof value === 'number') return byIndex.get(value) ?? null;
    if (typeof value === 'string') {
      const upper = value.trim().toUpperCase();
      if (ids.has(upper)) return upper;
      const n = Number(value);
      if (Number.isInteger(n)) return byIndex.get(n) ?? null;
    }
    return null;
  };

  const questions: Question[] = (extraction.questions ?? []).slice(0, 8).map((q, i) => ({
    id: `Q${i + 1}`,
    text: q.text.slice(0, 300),
    requirementId: ref(q.requirement),
    state: 'open',
  }));

  let priceEvidence: Evidence | null = null;
  let extractedPrice: number | null = null;
  const op = extraction.offered_price;
  if (op && op.amount > 0 && op.quote) {
    checked++;
    const e = findEvidence(sources, { sourceId: op.source ?? null, text: op.quote });
    if (!e) rejected++;
    else if (quoteStatesAmount(e.quote, op.amount)) {
      priceEvidence = e;
      extractedPrice = Math.round(op.amount);
    }
  }
  // A price the freelancer typed wins; a model-read price needs a quote that states it.
  const offeredPrice = opts.statedPrice ?? extractedPrice;
  if (offeredPrice !== extractedPrice) priceEvidence = null;

  const starter = autoFitStarter(requirements, offeredPrice, opts.assumptions);
  for (const r of requirements) r.inStarter = starter.has(r.id);

  return {
    summary: (extraction.summary ?? '').trim().slice(0, 400),
    requirements,
    questions,
    offeredPrice,
    priceEvidence,
    quotesChecked: checked,
    quotesRejected: rejected,
  };
}

// ---------- Replay commitments ----------

export const ReplaySchema = z.object({
  commitments: z
    .array(
      z.object({
        turn: z.string(),
        quote: z.string(),
        kind: z.string(),
        requirement: z.string().nullish(),
        suggestion: z.string().nullish(),
      }),
    )
    .catch([]),
});

export type ReplayExtraction = z.infer<typeof ReplaySchema>;

const KINDS: CommitmentClass[] = ['in_scope', 'out_of_scope', 'ambiguous', 'time', 'price'];

/** Keeps only commitments whose quote is really in that freelancer turn. */
export function buildCommitments(rehearsal: Rehearsal, requirements: Requirement[], parsed: ReplayExtraction): Commitment[] {
  const byLabel = new Map(rehearsal.turns.map((t, i) => [`T${i + 1}`, t]));
  const ids = new Set(requirements.map((r) => r.id));
  const titles = new Map(requirements.map((r) => [r.id, r.title]));
  // Suggestions are read by the freelancer: name the work, never an internal id.
  const plain = (s: string) =>
    s
      .replace(/\(?\b(R\d{1,3})\b\)?/g, (m, id: string) => (titles.has(id) ? `“${titles.get(id)}”` : m))
      .replace(/\s{2,}/g, ' ')
      .trim();
  const out: Commitment[] = [];
  const seen = new Set<string>();
  for (const c of parsed.commitments.slice(0, 20)) {
    const turn = byLabel.get(c.turn.trim().toUpperCase());
    if (!turn || turn.role !== 'freelancer') continue;
    const match = locateQuote(turn.text, c.quote);
    if (!match || match.text.length < 2) continue;
    const key = `${turn.id}:${match.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const requirement = c.requirement?.trim().toUpperCase() ?? '';
    const kind = KINDS.includes(c.kind as CommitmentClass) ? (c.kind as CommitmentClass) : 'ambiguous';
    // The model sometimes forgets the link. Extra work by definition has no
    // item; anything else is matched on the words the freelancer used.
    const linked = ids.has(requirement) ? requirement : kind === 'out_of_scope' ? null : guessRequirement(match.text, requirements);
    out.push({
      id: newId('c'),
      turnId: turn.id,
      quote: match.text,
      kind,
      requirementId: linked,
      suggestion: plain(c.suggestion ?? '').slice(0, 300),
      resolved: false,
    });
  }
  return out;
}
