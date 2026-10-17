import { z } from 'zod';
import { getOwnedDeal, updateDeal } from '@/server/deals-repo';
import { HttpError } from '@/server/errors';
import { json, param, readBody, requireWorkspace, route, type Ctx } from '@/server/http';
import { decisionApproved } from '@/server/orchestrator';

export const dynamic = 'force-dynamic';

const Body = z.object({ reply: z.string().trim().min(1, 'The reply is empty.').max(4000) });

/** The freelancer approves the (possibly edited) reply. Panga never sends it. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const ws = requireWorkspace(req);
  const id = await param(ctx, 'id');
  const { reply } = await readBody(req, Body);
  await getOwnedDeal(id, ws);
  const saved = await updateDeal(id, (d) => {
    if (!d.decision) throw new HttpError(409, 'Draft a reply first.', 'no_draft');
    if (d.decision.approvedAt) return;
    d.decision.reply = reply;
    d.decision.approvedAt = new Date().toISOString();
    d.stage = 'decided';
  });
  await decisionApproved(id, saved.workflowId, saved.decision!.choice);
  return json({ deal: saved });
});
