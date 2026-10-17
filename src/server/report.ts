// Error reporting and custom spans that work in both the Next.js server and
// the Temporal worker. Sentry itself is initialised by Mastra's Sentry exporter
// (see src/mastra/index.ts); without SENTRY_DSN these calls do nothing.

import * as Sentry from '@sentry/node';

export function report(err: unknown, context?: Record<string, unknown>): void {
  console.error('[panga]', err instanceof Error ? err.message : err, context ?? '');
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

/** Wraps a non-model step (quote checks, searches) in a Sentry span with attributes. */
export function span<T>(name: string, attributes: Record<string, string | number | boolean>, fn: () => Promise<T>): Promise<T> {
  return Sentry.startSpan({ name, op: 'panga.step', attributes }, fn);
}

export function setSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  Sentry.getActiveSpan()?.setAttributes(attributes);
}
