import { z } from 'zod';
import { getOwnedDeal, updateDeal } from '@/server/deals-repo';
import { HttpError } from '@/server/errors';
import { json, param, readBody, requireWorkspace, route, type Ctx } from '@/server/http';
import { outcomeRecorded } from '@/server/orchestrator';

export const dynamic = 'force-dynamic';

const Body = z.object({
  package: z.enum(['starter', 'full']),
  actualHours: z.number().finite().min(0).max(5000),
  lesson: z.string().trim().max(600).default(''),
});

/** How it really went. Becomes a past project, so the next similar brief is quoted better. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const ws = requireWorkspace(req);
  const id = await param(ctx, 'id');
  const body = await readBody(req, Body);
  await getOwnedDeal(id, ws);
  const saved = await updateDeal(id, (d) => {
    if (!d.decision?.approvedAt || d.decision.choice === 'walk') throw new HttpError(409, 'Only accepted deals have an outcome.', 'no_project');
    d.outcome = { package: body.package, actualHours: body.actualHours, lesson: body.lesson, recordedAt: new Date().toISOString() };
    d.outcomeRequestedAt = null;
  });
  await outcomeRecorded(id, saved.workflowId);
  return json({ deal: saved });
});
