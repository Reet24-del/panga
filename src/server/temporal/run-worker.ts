// Runs deal workflows and their activities. Used by `npm run worker` and, on
// hosts with a single free instance (Render), inside the web server itself
// (PANGA_EMBEDDED_WORKER=true, started from src/instrumentation.ts).

import { existsSync } from 'node:fs';
import path from 'node:path';
import { NativeConnection, Worker } from '@temporalio/worker';
import { env } from '../env';
import * as activities from './activities';

// Written by `npm run build` (scripts/bundle-workflows.mjs), so the server
// never has to run webpack to bundle workflow code at start-up.
const PREBUILT = path.join(process.cwd(), '.temporal', 'workflow-bundle.js');
const SOURCE = path.join(process.cwd(), 'src', 'server', 'temporal', 'workflows.ts');

export async function createWorker(): Promise<Worker> {
  if (!env.temporalAddress) throw new Error('Set TEMPORAL_ADDRESS to run the worker.');
  if (!env.databaseUrl) throw new Error('Set DATABASE_URL: the worker and the web app must share one database.');
  const connection = await NativeConnection.connect({
    address: env.temporalAddress,
    tls: env.temporalApiKey ? true : undefined,
    apiKey: env.temporalApiKey || undefined,
    metadata: { 'temporal-namespace': env.temporalNamespace },
  });
  return Worker.create({
    connection,
    namespace: env.temporalNamespace,
    taskQueue: env.temporalTaskQueue,
    ...(existsSync(PREBUILT) ? { workflowBundle: { codePath: PREBUILT } } : { workflowsPath: SOURCE }),
    activities,
    // One small instance: a few deals at a time is plenty.
    maxConcurrentActivityTaskExecutions: 3,
    maxCachedWorkflows: 50,
  });
}

const holder = globalThis as unknown as { __pangaWorker?: boolean };

/** Starts the worker in the background and restarts it if it stops. Never throws. */
export function startEmbeddedWorker(): void {
  if (holder.__pangaWorker) return;
  holder.__pangaWorker = true;
  void (async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        const worker = await createWorker();
        console.log(`[worker] embedded, polling "${env.temporalTaskQueue}" on ${env.temporalAddress} (${env.temporalNamespace})`);
        attempt = 0;
        await worker.run();
        console.warn('[worker] stopped; restarting');
      } catch (err) {
        console.error('[worker] failed:', err instanceof Error ? err.message : err);
      }
      await new Promise((r) => setTimeout(r, Math.min(60_000, 5_000 * Math.max(1, attempt))));
    }
  })();
}
