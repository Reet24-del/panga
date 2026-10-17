import { z } from 'zod';
import { newId } from '@/lib/ids';
import type { Turn } from '@/lib/types';
import { getOwnedDeal, updateDeal } from '@/server/deals-repo';
import { HttpError } from '@/server/errors';
import { json, param, readBody, requireWorkspace, route, type Ctx } from '@/server/http';
import { clientTurn } from '@/server/pipeline';
import { takeModelCall } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({ text: z.string().trim().min(1, 'Say something first.').max(1000) });
const MAX_TURNS = 30;

/** The freelancer answers; the simulated client replies. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string; rid: string }>) => {
  const ws = requireWorkspace(req);
  const id = await param(ctx, 'id');
  const rid = await param(ctx, 'rid');
  const { text } = await readBody(req, Body);
  const deal = await getOwnedDeal(id, ws);
  const rehearsal = deal.rehearsals.find((r) => r.id === rid);
  if (!rehearsal) throw new HttpError(404, 'That rehearsal no longer exists.', 'not_found');
  if (rehearsal.status !== 'live') throw new HttpError(409, 'This call has ended. Start a new one.', 'ended');
  if (rehearsal.mode !== 'text') throw new HttpError(409, 'This is a voice call.', 'voice');
  if (rehearsal.turns.length >= MAX_TURNS) throw new HttpError(409, 'That was a long call. End it to see the replay.', 'too_long');
  takeModelCall(ws);

  const mine: Turn = { id: newId('t'), role: 'freelancer', text, requirementId: null };
  const reply = await clientTurn(deal, { ...rehearsal, turns: [...rehearsal.turns, mine] });
  const saved = await updateDeal(id, (d) => {
    const r = d.rehearsals.find((x) => x.id === rid);
    if (!r || r.status !== 'live') throw new HttpError(409, 'This call has ended.', 'ended');
    r.turns.push(mine, reply);
  });
  return json({ deal: saved });
});
