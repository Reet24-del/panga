import { fileKeyBelongsTo } from '@/server/spaces';
import { insertDeal, listDeals } from '@/server/deals-repo';
import { HttpError } from '@/server/errors';
import { json, readBody, requireWorkspace, route } from '@/server/http';
import { requireModel } from '@/server/llm';
import { getPreferences } from '@/server/memory';
import { startAnalysis } from '@/server/orchestrator';
import { newDeal } from '@/server/pipeline';
import { takeModelCall } from '@/server/ratelimit';
import { NewDealSchema } from '@/server/schemas';

export const dynamic = 'force-dynamic';

export const GET = route(async (req: Request) => {
  const ws = requireWorkspace(req);
  return json({ deals: await listDeals(ws) });
});

/** Opens a deal file and starts reading the brief in the background. */
export const POST = route(async (req: Request) => {
  const ws = requireWorkspace(req);
  const body = await readBody(req, NewDealSchema);
  try {
    requireModel();
  } catch {
    throw new HttpError(503, "Panga can't read briefs yet: the DigitalOcean model key isn't configured on this server.", 'no_model');
  }
  for (const s of body.sources) {
    if (s.file && !fileKeyBelongsTo(s.file.key, ws)) throw new HttpError(400, 'That uploaded file belongs to another workspace.', 'bad_file');
  }
  takeModelCall(ws, 2);
  const prefs = await getPreferences(ws);
  const deal = newDeal({
    workspaceId: ws,
    title: body.title,
    currency: body.currency,
    offeredPrice: body.offeredPrice,
    minimumRate: prefs.currency === body.currency ? prefs.minimumRate : null,
    sources: body.sources,
  });
  await insertDeal(deal);
  const mode = await startAnalysis(deal.id);
  return json({ deal, mode }, 201);
});
