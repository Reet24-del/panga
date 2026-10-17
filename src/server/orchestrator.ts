// Routes each deal event either to its Temporal workflow or, when Temporal
// isn't configured (or can't be reached), runs the step in the background of
// the web process. Callers don't need to know which.

import { after } from 'next/server';
import { updateDeal } from './deals-repo';
import { temporalEnabled } from './env';
import { errorMessage } from './errors';
import * as pipeline from './pipeline';
import { report } from './report';
import { signalDeal, startDealWorkflow } from './temporal/client';

function inBackground(name: string, task: () => Promise<unknown>): void {
  after(async () => {
    try {
      await task();
    } catch (err) {
      report(err, { task: name });
    }
  });
}

async function signal(workflowId: string | null, name: string, args: unknown[], fallback: () => Promise<unknown>, task: string): Promise<'temporal' | 'inline'> {
  if (workflowId && temporalEnabled()) {
    try {
      await signalDeal(workflowId, name, ...args);
      return 'temporal';
    } catch (err) {
      report(err, { step: `temporal.signal.${name}` });
    }
  }
  inBackground(task, fallback);
  return 'inline';
}

function analyzeInline(dealId: string) {
  return async () => {
    try {
      await pipeline.analyzeDeal(dealId);
    } catch (err) {
      await pipeline.markAnalysisFailed(dealId, errorMessage(err));
      throw err;
    }
  };
}

export async function startAnalysis(dealId: string): Promise<'temporal' | 'inline'> {
  if (temporalEnabled()) {
    try {
      const workflowId = await startDealWorkflow(dealId);
      await updateDeal(dealId, (d) => {
        d.workflowId = workflowId;
      });
      return 'temporal';
    } catch (err) {
      report(err, { step: 'temporal.start' });
    }
  }
  inBackground('analyze', analyzeInline(dealId));
  return 'inline';
}

export function reanalyze(dealId: string, workflowId: string | null) {
  return signal(workflowId, 'reanalyze', [], analyzeInline(dealId), 'reanalyze');
}

export function scopeConfirmed(dealId: string, workflowId: string | null) {
  return signal(workflowId, 'scopeConfirmed', [], () => pipeline.rememberScopeCorrections(dealId), 'corrections');
}

export function rehearsalEnded(dealId: string, workflowId: string | null, rehearsalId: string) {
  return signal(
    workflowId,
    'rehearsalEnded',
    [rehearsalId],
    async () => {
      try {
        await pipeline.analyzeReplay(dealId, rehearsalId);
      } catch (err) {
        await pipeline.markReplayFailed(dealId, rehearsalId, errorMessage(err));
        throw err;
      }
    },
    'replay',
  );
}

export function decisionApproved(dealId: string, workflowId: string | null, choice: string) {
  return signal(workflowId, 'decisionApproved', [choice], () => pipeline.recordDecision(dealId), 'decision');
}

export function outcomeRecorded(dealId: string, workflowId: string | null) {
  return signal(workflowId, 'outcomeRecorded', [], () => pipeline.saveOutcome(dealId), 'outcome');
}
