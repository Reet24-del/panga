import { z } from 'zod';
import { newId } from '@/lib/ids';
import type { Rehearsal } from '@/lib/types';
import { createSimCall, getOwnedDeal, updateDeal } from '@/server/deals-repo';
import { signedConversationUrl } from '@/server/elevenlabs';
import { integrations } from '@/server/env';
import { HttpError } from '@/server/errors';
import { json, param, readBody, requireWorkspace, route, type Ctx } from '@/server/http';
import { requireModel } from '@/server/llm';
import { clientTurn } from '@/server/pipeline';
import { takeModelCall } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  mode: z.enum(['text', 'voice']).default('text'),
  difficulty: z.enum(['reasonable', 'pushy', 'hell']).default('hell'),
});

/** "Bring on the client": starts a rehearsal and gets the simulated client's opening line. */
export const POST = route(async (req: Request, ctx: Ctx<{ id: string }>) => {
  const ws = requireWorkspace(req);
  const id = await param(ctx, 'id');
  const { mode, difficulty } = await readBody(req, Body);
  requireModel();
  if (mode === 'voice' && !integrations().voice) {
    throw new HttpError(501, 'Voice rehearsal is switched off on this server. Rehearse by text, or set up ElevenLabs.', 'no_voice');
  }
  const deal = await getOwnedDeal(id, ws);
  if (deal.stage === 'analyzing' || deal.stage === 'analysis_failed') throw new HttpError(409, 'Let Panga read the brief first.', 'not_ready');
  if (!deal.requirements.some((r) => r.status !== 'removed' && r.evidence.length > 0)) {
    throw new HttpError(409, 'The simulated client needs at least one work item backed by a client quote.', 'no_scope');
  }
  takeModelCall(ws);

  const now = new Date().toISOString();
  const rehearsal: Rehearsal = { id: newId('r'), mode, difficulty, turns: [], status: 'live', startedAt: now, endedAt: null, replay: null };
  rehearsal.turns.push(await clientTurn(deal, rehearsal));

  let voice: { signedUrl: string; callToken: string; firstMessage: string } | null = null;
  if (mode === 'voice') {
    const callToken = newId('call');
    const signedUrl = await signedConversationUrl();
    await createSimCall(callToken, deal.id, rehearsal.id, 60);
    voice = { signedUrl, callToken, firstMessage: rehearsal.turns[0].text };
  }

  const saved = await updateDeal(id, (d) => {
    for (const r of d.rehearsals) {
      if (r.status === 'live') {
        r.status = 'ended';
        r.endedAt = now;
      }
    }
    d.rehearsals = [...d.rehearsals, rehearsal].slice(-10);
  });
  return json({ deal: saved, rehearsalId: rehearsal.id, voice }, 201);
});
