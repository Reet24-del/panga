// Server start-up. With SENTRY_DSN set, creating the Mastra instance starts
// Sentry (Mastra's Sentry exporter initialises it), so agent traces and
// request errors share one Sentry client from the first request.

import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.SENTRY_DSN) {
    const { getMastra } = await import('./mastra');
    getMastra();
  }
  // Single-instance hosts (Render's free plan) have no separate worker
  // process, so the Temporal worker runs inside the web server.
  if (process.env.PANGA_EMBEDDED_WORKER === 'true') {
    const { temporalEnabled } = await import('./server/env');
    if (temporalEnabled()) {
      const { startEmbeddedWorker } = await import('./server/temporal/run-worker');
      startEmbeddedWorker();
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
