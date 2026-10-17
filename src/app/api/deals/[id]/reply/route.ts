import { z } from 'zod';
import { unknownAmounts } from '@/lib/reply-check';
import { getOwnedDeal, updateDeal } from '@/server/deals-repo';
import { HttpError } from '@/server/errors';
import { json, param, readBody, requireWorkspace, route, type Ctx } from '@/server/http';
import { requireModel } from '@/server/llm';
import { draftReply, replyFacts } from '@/server/pipeline';
import { takeModelCall } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  choice: z.enum(['take', 'change', 'walk']),
  tone: z.enum(['english_friendly', 'english_formal', 'hinglish_friendly']),
});

/** Drafts the reply to the client. Every amount comes from the economics engine. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const ws = requireWorkspace(req);
  const id = await param(ctx, 'id');
  const { choice, tone } = await readBody(req, Body);
  const deal = await getOwnedDeal(id, ws);
  if (deal.stage === 'analyzing' || deal.stage === 'analysis_failed') throw new HttpError(409, 'Let Panga read the brief first.', 'not_ready');
  if (deal.decision?.approvedAt) throw new HttpError(409, 'This reply is already approved.', 'decided');
  requireModel();
  takeModelCall(ws);
  const reply = await draftReply(deal, choice, tone);
  const { allowed } = replyFacts(deal, choice, tone);
  const saved = await updateDeal(id, (d) => {
    d.decision = { choice, tone, reply, draftedAt: new Date().toISOString(), approvedAt: null };
  });
  return json({ deal: saved, check: { unknown: unknownAmounts(reply, allowed), allowed } });
});
