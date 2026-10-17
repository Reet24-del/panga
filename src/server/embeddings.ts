// Text embeddings from DigitalOcean Serverless Inference (/v1/embeddings).
// Optional: without PANGA_EMBEDDING_MODEL, project search falls back to keywords.

import { env } from './env';
import { report } from './report';

export function embeddingsEnabled(): boolean {
  return Boolean(env.modelKey && env.embeddingModel);
}

export async function embed(texts: string[]): Promise<number[][] | null> {
  if (!embeddingsEnabled() || texts.length === 0) return null;
  try {
    const res = await fetch(`${env.modelBaseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.modelKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.embeddingModel, input: texts.map((t) => t.slice(0, 6000)) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Embeddings request failed with ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { data?: { embedding: number[]; index?: number }[] };
    const data = [...(body.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (data.length !== texts.length) throw new Error('Embeddings response had the wrong number of vectors.');
    return data.map((d) => d.embedding);
  } catch (err) {
    report(err, { step: 'embed' });
    return null;
  }
}
