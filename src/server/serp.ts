// Live web search through SerpApi, used to explain unfamiliar requirements.

import type { ResearchSource } from '@/lib/types';
import { env } from './env';
import { ConfigurationError } from './errors';

export async function webSearch(query: string): Promise<ResearchSource[]> {
  if (!env.serpApiKey) throw new ConfigurationError('Research needs a SerpApi key (SERPAPI_API_KEY).');
  const url = new URL(`${env.serpApiBaseUrl.replace(/\/$/, '')}/search.json`);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', query.slice(0, 250));
  url.searchParams.set('num', '8');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('api_key', env.serpApiKey);
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = (await res.json().catch(() => ({}))) as {
    organic_results?: { title?: string; link?: string; snippet?: string }[];
    error?: string;
  };
  if (!res.ok || body.error) throw new Error(`SerpApi search failed: ${body.error ?? res.status}`);
  return (body.organic_results ?? [])
    .filter((r) => r.title && r.link && /^https?:\/\//.test(r.link))
    .slice(0, 5)
    .map((r) => ({ title: r.title!.slice(0, 160), url: r.link!, snippet: (r.snippet ?? '').slice(0, 320) }));
}
