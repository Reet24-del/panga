import { z } from 'zod';
import { getOwnedDeal, updateDeal } from '@/server/deals-repo';
import { HttpError } from '@/server/errors';
import { json, param, readBody, requireWorkspace, route, type Ctx } from '@/server/http';
import { requireModel } from '@/server/llm';
import { researchRequirement } from '@/server/pipeline';
import { takeModelCall } from '@/server/ratelimit';
import { span } from '@/server/report';
import { env } from '@/server/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({ requirementId: z.string().regex(/^R\d{1,3}$/) });

/** Looks up an unfamiliar requirement on the web (SerpApi) and explains it with sources. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const ws = requireWorkspace(req);
  const id = await param(ctx, 'id');
  const { requirementId } = await readBody(req, Body);
  if (!env.serpApiKey) throw new HttpError(501, 'Research is switched off on this server (no SerpApi key).', 'no_research');
  requireModel();
  takeModelCall(ws);
  const deal = await getOwnedDeal(id, ws);
  const research = await span('panga.research', { requirement: requirementId }, () => researchRequirement(deal, requirementId));
  const saved = await updateDeal(id, (d) => {
    const r = d.requirements.find((x) => x.id === requirementId);
    if (r) r.research = research;
  });
  return json({ deal: saved });
});
