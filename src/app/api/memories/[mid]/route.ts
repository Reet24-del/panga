import { json, param, requireWorkspace, route, type Ctx } from '@/server/http';
import { forgetMemory } from '@/server/memory';

export const dynamic = 'force-dynamic';

export const DELETE = route(async (req: Request, ctx: Ctx<{ mid: string }>) => {
  const ws = requireWorkspace(req);
  await forgetMemory(ws, await param(ctx, 'mid'));
  return json({ deleted: true });
});
