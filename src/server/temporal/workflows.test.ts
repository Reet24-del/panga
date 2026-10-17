// Runs the real deal workflow on Temporal's time-skipping test server, with
// recorded fake activities. Thirty-day and two-week timers pass instantly.
// Set SKIP_TEMPORAL_TESTS=1 to skip (the test server is downloaded on first run).

import { fileURLToPath } from 'node:url';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigurationError } from '../errors';
import { failFastOnConfiguration } from './activities';

const skip = process.env.SKIP_TEMPORAL_TESTS === '1';
let testEnv: TestWorkflowEnvironment;

beforeAll(async () => {
  if (!skip) testEnv = await TestWorkflowEnvironment.createTimeSkipping();
}, 240_000);

afterAll(async () => {
  await testEnv?.teardown();
});

function fakes(log: string[], opts: { failFirstAnalysis?: boolean } = {}) {
  let analyses = 0;
  return {
    // Wrapped exactly like the real activity, so the test covers the fail-fast path.
    analyzeDeal: failFastOnConfiguration(async (id: string) => {
      analyses++;
      log.push(`analyze:${id}`);
      if (opts.failFirstAnalysis && analyses === 1) throw new ConfigurationError('Panga needs a DigitalOcean model access key.');
    }),
    async markAnalysisFailed(_id: string, message: string) {
      log.push(`failed:${message}`);
    },
    async analyzeReplay(_id: string, rehearsalId: string) {
      log.push(`replay:${rehearsalId}`);
    },
    async markReplayFailed() {
      log.push('replayFailed');
    },
    async rememberScopeCorrections() {
      log.push('corrections');
      return 1;
    },
    async recordDecision() {
      log.push('decision');
    },
    async requestOutcome() {
      log.push('requestOutcome');
    },
    async saveOutcome() {
      log.push('saveOutcome');
    },
  };
}

const workflowsPath = fileURLToPath(new URL('./workflows.ts', import.meta.url));

async function withWorker<T>(taskQueue: string, activities: ReturnType<typeof fakes>, fn: () => Promise<T>): Promise<T> {
  const worker = await Worker.create({ connection: testEnv.nativeConnection, taskQueue, workflowsPath, activities });
  return worker.runUntil(fn);
}

async function waitForStage(handle: { query: (q: string) => Promise<unknown> }, stage: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if ((await handle.query('stage')) === stage) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`stage never became ${stage}`);
}

describe.skipIf(skip)('dealReview workflow', () => {
  it('runs a deal from analysis to a recorded outcome, nudging after two weeks', async () => {
    const log: string[] = [];
    const result = await withWorker('happy', fakes(log), async () => {
      const handle = await testEnv.client.workflow.start('dealReview', { taskQueue: 'happy', workflowId: 'deal-happy', args: ['d1'] });
      await waitForStage(handle, 'review');
      await handle.signal('scopeConfirmed');
      await handle.signal('rehearsalEnded', 'r1');
      await handle.signal('decisionApproved', 'change');
      await waitForStage(handle, 'decided');
      await testEnv.sleep('15 days');
      await handle.signal('outcomeRecorded');
      return handle.result();
    });
    expect(result).toBe('closed');
    expect(log).toEqual(['analyze:d1', 'corrections', 'replay:r1', 'decision', 'requestOutcome', 'saveOutcome']);
  }, 120_000);

  it('does not retry a configuration error, and re-reads on request', async () => {
    const log: string[] = [];
    const result = await withWorker('retry', fakes(log, { failFirstAnalysis: true }), async () => {
      const handle = await testEnv.client.workflow.start('dealReview', { taskQueue: 'retry', workflowId: 'deal-retry', args: ['d2'] });
      await waitForStage(handle, 'analysis_failed');
      await handle.signal('reanalyze');
      await waitForStage(handle, 'review');
      await handle.signal('decisionApproved', 'walk');
      return handle.result();
    });
    expect(result).toBe('walked');
    expect(log).toEqual(['analyze:d2', 'failed:Panga needs a DigitalOcean model access key.', 'analyze:d2', 'decision']);
  }, 120_000);

  it('expires a deal nobody decides on within 30 days', async () => {
    const log: string[] = [];
    const result = await withWorker('expire', fakes(log), async () => {
      const handle = await testEnv.client.workflow.start('dealReview', { taskQueue: 'expire', workflowId: 'deal-expire', args: ['d3'] });
      return handle.result();
    });
    expect(result).toBe('expired');
    expect(log).toEqual(['analyze:d3']);
  }, 120_000);
});
