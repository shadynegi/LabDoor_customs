#!/usr/bin/env node
/**
 * Dev orchestrator — forwards a single Ctrl+C to api + web and exits 0 on intentional stop.
 * Avoids Windows "Terminate batch job (Y/N)?" from double-interrupt and concurrent SIGINT noise.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const concurrentlyBin = join(root, 'node_modules', 'concurrently', 'dist', 'bin', 'concurrently.js');

const child = spawn(
  process.execPath,
  [
    concurrentlyBin,
    '-k',
    '-i',
    '--kill-signal',
    'SIGINT',
    '-n',
    'api,web',
    '-c',
    'blue,magenta',
    'npm run dev -w backend',
    'npm run dev -w frontend',
  ],
  { cwd: root, stdio: 'inherit', shell: false }
);

let stopping = false;

function requestStop() {
  if (stopping) return;
  stopping = true;
  child.kill('SIGINT');
}

process.on('SIGINT', requestStop);
process.on('SIGTERM', requestStop);

child.on('exit', (code) => {
  if (stopping || code === 0 || code === 130) {
    process.exit(0);
  }
  process.exit(code ?? 1);
});
