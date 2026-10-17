import { deleteDeal, getOwnedDeal, updateDeal } from '@/server/deals-repo';
import { HttpError } from '@/server/errors';
import { json, param, readBody, requireWorkspace, route, type Ctx } from '@/server/http';
import { DealPatchSchema, applyPatch } from '@/server/schemas';
import { deleteFiles } from '@/server/spaces';

export const dynamic = 'force-dynamic';

type C = Ctx<{ id: string }>;

export const GET = route(async (req: Request, ctx: C) => {
  const ws = requireWorkspace(req);
  return json({ deal: await getOwnedDeal(await param(ctx, 'id'), ws) });
});

/** Saves the freelancer's edits to scope, questions, price and assumptions. */
export const PATCH = route(async (req: Request, ctx: C) => {
  const ws = requireWorkspace(req);
  const id = await param(ctx, 'id');
  const patch = await readBody(req, DealPatchSchema, 400_000);
  await getOwnedDeal(id, ws);
  const deal = await updateDeal(id, (d) => {
    if (d.stage === 'analyzing') throw new HttpError(409, 'Panga is still reading this brief. Edit it in a moment.', 'busy');
    applyPatch(d, patch);
  });
  return json({ deal });
});

/** Deletes the deal file, its stored uploads, call tokens and library entry. */
export const DELETE = route(async (req: Request, ctx: C) => {
  const ws = requireWorkspace(req);
  const id = await param(ctx, 'id');
  const deal = await getOwnedDeal(id, ws);
  await deleteDeal(id, ws);
  await deleteFiles(deal.sources.map((s) => s.file?.key).filter((k): k is string => Boolean(k)));
  return json({ deleted: true });
});
