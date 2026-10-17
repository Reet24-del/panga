// Panga's "Custom LLM" endpoint for the ElevenLabs voice agent. ElevenLabs
// handles speech in and out; this endpoint decides what the simulated client
// says, using Gemma on DigitalOcean with the deal's own brief as the persona.
// OpenAI Chat Completions format, streamed as server-sent events.

import { createHash, timingSafeEqual } from 'node:crypto';
import { newId } from '@/lib/ids';
import { TagStripper, guessRequirement } from '@/lib/rehearsal';
import type { Turn } from '@/lib/types';
import { getDeal, resolveSimCall, updateDeal } from '@/server/deals-repo';
import { env } from '@/server/env';
import { streamText } from '@/server/llm';
import { rehearsalMessages, rehearsalPersona } from '@/server/pipeline';
import { takeModelCall } from '@/server/ratelimit';
import { report } from '@/server/report';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface IncomingMessage {
  role?: string;
  content?: unknown;
}

interface Body {
  messages?: IncomingMessage[];
  stream?: boolean;
  elevenlabs_extra_body?: Record<string, unknown>;
}

function sameSecret(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function textOf(m: IncomingMessage): string {
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) {
    return m.content.map((p) => (p && typeof p === 'object' && 'text' in p ? String((p as { text: unknown }).text) : '')).join(' ');
  }
  return '';
}

function callToken(body: Body): string | null {
  const extra = body.elevenlabs_extra_body?.panga_call;
  if (typeof extra === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(extra)) return extra;
  for (const m of body.messages ?? []) {
    if (m.role !== 'system') continue;
    const match = textOf(m).match(/PANGA_CALL[:=]\s*([A-Za-z0-9_-]{8,80})/);
    if (match) return match[1];
  }
  return null;
}

function openAiError(status: number, message: string): Response {
  return Response.json({ error: { message, type: 'invalid_request_error' } }, { status });
}

export async function POST(req: Request): Promise<Response> {
  const auth = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim() || (req.headers.get('x-panga-sim-key') ?? '');
  if (!env.simSecret || !auth || !sameSecret(auth, env.simSecret)) return openAiError(401, 'Unauthorized');

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return openAiError(400, 'Invalid JSON');
  }
  const token = callToken(body);
  const call = token ? await resolveSimCall(token) : null;
  if (!call) return openAiError(404, 'Unknown or expired rehearsal call');
  const deal = await getDeal(call.dealId);
  const rehearsal = deal?.rehearsals.find((r) => r.id === call.rehearsalId);
  if (!deal || !rehearsal) return openAiError(404, 'Rehearsal not found');

  // ElevenLabs sends the whole conversation each time; record any new freelancer lines.
  const spoken = (body.messages ?? []).filter((m) => m.role === 'user').map(textOf).map((t) => t.trim()).filter(Boolean);
  const known = rehearsal.turns.filter((t) => t.role === 'freelancer').length;
  const fresh: Turn[] = spoken.slice(known).map((text) => ({ id: newId('t'), role: 'freelancer', text: text.slice(0, 1000), requirementId: null }));
  const turns = [...rehearsal.turns, ...fresh];

  try {
    takeModelCall(`sim:${deal.workspaceId}`);
  } catch {
    return openAiError(429, 'Rate limited');
  }

  const ids = new Set(deal.requirements.map((r) => r.id));
  const stripper = new TagStripper(ids);
  const persona = rehearsalPersona(deal, rehearsal.difficulty);
  const id = `chatcmpl-${newId('x')}`;
  const created = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();

  const save = async (spokenText: string) => {
    const text = spokenText.replace(/\s+/g, ' ').trim();
    await updateDeal(deal.id, (d) => {
      const r = d.rehearsals.find((x) => x.id === rehearsal.id);
      if (!r || r.status !== 'live') return;
      const have = r.turns.filter((t) => t.role === 'freelancer').length;
      r.turns.push(...fresh.slice(Math.max(0, have - known)));
      if (text) r.turns.push({ id: newId('t'), role: 'client', text, requirementId: stripper.requirementId ?? guessRequirement(text, d.requirements) });
    }).catch((err) => report(err, { step: 'sim.save' }));
  };

  const generate = () =>
    streamText('clientSimulator', rehearsalMessages(turns), { instructions: persona, temperature: 0.8, maxTokens: 160, timeoutMs: 30_000 });

  if (body.stream === false) {
    let full = '';
    try {
      for await (const chunk of await generate()) full += stripper.feed(chunk);
      full += stripper.flush();
    } catch (err) {
      report(err, { step: 'sim.generate' });
      full = 'Sorry, could you say that again?';
    }
    await save(full);
    return Response.json({
      id,
      object: 'chat.completion',
      created,
      model: 'panga-client',
      choices: [{ index: 0, message: { role: 'assistant', content: full.trim() }, finish_reason: 'stop' }],
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (delta: Record<string, string>, finish: string | null = null) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created, model: 'panga-client', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`),
        );
      let full = '';
      send({ role: 'assistant', content: '' });
      try {
        for await (const chunk of await generate()) {
          const out = stripper.feed(chunk);
          if (out) {
            full += out;
            send({ content: out });
          }
        }
        const rest = stripper.flush();
        if (rest) {
          full += rest;
          send({ content: rest });
        }
      } catch (err) {
        report(err, { step: 'sim.generate' });
        const fallback = full ? '' : 'Sorry, could you say that again?';
        if (fallback) send({ content: fallback });
        full += fallback;
      }
      send({}, 'stop');
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
      await save(full);
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}
