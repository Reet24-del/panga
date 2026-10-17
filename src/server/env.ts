// Server configuration, read at call time so tests and the worker can set
// variables after import. Every integration is optional: without its key the
// feature is switched off and the rest of Panga keeps working.

import type { Integrations } from '@/lib/types';

function read(name: string): string {
  return (process.env[name] ?? '').trim();
}

function num(name: string, fallback: number): number {
  const n = Number(read(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  // DigitalOcean Serverless Inference (OpenAI-compatible)
  get modelBaseUrl() {
    return read('DO_INFERENCE_BASE_URL') || 'https://inference.do-ai.run/v1';
  },
  get modelKey() {
    return read('DO_MODEL_ACCESS_KEY');
  },
  get modelId() {
    return read('PANGA_MODEL') || 'gemma-4-31B-it';
  },
  get embeddingModel() {
    return read('PANGA_EMBEDDING_MODEL');
  },

  // Tiger Data (Postgres + pgvector). Without it, an embedded PGlite database is used.
  get databaseUrl() {
    return read('DATABASE_URL');
  },
  get dataDir() {
    return read('PANGA_DATA_DIR') || '.data';
  },

  // Temporal
  get temporalAddress() {
    return read('TEMPORAL_ADDRESS');
  },
  get temporalNamespace() {
    return read('TEMPORAL_NAMESPACE') || 'default';
  },
  get temporalApiKey() {
    return read('TEMPORAL_API_KEY');
  },
  get temporalTaskQueue() {
    return read('TEMPORAL_TASK_QUEUE') || 'panga-deals';
  },

  // ElevenLabs
  get elevenlabsBaseUrl() {
    return read('ELEVENLABS_BASE_URL') || 'https://api.elevenlabs.io';
  },
  get elevenlabsKey() {
    return read('ELEVENLABS_API_KEY');
  },
  get elevenlabsAgentId() {
    return read('ELEVENLABS_AGENT_ID');
  },
  /** Shared secret ElevenLabs sends when it calls Panga's simulated-client endpoint. */
  get simSecret() {
    return read('PANGA_SIM_SECRET');
  },

  // SerpApi
  get serpApiBaseUrl() {
    return read('SERPAPI_BASE_URL') || 'https://serpapi.com';
  },
  get serpApiKey() {
    return read('SERPAPI_API_KEY');
  },

  // Backboard
  get backboardBaseUrl() {
    return read('BACKBOARD_BASE_URL') || 'https://app.backboard.io/api';
  },
  get backboardKey() {
    return read('BACKBOARD_API_KEY');
  },

  // DigitalOcean Spaces (S3-compatible) for original uploads
  get spacesKey() {
    return read('SPACES_KEY');
  },
  get spacesSecret() {
    return read('SPACES_SECRET');
  },
  get spacesBucket() {
    return read('SPACES_BUCKET');
  },
  get spacesRegion() {
    return read('SPACES_REGION') || 'blr1';
  },
  get spacesEndpoint() {
    return read('SPACES_ENDPOINT') || `https://${this.spacesRegion}.digitaloceanspaces.com`;
  },

  // Sentry
  get sentryDsn() {
    return read('SENTRY_DSN');
  },

  // Abuse limits for model calls (the model costs money per token)
  get callsPer10Min() {
    return num('PANGA_RATE_LIMIT', 60);
  },
  get dailyCalls() {
    return num('PANGA_DAILY_LIMIT', 2000);
  },
};

/** Temporal needs a database both the web app and the worker can reach. */
export function temporalEnabled(): boolean {
  return Boolean(env.temporalAddress && env.databaseUrl);
}

export function integrations(): Integrations {
  return {
    model: Boolean(env.modelKey),
    modelId: env.modelId,
    database: env.databaseUrl ? 'tiger' : 'local',
    embeddings: Boolean(env.modelKey && env.embeddingModel),
    temporal: temporalEnabled(),
    voice: Boolean(env.elevenlabsKey && env.elevenlabsAgentId && env.simSecret),
    transcription: Boolean(env.elevenlabsKey),
    research: Boolean(env.serpApiKey),
    memory: env.backboardKey ? 'backboard' : 'local',
    tracing: Boolean(env.sentryDsn),
    files: env.spacesKey && env.spacesSecret && env.spacesBucket ? 'spaces' : 'none',
  };
}
