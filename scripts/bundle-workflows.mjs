// Runs after `npm run build`: bundles the Temporal workflow code once, so the
// worker (separate or embedded in the web server) starts without webpack.

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { bundleWorkflowCode } from '@temporalio/worker';

const workflowsPath = fileURLToPath(new URL('../src/server/temporal/workflows.ts', import.meta.url));
const { code } = await bundleWorkflowCode({ workflowsPath, logger: { info() {}, warn: console.warn, error: console.error, debug() {}, trace() {}, log() {} } });
await mkdir('.temporal', { recursive: true });
await writeFile('.temporal/workflow-bundle.js', code);
console.log(`Bundled Temporal workflows (${Math.round(code.length / 1024)} KB) into .temporal/workflow-bundle.js`);
