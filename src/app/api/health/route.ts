import { integrations } from '@/server/env';
import { json, route } from '@/server/http';

export const dynamic = 'force-dynamic';

/**
 * Liveness for the host, which integrations are switched on (never their
 * keys), and memory in use, to keep an eye on small free instances.
 */
export const GET = route(async () =>
  json({
    ok: true,
    integrations: integrations(),
    worker: process.env.PANGA_EMBEDDED_WORKER === 'true' ? 'embedded' : 'separate',
    memoryMb: Math.round(process.memoryUsage().rss / 1048576),
  }),
);
