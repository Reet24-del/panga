import { z } from 'zod';
import { newId } from '@/lib/ids';
import type { Turn } from '@/lib/types';
import { getOwnedDeal, updateDeal } from '@/server/deals-repo';
import { HttpError } from '@/server/errors';
import { json, param, readBody, requireWorkspace, route, type Ctx } from '@/server/http';
import { rehearsalEnded } from '@/server/orchestrator';
import { takeModelCall } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

// A voice call's transcript is recorded server-side as it happens; the browser
// may also send what it heard, which fills any turns the server missed.
const Body = z.object({
  transcript: z
    .array(z.object({ role: z.enum(['client', 'freelancer']), text: z.string().trim().min(1).max(1000) }))
    .max(80)
    .optional(),
});

/** Ends the call and starts the replay analysis (commitment detection). */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string; rid: string }>) => {
  const ws = requireWorkspace(req);
  const id = await param(ctx, 'id');
  const rid = await param(ctx, 'rid');
  const { transcript } = await readBody(req, Body);
  await getOwnedDeal(id, ws);
  let analyse = false;
  const saved = await updateDeal(id, (d) => {
    const r = d.rehearsals.find((x) => x.id === rid);
    if (!r) throw new HttpError(404, 'That rehearsal no longer exists.', 'not_found');
    if (r.status === 'ended') return;
    if (r.mode === 'voice' && transcript && transcript.length > r.turns.length) {
      const known = new Map(r.turns.map((t) => [`${t.role}:${t.text}`, t]));
      r.turns = transcript.map((t): Turn => known.get(`${t.role}:${t.text}`) ?? { id: newId('t'), role: t.role, text: t.text, requirementId: null });
    }
    r.status = 'ended';
    r.endedAt = new Date().toISOString();
    analyse = r.turns.some((t) => t.role === 'freelancer');
    r.replay = { status: analyse ? 'pending' : 'ready', commitments: [], error: null };
  });
  if (analyse) {
    takeModelCall(ws);
    await rehearsalEnded(id, saved.workflowId, rid);
  }
  return json({ deal: saved });
});
