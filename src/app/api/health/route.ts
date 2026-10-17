import { integrations } from '@/server/env';
import { json, route } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Liveness for App Platform, plus which integrations are switched on (never their keys). */
export const GET = route(async () => json({ ok: true, integrations: integrations() }));
