import { z } from 'zod';
import { CURRENCIES } from '@/lib/types';
import { integrations } from '@/server/env';
import { json, readBody, requireWorkspace, route } from '@/server/http';
import { loadMemory, savePreferences } from '@/server/memory';

export const dynamic = 'force-dynamic';

const Body = z.object({
  minimumRate: z.number().finite().positive().max(1e7).nullable(),
  currency: z.enum(CURRENCIES),
  tone: z.enum(['english_friendly', 'english_formal', 'hinglish_friendly']),
  neverInclude: z.array(z.string().trim().min(1).max(60)).max(20),
});

/** What Panga remembers about this freelancer, and which services are switched on. */
export const GET = route(async (req: Request) => {
  const ws = requireWorkspace(req);
  return json({ ...(await loadMemory(ws)), integrations: integrations() });
});

export const PUT = route(async (req: Request) => {
  const ws = requireWorkspace(req);
  const prefs = await readBody(req, Body);
  return json({ ...(await savePreferences(ws, prefs)), integrations: integrations() });
});
