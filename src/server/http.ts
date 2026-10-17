// Small helpers shared by the route handlers.

import { z } from 'zod';
import { isSafeId } from '@/lib/ids';
import { HttpError, errorMessage } from './errors';
import { report } from './report';

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Wraps a handler: HttpErrors become JSON responses, anything else is logged and reported. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status);
      report(err);
      return json({ error: 'Something went wrong on our side. Try again in a moment.', code: 'internal' }, 500);
    }
  };
}

/** The browser's private workspace key. Deals are only visible to the workspace that made them. */
export function requireWorkspace(req: Request): string {
  const id = req.headers.get('x-panga-workspace');
  if (!isSafeId(id)) throw new HttpError(401, 'This browser has no Panga workspace key yet. Reload the page.', 'no_workspace');
  return id;
}

export async function readBody<T>(req: Request, schema: z.ZodType<T>, maxBytes = 200_000): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'That request is too large.', 'too_large');
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'The request body is not valid JSON.', 'bad_json');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    throw new HttpError(400, `${where}${issue?.message ?? 'Invalid request.'}`, 'invalid');
  }
  return parsed.data;
}

export type Ctx<P extends Record<string, string>> = { params: Promise<P> };

export async function param(ctx: Ctx<Record<string, string>>, name: string): Promise<string> {
  const value = (await ctx.params)[name];
  if (!isSafeId(value)) throw new HttpError(404, 'Not found.', 'not_found');
  return value;
}

export { errorMessage };
