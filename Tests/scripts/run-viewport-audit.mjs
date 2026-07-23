#!/usr/bin/env node
/**
 * Starts preview on 4173 when needed, runs audit-viewport-overflow.mjs, then exits.
 * Used by run-with-report.mjs and CI (npm test).
 */
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testsRoot = join(__dirname, '..');
const repoRoot = join(testsRoot, '..');
const frontendRoot = join(repoRoot, 'frontend');
const distIndex = join(frontendRoot, 'dist', 'index.html');
const PREVIEW_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';

function probePreview(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForPreview(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probePreview(url)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function spawnPreviewServer() {
  const isWin = process.platform === 'win32';
  const npmCmd = isWin ? 'npm.cmd' : 'npm';
  return spawn(npmCmd, ['run', 'preview', '--', '--port', '4173', '--host', '127.0.0.1'], {
    cwd: frontendRoot,
    env: {
      ...process.env,
      PLAYWRIGHT: 'true',
      VITE_WHATSAPP_CONTACT_NUMBER: process.env.VITE_WHATSAPP_CONTACT_NUMBER || '+919888514572',
    },
    stdio: 'ignore',
    shell: isWin,
    detached: !isWin,
  });
}

function stopPreview(proc) {
  if (!proc?.pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore', shell: true });
    } else {
      process.kill(-proc.pid);
    }
  } catch {
    // ignore
  }
}

async function main() {
  if (!existsSync(distIndex)) {
    console.error('run-viewport-audit: frontend dist missing — run `npm run build -w frontend` first');
    process.exit(1);
  }

  let previewProc = null;
  let startedByRunner = false;

  try {
    if (!(await probePreview(PREVIEW_URL))) {
      previewProc = spawnPreviewServer();
      startedByRunner = true;
      if (!(await waitForPreview(PREVIEW_URL))) {
        console.error(`run-viewport-audit: preview not ready at ${PREVIEW_URL}`);
        process.exit(1);
      }
    }

    const audit = spawnSync('node', ['scripts/audit-viewport-overflow.mjs'], {
      cwd: testsRoot,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      env: { ...process.env, PREVIEW_URL },
      stdio: 'inherit',
    });

    process.exit(audit.status ?? 1);
  } finally {
    if (startedByRunner) stopPreview(previewProc);
  }
}

await main();
