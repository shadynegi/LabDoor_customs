#!/usr/bin/env node
/**
 * Phase 0 baseline audit — dead-code patterns, depcheck, test inventory, optional bundle stats.
 * Run from repo root: npm run audit:codebase
 * Output: documentation/OPTIMIZATION_BASELINE.md (overwritten each run)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'documentation', 'OPTIMIZATION_BASELINE.md');

function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    out: `${result.stdout || ''}${result.stderr || ''}`.trim(),
  };
}

function countFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countFiles(full, pattern);
    else if (pattern.test(entry.name)) n += 1;
  }
  return n;
}

function scanDirForPattern(dir, pattern, hits = []) {
  if (!fs.existsSync(dir)) return hits;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      scanDirForPattern(full, pattern, hits);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      const text = fs.readFileSync(full, 'utf8');
      if (pattern.test(text)) hits.push(full);
    }
  }
  return hits;
}

const paypalHits = [
  ...scanDirForPattern(path.join(root, 'backend', 'src'), /paypal|PayPal/i),
  ...scanDirForPattern(path.join(root, 'frontend', 'src'), /paypal|PayPal/i),
  ...scanDirForPattern(path.join(root, 'Tests'), /paypal|PayPal/i),
].filter((f, i, a) => a.indexOf(f) === i);

const reviewApiHits = [
  ...scanDirForPattern(path.join(root, 'backend', 'src'), /\/api\/reviews|review_votes/),
  ...scanDirForPattern(path.join(root, 'frontend', 'src'), /\/api\/reviews|review_votes/),
].filter((f, i, a) => a.indexOf(f) === i);

const unitTests = countFiles(path.join(root, 'Tests', 'unit', 'backend'), /\.test\.ts$/);
const apiTests = countFiles(path.join(root, 'Tests', 'integration', 'api'), /\.test\.ts$/);
const feUnitTests = countFiles(path.join(root, 'Tests', 'unit', 'frontend'), /\.test\.(ts|tsx)$/);
const e2eSpecs = countFiles(path.join(root, 'Tests', 'e2e', 'specs'), /\.spec\.ts$/);

const depBackend = run('npx', ['--yes', 'depcheck'], path.join(root, 'backend'));
const depFrontend = run('npx', ['--yes', 'depcheck'], path.join(root, 'frontend'));

const distDir = path.join(root, 'frontend', 'dist');
let distNote = 'Run `npm run build -w frontend` then `npm run measure:dist -w frontend` for bundle sizes.';
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  const measure = run('npm', ['run', 'measure:dist', '-w', 'frontend'], root);
  distNote = measure.out || distNote;
}

const lines = [
  '# Optimization baseline (auto-generated)',
  '',
  `**Last run:** ${new Date().toISOString()}`,
  '',
  'Regenerate: `npm run audit:codebase` from repository root.',
  '',
  '**Living references:** [`info.md`](info.md) · [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md) · [`test_guidelines.md`](test_guidelines.md)',
  '',
  '---',
  '',
  '## Test inventory (file counts)',
  '',
  '| Suite | Files |',
  '|-------|------:|',
  `| Backend unit (\`Tests/unit/backend/\`) | ${unitTests} |`,
  `| API integration (\`Tests/integration/api/\`) | ${apiTests} |`,
  `| Frontend unit (\`Tests/unit/frontend/\`) | ${feUnitTests} |`,
  `| Playwright specs (\`Tests/e2e/specs/\`) | ${e2eSpecs} |`,
  '',
  '**CI marker:** 515 automated tests (138 + 78 + 13 + 286) — verify with `npm test`.',
  '',
  '---',
  '',
  '## Dependency audit (depcheck)',
  '',
  '### Backend',
  '',
  '```',
  depBackend.out || '(no output)',
  '```',
  '',
  '### Frontend',
  '',
  '```',
  depFrontend.out || '(no output)',
  '```',
  '',
  '> Root `concurrently` is used by `scripts/dev.mjs` (depcheck may false-positive on the root workspace).',
  '',
  '---',
  '',
  '## Legacy feature scan',
  '',
  '| Pattern | Hits in src/Tests |',
  '|---------|-------------------|',
  `| PayPal | ${paypalHits.length} file(s) |`,
  `| Reviews API / review_votes | ${reviewApiHits.length} file(s) |`,
  '',
  paypalHits.length
    ? paypalHits.map((f) => `- \`${path.relative(root, f).replace(/\\/g, '/')}\``).join('\n')
    : '_No PayPal references in application source or tests._',
  '',
  reviewApiHits.length
    ? reviewApiHits.map((f) => `- \`${path.relative(root, f).replace(/\\/g, '/')}\``).join('\n')
    : '_No live reviews API references in application source._',
  '',
  '---',
  '',
  '## Frontend bundle',
  '',
  '```',
  distNote,
  '```',
  '',
  '---',
  '',
  '## Recommended quarterly checks',
  '',
  '1. `npm run audit:codebase`',
  '2. `npm test` (515 + viewport audit)',
  '3. `npm audit --omit=dev`',
  '4. Skim [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md) payment/order rows only',
  '5. Supabase verification queries in [`SUPABASE_SQL_TO_RUN.md`](SUPABASE_SQL_TO_RUN.md)',
  '',
];

fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${path.relative(root, outPath)}`);
