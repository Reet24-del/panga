import { z } from 'zod';
import { getOwnedDeal, updateDeal } from '@/server/deals-repo';
import { HttpError } from '@/server/errors';
import { json, param, readBody, requireWorkspace, route, type Ctx } from '@/server/http';

export const dynamic = 'force-dynamic';

const Body = z.object({ resolved: z.boolean() });

/** Marks a commitment from the replay as handled (turned into a scope decision). */
export const PATCH = route(async (req: Request, ctx: Ctx<{ id: string; rid: string; cid: string }>) => {
  const ws = requireWorkspace(req);
  const id = await param(ctx, 'id');
  const rid = await param(ctx, 'rid');
  const cid = await param(ctx, 'cid');
  const { resolved } = await readBody(req, Body);
  await getOwnedDeal(id, ws);
  const deal = await updateDeal(id, (d) => {
    const c = d.rehearsals.find((r) => r.id === rid)?.replay?.commitments.find((x) => x.id === cid);
    if (!c) throw new HttpError(404, 'That commitment no longer exists.', 'not_found');
    c.resolved = resolved;
  });
  return json({ deal });
});
