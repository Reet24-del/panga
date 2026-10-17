// Activities are the deal pipeline's steps, unchanged. Temporal adds retries,
// timeouts and a durable record of each run. A missing key or a deleted deal
// won't fix itself, so those errors are marked non-retryable explicitly.

import { ApplicationFailure } from '@temporalio/activity';
import { ConfigurationError } from '../errors';
import * as pipeline from '../pipeline';

export function failFastOnConfiguration<A extends unknown[], R>(step: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return await step(...args);
    } catch (err) {
      if (err instanceof ConfigurationError) throw ApplicationFailure.nonRetryable(err.message, 'ConfigurationError');
      throw err;
    }
  };
}

export const analyzeDeal = failFastOnConfiguration(pipeline.analyzeDeal);
export const analyzeReplay = failFastOnConfiguration(pipeline.analyzeReplay);
export const markAnalysisFailed = pipeline.markAnalysisFailed;
export const markReplayFailed = pipeline.markReplayFailed;
export const recordDecision = pipeline.recordDecision;
export const rememberScopeCorrections = pipeline.rememberScopeCorrections;
export const requestOutcome = pipeline.requestOutcome;
export const saveOutcome = failFastOnConfiguration(pipeline.saveOutcome);
