// Calls to Gemma through Mastra agents, with clear errors and a JSON repair pass.

import type { z } from 'zod';
import { extractJson } from '@/lib/json';
import { getMastra, type AgentKey } from '@/mastra';
import { env } from './env';
import { ConfigurationError, HttpError, ModelOutputError, errorMessage } from './errors';

export type ChatMessage = { role: 'user'; content: string } | { role: 'assistant'; content: string };

export interface CallOptions {
  /** Replaces the agent's standing instructions for this call (one system message). */
  instructions?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export function requireModel(): void {
  if (!env.modelKey) {
    throw new ConfigurationError('Panga needs a DigitalOcean model access key to read briefs. Set DO_MODEL_ACCESS_KEY.');
  }
}

/** Turns transport errors into messages a freelancer (or the deployer) can act on. */
export function friendlyModelError(err: unknown): Error {
  if (err instanceof ConfigurationError || err instanceof HttpError || err instanceof ModelOutputError) return err;
  const raw = errorMessage(err);
  const status = Number((err as { statusCode?: number; status?: number })?.statusCode ?? (err as { status?: number })?.status ?? raw.match(/\b(401|403|404|408|429|5\d\d)\b/)?.[1]);
  if (status === 401 || status === 403) return new ConfigurationError('DigitalOcean rejected the model access key. Check DO_MODEL_ACCESS_KEY.');
  if (status === 404) return new ConfigurationError(`The model "${env.modelId}" was not found on DigitalOcean. Check PANGA_MODEL.`);
  if (status === 429) return new HttpError(503, 'The model is busy right now. Try again in a minute.', 'model_busy');
  if (/abort|timeout|timed out/i.test(raw)) return new HttpError(504, 'The model took too long to answer. Try again.', 'model_timeout');
  if (/ECONNREFUSED|ENOTFOUND|fetch failed|network/i.test(raw)) return new HttpError(502, "Couldn't reach the model endpoint. Check DO_INFERENCE_BASE_URL.", 'model_unreachable');
  return new HttpError(502, `The model call failed: ${raw.slice(0, 200)}`, 'model_error');
}

function settings(opts: CallOptions) {
  return {
    instructions: opts.instructions,
    modelSettings: { temperature: opts.temperature ?? 0.3, maxOutputTokens: opts.maxTokens ?? 1500 },
    abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
  };
}

export interface TextResult {
  text: string;
  ms: number;
}

export async function generateText(agent: AgentKey, messages: ChatMessage[], opts: CallOptions = {}): Promise<TextResult> {
  requireModel();
  const started = Date.now();
  let result: { text?: string; error?: unknown };
  try {
    result = (await getMastra().getAgent(agent).generate(messages, settings(opts))) as { text?: string; error?: unknown };
  } catch (err) {
    throw friendlyModelError(err);
  }
  if (result.error) throw friendlyModelError(result.error);
  const text = (result.text ?? '').trim();
  if (!text) throw new ModelOutputError('The model returned an empty answer.');
  return { text, ms: Date.now() - started };
}

/** Streams text deltas. Used by the voice rehearsal, where the first words matter most. */
export async function streamText(agent: AgentKey, messages: ChatMessage[], opts: CallOptions = {}): Promise<AsyncIterable<string>> {
  requireModel();
  try {
    const output = await getMastra().getAgent(agent).stream(messages, settings(opts));
    return output.textStream as unknown as AsyncIterable<string>;
  } catch (err) {
    throw friendlyModelError(err);
  }
}

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

function check<T>(text: string, schema: z.ZodType<T>): Checked<T> {
  const parsed = extractJson(text);
  if (!parsed.ok) return parsed;
  const result = schema.safeParse(parsed.value);
  if (result.success) return { ok: true, value: result.data };
  const detail = result.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
    .join('; ');
  return { ok: false, error: detail };
}

export interface JsonResult<T> {
  value: T;
  repaired: boolean;
  ms: number;
}

/** Asks for JSON; if the answer doesn't validate, shows the model its error once. */
export async function generateJson<T>(agent: AgentKey, prompt: string, schema: z.ZodType<T>, opts: CallOptions = {}): Promise<JsonResult<T>> {
  const first = await generateText(agent, [{ role: 'user', content: prompt }], opts);
  const attempt = check(first.text, schema);
  if (attempt.ok) return { value: attempt.value, repaired: false, ms: first.ms };
  const second = await generateText(
    agent,
    [
      { role: 'user', content: prompt },
      { role: 'assistant', content: first.text.slice(0, 12_000) },
      { role: 'user', content: `That reply could not be used (${attempt.error}). Reply again with only the corrected JSON object.` },
    ],
    opts,
  );
  const retry = check(second.text, schema);
  if (retry.ok) return { value: retry.value, repaired: true, ms: first.ms + second.ms };
  throw new ModelOutputError(`The model's answer could not be used (${retry.error}).`);
}
