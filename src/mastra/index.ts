// Panga's Mastra setup: four agents on Gemma, served by DigitalOcean
// Serverless Inference through its OpenAI-compatible API. When SENTRY_DSN is
// set, every agent run, model call and token count is traced to Sentry.

import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { SentryExporter } from '@mastra/sentry';
import { env } from '@/server/env';
import {
  CLIENT_SIMULATOR_INSTRUCTIONS,
  PROPOSAL_WRITER_INSTRUCTIONS,
  RESEARCHER_INSTRUCTIONS,
  SCOPE_ANALYST_INSTRUCTIONS,
} from '@/server/prompts';

process.env.MASTRA_TELEMETRY_DISABLED ??= 'true';

/** Resolved on every call, so a key added at runtime is picked up. */
function gemma() {
  return {
    providerId: 'digitalocean',
    modelId: env.modelId,
    url: env.modelBaseUrl,
    apiKey: env.modelKey || 'not-configured',
    api: 'chat' as const,
  };
}

const agents = {
  scopeAnalyst: new Agent({ id: 'scope-analyst', name: 'Scope analyst', instructions: SCOPE_ANALYST_INSTRUCTIONS, model: gemma }),
  researcher: new Agent({ id: 'researcher', name: 'Researcher', instructions: RESEARCHER_INSTRUCTIONS, model: gemma }),
  clientSimulator: new Agent({ id: 'client-simulator', name: 'Client simulator', instructions: CLIENT_SIMULATOR_INSTRUCTIONS, model: gemma }),
  proposalWriter: new Agent({ id: 'proposal-writer', name: 'Proposal writer', instructions: PROPOSAL_WRITER_INSTRUCTIONS, model: gemma }),
};

export type AgentKey = keyof typeof agents;

function observability() {
  if (!env.sentryDsn) return undefined;
  return new Observability({
    configs: {
      default: {
        serviceName: 'panga',
        exporters: [
          new SentryExporter({
            dsn: env.sentryDsn,
            environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
            release: process.env.SENTRY_RELEASE || undefined,
            tracesSampleRate: 1,
          }),
        ],
      },
    },
  });
}

function create() {
  return new Mastra({ agents, observability: observability() });
}

const holder = globalThis as unknown as { __pangaMastra?: ReturnType<typeof create> };

export function getMastra() {
  holder.__pangaMastra ??= create();
  return holder.__pangaMastra;
}
