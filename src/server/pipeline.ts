// The deal's steps. Each runs either inline (in the web process) or as a
// Temporal activity in the worker; the logic is the same either way.

import { dealPackages, defaultAssumptions, isPriced } from '@/lib/economics';
import { formatHours } from '@/lib/format';
import { newId } from '@/lib/ids';
import { stripThinking } from '@/lib/json';
import { buildPressurePlan, guessRequirement, parseClientTurn } from '@/lib/rehearsal';
import type { Choice, Currency, Deal, Difficulty, Rehearsal, Research, SourceKind, StoredFile, Tone, Turn } from '@/lib/types';
import { getDeal, updateDeal } from './deals-repo';
import { env } from './env';
import { ConfigurationError, HttpError, ModelOutputError } from './errors';
import { generateJson, generateText, type ChatMessage } from './llm';
import { getPreferences, recallForBrief, rememberCorrections, savePreferences } from './memory';
import { findSimilarProjects, upsertProjectForDeal } from './projects-repo';
import {
  CALL_OPENING,
  clientPersona,
  extractionPrompt,
  looksHinglish,
  replayPrompt,
  replyPrompt,
  researchPrompt,
  type ReplyFacts,
} from './prompts';
import { report, setSpanAttributes, span } from './report';
import { ExtractionSchema, ReplaySchema, buildCommitments, buildScope } from './scope';
import { webSearch } from './serp';

// ---------- Creation ----------

const DEFAULT_LABEL: Record<SourceKind, string> = { brief: 'Brief', chat: 'Client messages', voice: 'Voice note', note: 'Notes' };

export interface NewDealInput {
  workspaceId: string;
  title: string;
  currency: Currency;
  offeredPrice: number | null;
  minimumRate: number | null;
  sources: { kind: SourceKind; label: string; text: string; file?: StoredFile | null }[];
}

export function newDeal(input: NewDealInput): Deal {
  const now = new Date().toISOString();
  return {
    id: newId('d'),
    workspaceId: input.workspaceId,
    title: input.title.trim().slice(0, 120) || 'Untitled deal',
    createdAt: now,
    updatedAt: now,
    stage: 'analyzing',
    error: null,
    currency: input.currency,
    offeredPrice: input.offeredPrice && input.offeredPrice > 0 ? Math.round(input.offeredPrice) : null,
    priceEvidence: null,
    summary: '',
    sources: input.sources.map((s, i) => ({
      id: `S${i + 1}`,
      kind: s.kind,
      label: s.label.trim().slice(0, 60) || DEFAULT_LABEL[s.kind],
      text: s.text.trim(),
      file: s.file ?? null,
    })),
    requirements: [],
    questions: [],
    assumptions: defaultAssumptions(input.currency, input.minimumRate),
    rehearsals: [],
    decision: null,
    outcome: null,
    outcomeRequestedAt: null,
    similar: [],
    analysis: null,
    extracted: [],
    scopeConfirmedAt: null,
    workflowId: null,
  };
}

async function load(dealId: string): Promise<Deal> {
  const deal = await getDeal(dealId);
  // Non-retryable: retrying won't bring a deleted deal back.
  if (!deal) throw new ConfigurationError(`Deal ${dealId} no longer exists.`);
  return deal;
}

// ---------- Analysis ----------

export async function analyzeDeal(dealId: string): Promise<void> {
  const deal = await load(dealId);
  const allText = deal.sources.map((s) => s.text).join('\n\n');
  const memories = await recallForBrief(deal.workspaceId, allText);
  const prompt = extractionPrompt({
    sources: deal.sources,
    memories,
    statedPrice: deal.offeredPrice ? { amount: deal.offeredPrice, currency: deal.currency } : null,
  });
  const result = await generateJson('scopeAnalyst', prompt, ExtractionSchema, { temperature: 0.2, maxTokens: 4000, timeoutMs: 170_000 });

  const scope = await span('panga.verify_quotes', { deal: dealId }, async () => {
    const built = buildScope(deal.sources, result.value, { statedPrice: deal.offeredPrice, assumptions: deal.assumptions });
    setSpanAttributes({
      'panga.quotes_checked': built.quotesChecked,
      'panga.quotes_rejected': built.quotesRejected,
      'panga.requirements': built.requirements.length,
      'panga.inferred': built.requirements.filter((r) => r.status === 'inferred').length,
    });
    return built;
  });

  const searchText = [scope.summary, ...scope.requirements.map((r) => `${r.title}. ${r.detail}`)].join('\n');
  const similar = await findSimilarProjects(deal.workspaceId, searchText, 3, deal.id).catch((err) => {
    report(err, { step: 'similar' });
    return [];
  });

  await updateDeal(dealId, (d) => {
    d.summary = scope.summary;
    d.requirements = scope.requirements;
    d.questions = scope.questions;
    d.offeredPrice = scope.offeredPrice;
    d.priceEvidence = scope.priceEvidence;
    d.extracted = scope.requirements.map((r) => ({ id: r.id, title: r.title, suggestedHours: r.suggestedHours }));
    d.similar = similar;
    d.stage = d.decision?.approvedAt ? d.stage : 'review';
    d.error = null;
    d.scopeConfirmedAt = null;
    d.analysis = {
      model: env.modelId,
      ms: result.ms,
      quotesChecked: scope.quotesChecked,
      quotesRejected: scope.quotesRejected,
      repaired: result.repaired,
      memoriesUsed: memories.length,
    };
  });
}

export async function markAnalysisFailed(dealId: string, message: string): Promise<void> {
  await updateDeal(dealId, (d) => {
    d.stage = 'analysis_failed';
    d.error = message.slice(0, 400);
  }).catch((err) => report(err, { step: 'markAnalysisFailed' }));
}

// ---------- Rehearsal ----------

export function rehearsalPersona(deal: Deal, difficulty: Difficulty): string {
  const plan = buildPressurePlan({
    requirements: deal.requirements,
    questions: deal.questions,
    offeredPrice: deal.offeredPrice,
    currency: deal.currency,
  });
  return clientPersona({
    summary: deal.summary,
    offeredPrice: deal.offeredPrice,
    currency: deal.currency,
    requirements: deal.requirements,
    openQuestions: deal.questions.filter((q) => q.state === 'open' || q.state === 'ask_client').map((q) => q.text),
    plan,
    difficulty,
    hinglish: looksHinglish(deal.sources.map((s) => s.text).join(' ')),
  });
}

/** Chat history for the client simulator: the simulated client is the assistant. */
export function rehearsalMessages(turns: Turn[]): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'user', content: CALL_OPENING }];
  for (const t of turns) {
    const next: ChatMessage =
      t.role === 'client' ? { role: 'assistant', content: `[${t.requirementId ?? '-'}] ${t.text}` } : { role: 'user', content: t.text };
    const last = messages[messages.length - 1];
    if (last.role === next.role) last.content += `\n${next.content}`;
    else messages.push(next);
  }
  return messages;
}

export async function clientTurn(deal: Deal, rehearsal: Rehearsal): Promise<Turn> {
  const ids = new Set(deal.requirements.map((r) => r.id));
  const { text } = await generateText('clientSimulator', rehearsalMessages(rehearsal.turns), {
    instructions: rehearsalPersona(deal, rehearsal.difficulty),
    temperature: 0.8,
    maxTokens: 220,
    timeoutMs: 60_000,
  });
  const parsed = parseClientTurn(text, ids);
  if (!parsed.text) throw new ModelOutputError('The simulated client returned an empty line.');
  const requirementId = parsed.requirementId ?? guessRequirement(parsed.text, deal.requirements);
  return { id: newId('t'), role: 'client', text: parsed.text, requirementId };
}

export async function analyzeReplay(dealId: string, rehearsalId: string): Promise<void> {
  const deal = await load(dealId);
  const rehearsal = deal.rehearsals.find((r) => r.id === rehearsalId);
  if (!rehearsal) throw new ConfigurationError(`Rehearsal ${rehearsalId} no longer exists.`);
  let commitments: ReturnType<typeof buildCommitments> = [];
  if (rehearsal.turns.some((t) => t.role === 'freelancer')) {
    const prompt = replayPrompt(
      deal.requirements,
      rehearsal.turns.map((t, i) => ({ label: `T${i + 1}`, role: t.role, text: t.text })),
    );
    const result = await generateJson('scopeAnalyst', prompt, ReplaySchema, { temperature: 0.1, maxTokens: 2000 });
    commitments = buildCommitments(rehearsal, deal.requirements, result.value);
  }
  await updateDeal(dealId, (d) => {
    const r = d.rehearsals.find((x) => x.id === rehearsalId);
    if (r) r.replay = { status: 'ready', commitments, error: null };
  });
}

export async function markReplayFailed(dealId: string, rehearsalId: string, message: string): Promise<void> {
  await updateDeal(dealId, (d) => {
    const r = d.rehearsals.find((x) => x.id === rehearsalId);
    if (r) r.replay = { status: 'failed', commitments: [], error: message.slice(0, 300) };
  }).catch((err) => report(err, { step: 'markReplayFailed' }));
}

// ---------- Research ----------

function keepValidCitations(text: string, count: number): string {
  const cleaned = stripThinking(text)
    .replace(/\[(\d+)\]/g, (m, n) => (Number(n) >= 1 && Number(n) <= count ? m : ''))
    .replace(/\s+/g, ' ')
    .trim();
  return /\[\d+\]/.test(cleaned) ? cleaned : '';
}

export async function researchRequirement(deal: Deal, requirementId: string): Promise<Research> {
  const requirement = deal.requirements.find((r) => r.id === requirementId);
  if (!requirement) throw new HttpError(404, 'That work item no longer exists.', 'not_found');
  const query = `${requirement.title} ${requirement.detail}`.slice(0, 180) + ' website project effort';
  const sources = await span('panga.research.search', { requirement: requirementId }, () => webSearch(query));
  const at = new Date().toISOString();
  if (!sources.length) return { query, summary: 'The search found nothing useful for this item.', sources: [], at };
  const { text } = await generateText('researcher', [{ role: 'user', content: researchPrompt(requirement, sources) }], {
    temperature: 0.2,
    maxTokens: 400,
  });
  const summary = keepValidCitations(text, sources.length) || 'The search results did not explain this clearly. Open the sources below.';
  return { query, summary, sources, at };
}

// ---------- Reply ----------

export function replyFacts(deal: Deal, choice: Choice, tone: Tone): { facts: ReplyFacts; allowed: number[] } {
  const p = dealPackages(deal);
  const priced = deal.requirements.filter(isPriced);
  const takePrice = deal.offeredPrice && p.full.meetsFloor ? deal.offeredPrice : p.fullPrice.value;
  const facts: ReplyFacts = {
    choice,
    tone,
    title: deal.title,
    summary: deal.summary,
    currency: deal.currency,
    offeredPrice: deal.offeredPrice,
    take: { price: takePrice, items: priced.map((r) => r.title), revisionRounds: deal.assumptions.revisionRounds, hours: p.full.totalHours.value },
    starter: {
      price: deal.offeredPrice,
      items: p.starterItems.map((r) => r.title),
      excluded: p.excludedFromStarter.map((r) => r.title),
      revisionRounds: deal.assumptions.starterRevisionRounds,
    },
    full: { price: p.fullPrice.value, items: priced.map((r) => r.title), revisionRounds: deal.assumptions.revisionRounds },
    questions: deal.questions
      .filter((q) => q.state === 'ask_client' || q.state === 'open')
      .sort((a, b) => (a.state === 'ask_client' ? -1 : 0) - (b.state === 'ask_client' ? -1 : 0))
      .map((q) => q.text)
      .slice(0, 3),
  };
  const allowed = [deal.offeredPrice ?? 0, takePrice, p.fullPrice.value].filter((n) => n > 0);
  return { facts, allowed };
}

export async function draftReply(deal: Deal, choice: Choice, tone: Tone): Promise<string> {
  const { facts } = replyFacts(deal, choice, tone);
  const { text } = await generateText('proposalWriter', [{ role: 'user', content: replyPrompt(facts) }], {
    temperature: 0.5,
    maxTokens: 700,
  });
  return tidyReply(text);
}

const SIGN_OFF = /^(best|kind|warm|many)?\s*(regards|wishes|thanks)?[,!.]?$|^(thanks|thank you|cheers|best|sincerely|regards)[,!.]?$/i;

/** Removes subject lines, markdown bold and a dangling sign-off the model added anyway. */
export function tidyReply(raw: string): string {
  const lines = stripThinking(raw)
    .replace(/^\s*(subject|re)\s*:.*\n+/i, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .trim()
    .split('\n');
  while (lines.length > 1 && (lines[lines.length - 1].trim() === '' || SIGN_OFF.test(lines[lines.length - 1].trim()))) lines.pop();
  return lines.join('\n').trim();
}

// ---------- Memory of corrections ----------

/** What the freelancer changed in the extracted scope, phrased for future extractions. */
export function correctionNotes(deal: Deal): string[] {
  const project = deal.summary || deal.title;
  const original = new Map(deal.extracted.map((e) => [e.id, e]));
  const notes: string[] = [];
  for (const r of deal.requirements) {
    const o = original.get(r.id);
    if (!o) {
      if (r.addedBy === 'freelancer' && r.status !== 'removed') notes.push(`For "${project}", the freelancer added work Panga missed: "${r.title}".`);
      continue;
    }
    if (r.status === 'removed') {
      notes.push(`For "${project}", the freelancer removed "${o.title}" from the scope Panga extracted.`);
      continue;
    }
    if (r.title.trim() !== o.title.trim()) notes.push(`The freelancer calls "${o.title}" "${r.title}".`);
    if (r.hoursSource === 'freelancer' && o.suggestedHours && Math.abs(r.hours - o.suggestedHours) / o.suggestedHours >= 0.25) {
      const said = r.evidence[0] ? ` when the client says "${r.evidence[0].quote}"` : '';
      notes.push(`The freelancer estimates "${r.title}" at ${formatHours(r.hours)}${said}, not ${formatHours(o.suggestedHours)}.`);
    }
  }
  return notes.slice(0, 8);
}

export async function rememberScopeCorrections(dealId: string): Promise<number> {
  const deal = await getDeal(dealId);
  if (!deal) return 0;
  return rememberCorrections(deal.workspaceId, correctionNotes(deal));
}

// ---------- Decision and outcome ----------

/** Remembers the rate and tone the freelancer actually used, for the next deal. */
export async function recordDecision(dealId: string): Promise<void> {
  const deal = await getDeal(dealId);
  if (!deal?.decision?.approvedAt) return;
  const prefs = await getPreferences(deal.workspaceId);
  const next = { ...prefs };
  if (prefs.tone !== deal.decision.tone) next.tone = deal.decision.tone;
  if (deal.currency === prefs.currency && prefs.minimumRate !== deal.assumptions.minimumRate) next.minimumRate = deal.assumptions.minimumRate;
  if (JSON.stringify(next) !== JSON.stringify(prefs)) {
    await savePreferences(deal.workspaceId, next).catch((err) => report(err, { step: 'recordDecision.prefs' }));
  }
}

export async function requestOutcome(dealId: string): Promise<void> {
  await updateDeal(dealId, (d) => {
    if (!d.outcome) d.outcomeRequestedAt = new Date().toISOString();
  });
}

/** Adds the finished deal to the past-project library, with estimated vs actual hours. */
export async function saveOutcome(dealId: string): Promise<void> {
  const deal = await getDeal(dealId);
  if (!deal?.outcome) return;
  const p = dealPackages(deal);
  const starter = deal.outcome.package === 'starter';
  const items = starter ? p.starterItems : deal.requirements.filter(isPriced);
  const price = starter
    ? deal.offeredPrice
    : deal.offeredPrice && p.full.meetsFloor
      ? deal.offeredPrice
      : p.fullPrice.value;
  await upsertProjectForDeal(deal.workspaceId, deal.id, {
    title: deal.title,
    summary: deal.summary,
    requirements: items.map((r) => `${r.title} (${formatHours(starter ? r.starterHours : r.hours)})`).join('; '),
    estimatedHours: (starter ? p.starter : p.full).totalHours.value,
    actualHours: deal.outcome.actualHours,
    quotedPrice: price,
    currency: deal.currency,
    lesson: deal.outcome.lesson,
  });
  await updateDeal(dealId, (d) => {
    d.stage = 'closed';
  });
}
