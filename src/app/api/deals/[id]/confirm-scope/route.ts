import { getOwnedDeal, updateDeal } from '@/server/deals-repo';
import { json, param, requireWorkspace, route, type Ctx } from '@/server/http';
import { scopeConfirmed } from '@/server/orchestrator';

export const dynamic = 'force-dynamic';

/** The freelancer says the scope is right; Panga remembers their corrections. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const ws = requireWorkspace(req);
  const id = await param(ctx, 'id');
  await getOwnedDeal(id, ws);
  const deal = await updateDeal(id, (d) => {
    d.scopeConfirmedAt = new Date().toISOString();
  });
  await scopeConfirmed(id, deal.workflowId);
  return json({ deal });
});
