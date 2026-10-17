// Starting and signalling deal workflows from the web app.

import { Client, Connection } from '@temporalio/client';
import { env } from '../env';

const holder = globalThis as unknown as { __pangaTemporal?: Promise<Client> };

export function temporalClient(): Promise<Client> {
  holder.__pangaTemporal ??= (async () => {
    const connection = await Connection.connect({
      address: env.temporalAddress,
      tls: env.temporalApiKey ? true : undefined,
      apiKey: env.temporalApiKey || undefined,
      connectTimeout: '5 seconds',
    });
    return new Client({ connection, namespace: env.temporalNamespace });
  })().catch((err) => {
    holder.__pangaTemporal = undefined;
    throw err;
  });
  return holder.__pangaTemporal;
}

export function workflowIdFor(dealId: string): string {
  return `deal-${dealId}`;
}

export async function startDealWorkflow(dealId: string): Promise<string> {
  const client = await temporalClient();
  const handle = await client.workflow.start('dealReview', {
    taskQueue: env.temporalTaskQueue,
    workflowId: workflowIdFor(dealId),
    args: [dealId],
  });
  return handle.workflowId;
}

export async function signalDeal(workflowId: string, signal: string, ...args: unknown[]): Promise<void> {
  const client = await temporalClient();
  await client.workflow.getHandle(workflowId).signal(signal, ...args);
}
