import { z } from 'zod';
import { CURRENCIES } from '@/lib/types';
import { json, readBody, requireWorkspace, route } from '@/server/http';
import { addProject, listProjects } from '@/server/projects-repo';

export const dynamic = 'force-dynamic';

const hours = z.number().finite().min(0).max(10_000).nullable();

const Body = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(2000).default(''),
  requirements: z.string().trim().max(4000).default(''),
  estimatedHours: hours.default(null),
  actualHours: hours.default(null),
  quotedPrice: z.number().finite().min(0).max(1e10).nullable().default(null),
  currency: z.enum(CURRENCIES).nullable().default(null),
  lesson: z.string().trim().max(2000).default(''),
});

/** The freelancer's library of real past projects (Tiger Data). */
export const GET = route(async (req: Request) => {
  const ws = requireWorkspace(req);
  return json({ projects: await listProjects(ws) });
});

export const POST = route(async (req: Request) => {
  const ws = requireWorkspace(req);
  const body = await readBody(req, Body);
  return json({ project: await addProject(ws, body) }, 201);
});
