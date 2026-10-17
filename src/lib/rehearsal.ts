// Shared rehearsal helpers: which gaps the simulated client presses on, and
// how its tagged replies are parsed. Tags look like "[R4] Uploading the 200
// products is included, right?" and are never shown or spoken.

import { stripThinking } from './json';
import { formatMoney } from './format';
import type { Category, Currency, Difficulty, Question, Requirement } from './types';

export interface PressurePoint {
  requirementId: string | null;
  title: string;
  quote: string | null;
  angle: string;
}

const ANGLES: Record<Category, string> = {
  support: 'assume changes after launch are free and unlimited',
  content: 'assume the freelancer will enter or upload all of it',
  integration: 'assume setup, testing and any fees are part of the price',
  design: 'ask for extra rounds or custom touches at no cost',
  build: 'ask for "one small extra" on top of it',
  other: 'assume it is included without discussing it',
};

export interface PressureInput {
  requirements: Requirement[];
  questions: Question[];
  offeredPrice: number | null;
  currency: Currency;
}

/**
 * Ranks the gaps worth pushing on. Only evidenced requirements qualify: the
 * simulated client may not raise work the real client never mentioned.
 */
export function buildPressurePlan(input: PressureInput, limit = 5): PressurePoint[] {
  const eligible = input.requirements.filter((r) => r.status !== 'removed' && r.evidence.length > 0);
  const openFor = new Set(
    input.questions.filter((q) => q.requirementId && (q.state === 'open' || q.state === 'ask_client')).map((q) => q.requirementId!),
  );
  const score = (r: Requirement) =>
    (openFor.has(r.id) ? 4 : 0) + (r.hidden ? 2 : 0) + (r.category === 'support' || r.category === 'content' ? 1 : 0);
  const ranked = eligible
    .map((r, index) => ({ r, index, s: score(r) }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map(({ r }) => r);

  const points: PressurePoint[] = ranked.slice(0, Math.max(0, limit - (input.offeredPrice ? 1 : 0))).map((r) => ({
    requirementId: r.id,
    title: r.title,
    quote: r.evidence[0]?.quote ?? null,
    angle: ANGLES[r.category],
  }));
  if (input.offeredPrice) {
    points.push({
      requirementId: null,
      title: 'The budget',
      quote: null,
      angle: `anchor on the original ${formatMoney(input.offeredPrice, input.currency)} and resist any increase`,
    });
  }
  return points;
}

export interface ParsedTurn {
  text: string;
  requirementId: string | null;
}

const TAG = /^\s*\[\s*(R\d+|PRICE|NONE|-|—)\s*\]\s*/i;

function tidy(text: string): string {
  return text
    .replace(/\[\s*R\d+\s*\]/gi, '')
    .replace(/^\s*(client|simulated client)\s*:\s*/i, '')
    .replace(/^[\s,.;:–—-]+/, '')
    .replace(/^["“](.*)["”]$/s, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);
}

export function parseClientTurn(raw: string, validIds: Set<string>): ParsedTurn {
  const text = stripThinking(raw).trim();
  const match = text.match(TAG);
  if (!match) return { text: tidy(text), requirementId: null };
  const tag = match[1].toUpperCase();
  return { text: tidy(text.slice(match[0].length)), requirementId: validIds.has(tag) ? tag : null };
}

/**
 * Streaming version for voice: holds back the first characters until the tag
 * is known, so a tag is never spoken aloud. feed() returns text safe to emit.
 */
export class TagStripper {
  private buffer = '';
  private resolved = false;
  private inThink = false;
  requirementId: string | null = null;

  constructor(private readonly validIds: Set<string>) {}

  feed(chunk: string): string {
    let text = chunk;
    if (this.inThink || text.includes('<think>')) {
      this.buffer += text;
      const close = this.buffer.indexOf('</think>');
      if (close < 0) {
        this.inThink = true;
        return '';
      }
      this.inThink = false;
      text = this.buffer.slice(close + '</think>'.length);
      this.buffer = '';
    }
    if (this.resolved) return text;
    this.buffer += text;
    const trimmed = this.buffer.trimStart();
    if (!trimmed) return '';
    if (!trimmed.startsWith('[')) return this.release(trimmed);
    const close = trimmed.indexOf(']');
    if (close < 0) return trimmed.length > 24 ? this.release(trimmed) : '';
    const tag = trimmed.slice(1, close).trim().toUpperCase();
    this.requirementId = this.validIds.has(tag) ? tag : null;
    return this.release(trimmed.slice(close + 1).trimStart());
  }

  flush(): string {
    if (this.resolved || this.inThink) return '';
    return this.release(this.buffer.trimStart());
  }

  private release(text: string): string {
    this.resolved = true;
    this.buffer = '';
    return text;
  }
}

const STOP = new Set('that this with your will from have they them just like also need needs right included price basic think'.split(' '));

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9ऀ-ॿ]+/)
      .filter((w) => (w.length >= 4 || /^\d+$/.test(w)) && !STOP.has(w))
      .map((w) => w.replace(/s$/, '')),
  );
}

/**
 * When the model forgets the tag, links the line to the work item whose name
 * and client quote share the most words with it. Needs at least two shared words.
 */
export function guessRequirement(text: string, requirements: Requirement[]): string | null {
  const said = words(text);
  let best: { id: string; score: number } | null = null;
  for (const r of requirements) {
    if (r.status === 'removed' || !r.evidence.length) continue;
    const vocab = words(`${r.title} ${r.evidence.map((e) => e.quote).join(' ')}`);
    let score = 0;
    for (const w of said) if (vocab.has(w)) score++;
    if (score >= 2 && (!best || score > best.score)) best = { id: r.id, score };
  }
  return best?.id ?? null;
}

export const DIFFICULTIES: Record<Difficulty, { label: string; blurb: string }> = {
  reasonable: { label: 'Reasonable', blurb: 'Polite and flexible. Accepts a clear boundary the first time.' },
  pushy: { label: 'Pushy', blurb: 'Pushes twice on each gap and keeps mentioning the budget.' },
  hell: { label: 'From Hell', blurb: 'Assumes everything is included, anchors on price, never lets a gap go easily.' },
};
