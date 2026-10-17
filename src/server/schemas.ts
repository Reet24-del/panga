// Request validation, and the rules that keep edited deals honest: evidence
// must still match the client's words, and server-owned fields can't be
// overwritten from the browser.

import { z } from 'zod';
import { CATEGORIES, CURRENCIES, type Deal, type Question, type Requirement } from '@/lib/types';

const money = z.number().finite().min(0).max(1e10);
const hours = z.number().finite().min(0).max(2000);
const reqId = z.string().regex(/^R\d{1,3}$/);

export const StoredFileSchema = z.object({
  key: z.string().max(300),
  name: z.string().max(120),
  size: z.number().int().min(0),
  contentType: z.string().max(100),
});

export const NewDealSchema = z
  .object({
    title: z.string().trim().max(120).default(''),
    currency: z.enum(CURRENCIES).default('INR'),
    offeredPrice: money.nullable().default(null),
    sources: z
      .array(
        z.object({
          kind: z.enum(['brief', 'chat', 'voice', 'note']),
          label: z.string().trim().max(60).default(''),
          text: z.string().trim().min(1, 'is empty').max(20_000, 'is longer than 20,000 characters'),
          file: StoredFileSchema.nullable().optional(),
        }),
      )
      .min(1, 'Add a brief or client messages first.')
      .max(4, 'Use at most four sources.'),
  })
  .refine((d) => d.sources.reduce((n, s) => n + s.text.length, 0) <= 40_000, 'All sources together must be under 40,000 characters.');

const EvidenceSchema = z.object({
  sourceId: z.string().max(10),
  quote: z.string().max(500),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
});

const RequirementSchema = z.object({
  id: reqId,
  title: z.string().trim().min(1).max(80),
  detail: z.string().max(300),
  category: z.enum(CATEGORIES),
  hidden: z.boolean(),
  evidence: z.array(EvidenceSchema).max(6),
  status: z.enum(['confirmed', 'inferred', 'removed']),
  confirmedWithoutQuote: z.boolean(),
  hours,
  hoursSource: z.enum(['suggested', 'freelancer']),
  suggestedHours: hours.nullable(),
  inStarter: z.boolean(),
  starterHours: hours,
  research: z.unknown().optional(),
  addedBy: z.enum(['panga', 'freelancer']),
});

const QuestionSchema = z.object({
  id: z.string().regex(/^Q\d{1,3}$/),
  text: z.string().trim().min(1).max(300),
  requirementId: reqId.nullable(),
  state: z.enum(['open', 'ask_client', 'assumed', 'answered']),
});

export const AssumptionsSchema = z.object({
  minimumRate: money,
  commsHours: hours,
  revisionRounds: z.number().int().min(0).max(20),
  starterRevisionRounds: z.number().int().min(0).max(20),
  hoursPerRound: hours,
  contingencyPct: z.number().finite().min(0).max(200),
  priceStep: z.number().finite().min(1).max(1e6),
  updateHoursPerMonth: hours,
});

export const DealPatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  offeredPrice: money.nullable().optional(),
  currency: z.enum(CURRENCIES).optional(),
  requirements: z.array(RequirementSchema).max(40).optional(),
  questions: z.array(QuestionSchema).max(30).optional(),
  assumptions: AssumptionsSchema.optional(),
});

export type DealPatchInput = z.infer<typeof DealPatchSchema>;

/**
 * Applies the freelancer's edits. Evidence is re-checked against the sources,
 * research and the original suggestion stay as the server recorded them, and
 * status follows the evidence rule (no quote and not confirmed = inferred).
 */
export function applyPatch(deal: Deal, patch: DealPatchInput): void {
  if (patch.title !== undefined) deal.title = patch.title;
  if (patch.currency !== undefined) deal.currency = patch.currency;
  if (patch.offeredPrice !== undefined) {
    const next = patch.offeredPrice && patch.offeredPrice > 0 ? Math.round(patch.offeredPrice) : null;
    if (next !== deal.offeredPrice) deal.priceEvidence = null;
    deal.offeredPrice = next;
  }
  if (patch.assumptions) deal.assumptions = patch.assumptions;

  if (patch.requirements) {
    const existing = new Map(deal.requirements.map((r) => [r.id, r]));
    const sources = new Map(deal.sources.map((s) => [s.id, s]));
    const seen = new Set<string>();
    const next: Requirement[] = [];
    for (const r of patch.requirements) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const before = existing.get(r.id);
      const evidence = r.evidence.filter((e) => {
        const s = sources.get(e.sourceId);
        return Boolean(s) && e.end > e.start && s!.text.slice(e.start, e.end) === e.quote;
      });
      const status =
        r.status === 'removed' ? 'removed' : evidence.length || r.confirmedWithoutQuote ? 'confirmed' : 'inferred';
      next.push({
        id: r.id,
        title: r.title,
        detail: r.detail,
        category: r.category,
        hidden: r.hidden,
        evidence,
        status,
        confirmedWithoutQuote: r.confirmedWithoutQuote,
        hours: r.hours,
        hoursSource: r.hoursSource,
        suggestedHours: before?.suggestedHours ?? null,
        inStarter: r.inStarter,
        starterHours: r.starterHours,
        research: before?.research ?? null,
        addedBy: before?.addedBy ?? 'freelancer',
      });
    }
    deal.requirements = next;
  }

  if (patch.questions) {
    const ids = new Set(deal.requirements.map((r) => r.id));
    deal.questions = patch.questions.map(
      (q): Question => ({ ...q, requirementId: q.requirementId && ids.has(q.requirementId) ? q.requirementId : null }),
    );
  }
}
