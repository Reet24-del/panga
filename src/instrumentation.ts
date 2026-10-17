// Server start-up. With SENTRY_DSN set, creating the Mastra instance starts
// Sentry (Mastra's Sentry exporter initialises it), so agent traces and
// request errors share one Sentry client from the first request.

import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.SENTRY_DSN) {
    const { getMastra } = await import('./mastra');
    getMastra();
  }
}

export const onRequestError = Sentry.captureRequestError;
