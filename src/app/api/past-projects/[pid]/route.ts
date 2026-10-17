import { HttpError } from '@/server/errors';
import { json, param, requireWorkspace, route, type Ctx } from '@/server/http';
import { deleteProject } from '@/server/projects-repo';

export const dynamic = 'force-dynamic';

export const DELETE = route(async (req: Request, ctx: Ctx<{ pid: string }>) => {
  const ws = requireWorkspace(req);
  if (!(await deleteProject(ws, await param(ctx, 'pid')))) throw new HttpError(404, 'Project not found.', 'not_found');
  return json({ deleted: true });
});
