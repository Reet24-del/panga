// Starts `next dev` (or `next start` with the argument "start") on port 3100
// with scripts/mock.env, so every integration talks to
// scripts/mock-services.mjs instead of real services.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const vars = parseEnv(readFileSync(new URL('./mock.env', import.meta.url), 'utf8'));
const port = process.env.PORT || '3100';
const mode = process.argv[2] === 'start' ? 'start' : 'dev';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', mode, '-p', port], {
  stdio: 'inherit',
  env: { ...process.env, ...vars },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
