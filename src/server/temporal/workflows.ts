// The life of one deal as a Temporal workflow. Workflow code must be
// deterministic: it only waits, branches and calls activities. The activities
// (src/server/pipeline.ts) do the real work and write to the database.

import { condition, defineQuery, defineSignal, proxyActivities, setHandler } from '@temporalio/workflow';
import type * as activities from './activities';

const steps = proxyActivities<typeof activities>({
  startToCloseTimeout: '4 minutes',
  retry: {
    initialInterval: '5 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    nonRetryableErrorTypes: ['ConfigurationError'],
  },
});

const bookkeeping = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: { initialInterval: '2 seconds', maximumAttempts: 5 },
});

export const reanalyzeSignal = defineSignal('reanalyze');
export const scopeConfirmedSignal = defineSignal('scopeConfirmed');
export const rehearsalEndedSignal = defineSignal<[string]>('rehearsalEnded');
export const decisionApprovedSignal = defineSignal<[string]>('decisionApproved');
export const outcomeRecordedSignal = defineSignal('outcomeRecorded');
export const stageQuery = defineQuery<string>('stage');

/** How long a deal may sit undecided, and when to ask how the project went. */
export const REVIEW_WINDOW = '30 days';
export const OUTCOME_NUDGE_AFTER = '14 days';
export const OUTCOME_WINDOW = '90 days';

function failureMessage(err: unknown): string {
  let current: unknown = err;
  // ActivityFailure -> ApplicationFailure: the innermost message is the useful one.
  while (current && typeof current === 'object' && 'cause' in current && (current as { cause?: unknown }).cause) {
    current = (current as { cause: unknown }).cause;
  }
  return current instanceof Error ? current.message : 'The step failed.';
}

export async function dealReview(dealId: string): Promise<string> {
  let stage = 'analyzing';
  let reanalyze = false;
  let scopeConfirmed = false;
  let decision: string | null = null;
  let outcome = false;
  const replays: string[] = [];

  setHandler(stageQuery, () => stage);
  setHandler(reanalyzeSignal, () => void (reanalyze = true));
  setHandler(scopeConfirmedSignal, () => void (scopeConfirmed = true));
  setHandler(rehearsalEndedSignal, (rehearsalId) => void replays.push(rehearsalId));
  setHandler(decisionApprovedSignal, (choice) => void (decision = choice));
  setHandler(outcomeRecordedSignal, () => void (outcome = true));

  async function analyze() {
    stage = 'analyzing';
    try {
      await steps.analyzeDeal(dealId);
      stage = 'review';
    } catch (err) {
      stage = 'analysis_failed';
      await bookkeeping.markAnalysisFailed(dealId, failureMessage(err));
    }
  }

  await analyze();

  // Review: re-reads, scope confirmations and rehearsal replays, until a decision.
  while (decision === null) {
    const woke = await condition(() => decision !== null || reanalyze || scopeConfirmed || replays.length > 0, REVIEW_WINDOW);
    if (!woke) return 'expired';
    if (reanalyze) {
      reanalyze = false;
      await analyze();
    }
    if (scopeConfirmed) {
      scopeConfirmed = false;
      await bookkeeping.rememberScopeCorrections(dealId);
    }
    while (replays.length > 0) {
      const rehearsalId = replays.shift()!;
      try {
        await steps.analyzeReplay(dealId, rehearsalId);
      } catch (err) {
        await bookkeeping.markReplayFailed(dealId, rehearsalId, failureMessage(err));
      }
    }
  }

  stage = 'decided';
  await bookkeeping.recordDecision(dealId);
  if (decision === 'walk') return 'walked';

  // Two weeks later, ask how many hours it really took. That feeds the
  // past-project library, so the next similar brief is quoted better.
  if (!(await condition(() => outcome, OUTCOME_NUDGE_AFTER))) {
    await bookkeeping.requestOutcome(dealId);
    if (!(await condition(() => outcome, OUTCOME_WINDOW))) return 'no_outcome';
  }
  await steps.saveOutcome(dealId);
  stage = 'closed';
  return 'closed';
}
