// The Temporal worker as its own process: `npm run worker` next to the web
// app (App Platform runs it as a worker component).

import { env } from '../env';
import { createWorker } from './run-worker';

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // No .env.local (the host passes variables directly).
  }
  const worker = await createWorker();
  console.log(`[worker] polling task queue "${env.temporalTaskQueue}" on ${env.temporalAddress} (${env.temporalNamespace})`);
  await worker.run();
}

main().catch((err) => {
  console.error('[worker] stopped:', err);
  process.exit(1);
});
