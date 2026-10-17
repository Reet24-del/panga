// Every model call costs the deployer money, so public endpoints are limited
// per workspace and per day. In-memory: good enough for one web instance.

import { env } from './env';
import { HttpError } from './errors';

const WINDOW_MS = 10 * 60 * 1000;
const holder = globalThis as unknown as {
  __pangaRate?: { windows: Map<string, number[]>; day: string; dayCount: number };
};

function state() {
  holder.__pangaRate ??= { windows: new Map(), day: '', dayCount: 0 };
  return holder.__pangaRate;
}

/** Records one model call for key, or throws 429. */
export function takeModelCall(key: string, cost = 1): void {
  const s = state();
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (s.day !== today) {
    s.day = today;
    s.dayCount = 0;
  }
  if (s.dayCount + cost > env.dailyCalls) {
    throw new HttpError(429, 'Panga has reached its daily limit of model calls. Try again tomorrow.', 'daily_limit');
  }
  const recent = (s.windows.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length + cost > env.callsPer10Min) {
    const wait = Math.ceil((WINDOW_MS - (now - recent[0])) / 60000);
    throw new HttpError(429, `Too many requests. Try again in about ${wait} minute${wait === 1 ? '' : 's'}.`, 'rate_limit');
  }
  for (let i = 0; i < cost; i++) recent.push(now);
  s.windows.set(key, recent);
  s.dayCount += cost;
  if (s.windows.size > 5000) {
    for (const [k, times] of s.windows) if (times.every((t) => now - t >= WINDOW_MS)) s.windows.delete(k);
  }
}
