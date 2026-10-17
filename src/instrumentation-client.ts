// Browser errors go to Sentry when NEXT_PUBLIC_SENTRY_DSN is set at build time.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0.2, sendDefaultPii: false });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
