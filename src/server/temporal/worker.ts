// The Temporal worker: runs deal workflows and their activities.
// Start it with `npm run worker` next to the web app.

import { NativeConnection, Worker } from '@temporalio/worker';
import { env } from '../env';
import * as activities from './activities';

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // No .env.local (App Platform passes variables directly).
  }
  if (!env.temporalAddress) throw new Error('Set TEMPORAL_ADDRESS to run the worker.');
  if (!env.databaseUrl) throw new Error('Set DATABASE_URL: the worker and the web app must share one database.');
  const connection = await NativeConnection.connect({
    address: env.temporalAddress,
    tls: env.temporalApiKey ? true : undefined,
    apiKey: env.temporalApiKey || undefined,
  });
  const worker = await Worker.create({
    connection,
    namespace: env.temporalNamespace,
    taskQueue: env.temporalTaskQueue,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });
  console.log(`[worker] polling task queue "${env.temporalTaskQueue}" on ${env.temporalAddress} (${env.temporalNamespace})`);
  await worker.run();
}

main().catch((err) => {
  console.error('[worker] stopped:', err);
  process.exit(1);
});
