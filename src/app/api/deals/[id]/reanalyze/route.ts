import { getOwnedDeal, updateDeal } from '@/server/deals-repo';
import { HttpError } from '@/server/errors';
import { json, param, requireWorkspace, route, type Ctx } from '@/server/http';
import { requireModel } from '@/server/llm';
import { reanalyze } from '@/server/orchestrator';
import { takeModelCall } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

/** Reads the brief again (replaces the extracted scope). */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const ws = requireWorkspace(req);
  const id = await param(ctx, 'id');
  await getOwnedDeal(id, ws);
  requireModel();
  takeModelCall(ws, 2);
  const deal = await updateDeal(id, (d) => {
    if (d.stage === 'analyzing') throw new HttpError(409, 'Panga is already reading this brief.', 'busy');
    if (d.decision?.approvedAt) throw new HttpError(409, 'This deal is already decided.', 'decided');
    d.stage = 'analyzing';
    d.error = null;
  });
  await reanalyze(id, deal.workflowId);
  return json({ deal });
});
