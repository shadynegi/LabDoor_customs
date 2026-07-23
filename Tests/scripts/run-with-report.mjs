#!/usr/bin/env node
/**
 * Unified test runner with per-suite timestamped reports.
 *
 * Usage: node run-with-report.mjs <suite>
 *
 * Suites:
 *   all        — backend unit + API + frontend UI (3 reports + summary)
 *   unit       — backend unit tests only (Tests/unit/backend/)
 *   api        — API integration tests only (Tests/integration/api/)
 *   vitest     — backend unit + API together (single backend report)
 *   frontend   — Playwright UI tests (Tests/e2e/specs/) + viewport overflow audit
 *   frontend-unit — React component/hook unit tests (Tests/unit/frontend/)
 *   viewport-audit — viewport overflow audit only (requires frontend build)
 */

import { spawnSync, spawn } from 'node:child_process';
import http from 'node:http';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testsRoot = join(__dirname, '..');
const repoRoot = join(testsRoot, '..');
const backendRoot = join(repoRoot, 'backend');
const frontendDist = join(repoRoot, 'frontend', 'dist', 'index.html');
const resultsDir = join(repoRoot, 'documentation', 'test-results');

const suite = process.argv[2] ?? 'all';

const SUITE_SLUG = {
  unit: 'backend-unit',
  api: 'api',
  vitest: 'backend',
  'frontend-unit': 'frontend-unit',
  frontend: 'frontend-ui',
  'viewport-audit': 'viewport-audit',
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + '_' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('-');
}

function formatDisplayDate(date = new Date()) {
  return date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' });
}

function runCommand(label, command, args, options = {}) {
  const started = Date.now();
  console.log(`\n▶ ${label}…`);
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });
  const durationMs = Date.now() - started;
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const exitCode = result.status ?? 1;
  const status = exitCode === 0 ? 'PASS' : 'FAIL';
  console.log(`  ${status} (${formatDuration(durationMs)}, exit ${exitCode})`);
  return { label, command, args, stdout, stderr, exitCode, durationMs };
}

function gitInfo() {
  const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return {
    branch: branch.status === 0 ? branch.stdout.trim() : 'unknown',
    commit: commit.status === 0 ? commit.stdout.trim() : 'unknown',
  };
}

function relPath(absPath) {
  return relative(repoRoot, absPath).replace(/\\/g, '/');
}

function parseVitestJson(jsonPath) {
  if (!existsSync(jsonPath)) {
    return {
      passed: [],
      failed: [],
      skipped: [],
      parseError: `Vitest JSON output not found: ${relPath(jsonPath)}`,
    };
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (error) {
    return {
      passed: [],
      failed: [],
      skipped: [],
      parseError: `Failed to parse Vitest JSON: ${error.message}`,
    };
  }

  const passed = [];
  const failed = [];
  const skipped = [];

  const files = raw.testResults ?? raw.files ?? [];
  for (const file of files) {
    const fileName = relPath(file.name ?? file.filePath ?? 'unknown');
    const assertions = file.assertionResults ?? file.tasks ?? [];

    for (const assertion of assertions) {
      if (assertion.type === 'suite') continue;

      const title = assertion.fullName ?? assertion.title ?? assertion.name ?? 'unnamed test';
      const status = assertion.status ?? assertion.result?.state ?? 'unknown';
      const duration = assertion.duration ?? assertion.result?.duration ?? null;
      const entry = { file: fileName, title, duration, status };

      if (status === 'passed') {
        passed.push(entry);
      } else if (status === 'failed') {
        const messages = assertion.failureMessages ?? [];
        const resultError = assertion.result?.errors?.map((e) => e.message ?? String(e)).join('\n');
        entry.failureLog = [...messages, resultError].filter(Boolean).join('\n\n') || 'No failure message recorded.';
        failed.push(entry);
      } else if (status === 'skipped' || status === 'pending') {
        skipped.push(entry);
      }
    }
  }

  return { passed, failed, skipped, rawSummary: raw };
}

function walkPlaywrightSuites(suites, filePath = '', entries = []) {
  for (const suiteEntry of suites ?? []) {
    const suiteTitle = suiteEntry.title ?? '';
    const nextPath = filePath ? `${filePath} > ${suiteTitle}` : suiteTitle;

    for (const spec of suiteEntry.specs ?? []) {
      const specTitle = spec.title ?? 'unnamed spec';
      const fullTitle = nextPath ? `${nextPath} > ${specTitle}` : specTitle;

      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          entries.push({
            file: spec.file ?? suiteEntry.file ?? 'unknown',
            title: fullTitle,
            status: result.status ?? 'unknown',
            duration: result.duration ?? null,
            failureLog: formatPlaywrightError(result),
          });
        }
      }
    }

    walkPlaywrightSuites(suiteEntry.suites, nextPath, entries);
  }
  return entries;
}

function formatPlaywrightError(result) {
  if (!result?.error) return '';
  const parts = [];
  if (result.error.message) parts.push(result.error.message);
  if (result.error.stack) parts.push(result.error.stack);
  if (result.stderr?.length) parts.push('stderr:\n' + result.stderr.join('\n'));
  return parts.join('\n\n');
}

function parsePlaywrightJson(jsonPath) {
  if (!existsSync(jsonPath)) {
    return {
      passed: [],
      failed: [],
      skipped: [],
      parseError: `Playwright JSON output not found: ${relPath(jsonPath)}`,
    };
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (error) {
    return {
      passed: [],
      failed: [],
      skipped: [],
      parseError: `Failed to parse Playwright JSON: ${error.message}`,
    };
  }

  const all = walkPlaywrightSuites(raw.suites ?? []);
  const passed = [];
  const failed = [];
  const skipped = [];

  for (const entry of all) {
    const normalized = {
      file: relPath(entry.file),
      title: entry.title,
      duration: entry.duration,
      status: entry.status,
    };

    if (entry.status === 'passed' || entry.status === 'expected') {
      passed.push(normalized);
    } else if (entry.status === 'failed' || entry.status === 'timedOut' || entry.status === 'interrupted') {
      normalized.failureLog = entry.failureLog || `Test ended with status: ${entry.status}`;
      failed.push(normalized);
    } else if (entry.status === 'skipped') {
      skipped.push(normalized);
    }
  }

  return { passed, failed, skipped, rawSummary: raw };
}

function runVitest(scope) {
  const tmpJson = join(resultsDir, `.tmp-vitest-${Date.now()}.json`);
  const args = ['vitest', 'run', '--reporter=verbose', '--reporter=json', `--outputFile=${tmpJson}`];

  if (scope === 'unit') args.push('../Tests/unit/backend');
  else if (scope === 'api') args.push('../Tests/integration/api');

  const label =
    scope === 'unit'
      ? 'Backend unit (Vitest)'
      : scope === 'api'
        ? 'API integration (Vitest)'
        : 'Backend + API (Vitest)';

  const run = runCommand(label, 'npx', args, { cwd: backendRoot });
  const parsed = parseVitestJson(tmpJson);
  if (existsSync(tmpJson)) unlinkSync(tmpJson);

  return {
    name: label,
    slug: SUITE_SLUG[scope] ?? 'backend',
    scope,
    ...run,
    ...parsed,
  };
}

function runFrontendUnit() {
  const tmpJson = join(resultsDir, `.tmp-vitest-frontend-${Date.now()}.json`);
  const run = runCommand(
    'Frontend unit (Vitest + RTL)',
    'npx',
    ['vitest', 'run', '--reporter=verbose', '--reporter=json', `--outputFile=${tmpJson}`],
    { cwd: join(repoRoot, 'frontend') },
  );
  const parsed = parseVitestJson(tmpJson);
  if (existsSync(tmpJson)) unlinkSync(tmpJson);

  return {
    name: 'Frontend unit (Vitest + RTL)',
    slug: SUITE_SLUG['frontend-unit'],
    scope: 'frontend-unit',
    ...run,
    ...parsed,
  };
}

function runViewportOverflowAudit() {
  const run = runCommand(
    'Viewport overflow audit',
    'node',
    ['scripts/run-viewport-audit.mjs'],
    { cwd: testsRoot },
  );

  const passed = run.exitCode === 0
    ? [{ file: 'Tests/scripts/audit-viewport-overflow.mjs', title: 'Viewport overflow audit', status: 'passed', duration: run.durationMs }]
    : [];
  const failed = run.exitCode !== 0
    ? [{
        file: 'Tests/scripts/audit-viewport-overflow.mjs',
        title: 'Viewport overflow audit',
        status: 'failed',
        duration: run.durationMs,
        failureLog: [run.stdout, run.stderr].filter(Boolean).join('\n').trim() || 'Viewport overflow audit failed',
      }]
    : [];

  return {
    name: 'Viewport overflow audit',
    slug: SUITE_SLUG['viewport-audit'],
    scope: 'viewport-audit',
    ...run,
    passed,
    failed,
    skipped: [],
  };
}

function ensureFrontendBuild() {
  const env = { ...process.env };
  // Playwright preview uses localhost VITE_* — not a production/CI deploy build.
  delete env.CI;
  env.VITE_API_BASE_URL = env.VITE_API_BASE_URL || '/api';
  env.VITE_SITE_URL = env.VITE_SITE_URL || 'http://127.0.0.1:4173';
  env.VITE_WHATSAPP_CONTACT_NUMBER = env.VITE_WHATSAPP_CONTACT_NUMBER || '+919888514572';
  // Omit Sentry for Playwright preview — a placeholder DSN bloats the JS bundle past build:budget.
  delete env.VITE_SENTRY_DSN;
  const buildResult = runCommand('Frontend build (Playwright preview)', 'npm', ['run', 'build', '-w', 'frontend'], {
    cwd: repoRoot,
    env,
  });
  // The sitemap script writes localhost URLs when VITE_SITE_URL=http://127.0.0.1:4173.
  // Restore the committed production versions so the working tree stays clean.
  spawnSync('git', ['restore', 'frontend/public/robots.txt', 'frontend/public/sitemap.xml'], {
    cwd: repoRoot,
    shell: process.platform === 'win32',
  });
  return buildResult;
}

function ensurePlaywrightInstalled() {
  const playwrightPkg = join(testsRoot, 'node_modules', '@playwright', 'test');
  if (existsSync(playwrightPkg)) return null;

  console.log('\n⚠ Playwright not installed in Tests/ — running npm install…');
  const install = runCommand('Tests npm install', 'npm', ['install'], { cwd: testsRoot });
  if (install.exitCode !== 0) return install;

  return runCommand('Playwright Chromium install', 'npx', ['playwright', 'install', 'chromium'], {
    cwd: testsRoot,
  });
}

function runPlaywright() {
  const prep = ensurePlaywrightInstalled();
  if (prep && prep.exitCode !== 0) {
    return {
      name: 'Frontend UI (Playwright)',
      slug: SUITE_SLUG.frontend,
      scope: 'frontend',
      ...prep,
      passed: [],
      failed: [],
      skipped: [],
      parseError: 'Playwright setup failed before tests could run.',
    };
  }

  const build = ensureFrontendBuild();
  if (build && build.exitCode !== 0) {
    return {
      name: 'Frontend UI (Playwright)',
      slug: SUITE_SLUG.frontend,
      scope: 'frontend',
      ...build,
      passed: [],
      failed: [],
      skipped: [],
      parseError: 'Frontend build failed before Playwright could run.',
    };
  }

  const tmpJson = join(resultsDir, `.tmp-playwright-${Date.now()}.json`);
  const run = runCommand(
    'Frontend UI (Playwright)',
    'npx',
    ['playwright', 'test'],
    {
      cwd: testsRoot,
      env: {
        ...process.env,
        PLAYWRIGHT_JSON_OUTPUT: tmpJson,
        // Fresh preview after ensureFrontendBuild(); direct Playwright runs reuse a healthy server.
        PLAYWRIGHT_FORCE_NEW_SERVER: process.env.PLAYWRIGHT_FORCE_NEW_SERVER ?? 'true',
      },
    },
  );

  const parsed = parsePlaywrightJson(tmpJson);
  if (existsSync(tmpJson)) unlinkSync(tmpJson);

  return {
    name: 'Frontend UI (Playwright)',
    slug: SUITE_SLUG.frontend,
    scope: 'frontend',
    ...run,
    ...parsed,
  };
}

function formatDuration(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function renderTestList(entries) {
  if (!entries.length) return '_None_\n';
  return entries
    .map((t) => {
      const dur = t.duration != null ? ` (${formatDuration(t.duration)})` : '';
      return `- **${t.status?.toUpperCase() ?? 'UNKNOWN'}** \`${t.file}\` — ${t.title}${dur}`;
    })
    .join('\n') + '\n';
}

function renderFailures(entries) {
  if (!entries.length) return '_None_\n';
  return entries
    .map((t, i) => {
      const dur = t.duration != null ? formatDuration(t.duration) : '—';
      return [
        `### ${i + 1}. \`${t.file}\` — ${t.title}`,
        '',
        `- **Status:** ${t.status}`,
        `- **Duration:** ${dur}`,
        '',
        '```',
        (t.failureLog ?? 'No failure log captured.').trim(),
        '```',
        '',
      ].join('\n');
    })
    .join('\n');
}

function buildSuiteMarkdown({ completedAt, runId, suiteArg, run, git }) {
  const slug = run.slug ?? 'unknown';
  const passed = run.passed?.length ?? 0;
  const failed = run.failed?.length ?? 0;
  const skipped = run.skipped?.length ?? 0;
  const overallPass = run.exitCode === 0 && failed === 0;

  const lines = [
    '# Lab Door Customs — Test Report',
    '',
    `**Suite:** ${run.name}`,
    `**Completed:** ${formatDisplayDate(completedAt)}`,
    `**Run ID:** \`${runId}\``,
    `**Report slug:** \`${slug}\``,
    `**Command:** \`node Tests/scripts/run-with-report.mjs ${suiteArg}\``,
    `**Result:** ${overallPass ? 'PASS' : 'FAIL'}`,
    '',
    '## Environment',
    '',
    '| Key | Value |',
    '|-----|-------|',
    `| Node | ${process.version} |`,
    `| Platform | ${process.platform} |`,
    `| Git branch | \`${git.branch}\` |`,
    `| Git commit | \`${git.commit}\` |`,
    `| Markdown report | \`${slug}-${runId}.md\` |`,
    `| JSON report | \`${slug}-${runId}.json\` |`,
    '',
    '## Summary',
    '',
    '| Metric | Count |',
    '|--------|-------|',
    `| Passed | ${passed} |`,
    `| Failed | ${failed} |`,
    `| Skipped | ${skipped} |`,
    `| Command duration | ${formatDuration(run.durationMs)} |`,
    `| Exit code | ${run.exitCode} |`,
    '',
    `## ${run.name}`,
    '',
    '| Passed | Failed | Skipped | Duration | Exit code |',
    '|--------|--------|---------|----------|-----------|',
    `| ${passed} | ${failed} | ${skipped} | ${formatDuration(run.durationMs)} | ${run.exitCode} |`,
    '',
  ];

  if (run.parseError) {
    lines.push('> **Parse warning:** ' + run.parseError, '');
  }

  lines.push('### Passed tests', '', renderTestList(run.passed ?? []));
  lines.push('### Failed tests', '', renderTestList(run.failed ?? []));

  if (run.skipped?.length) {
    lines.push('### Skipped tests', '', renderTestList(run.skipped));
  }

  lines.push('### Failure logs (debug)', '', renderFailures(run.failed ?? []));

  if (run.stderr?.trim()) {
    lines.push('### Command stderr', '', '```', run.stderr.trim(), '```', '');
  }

  if (run.failed?.length && run.stdout?.trim()) {
    lines.push('### Command stdout (failed run)', '', '```', run.stdout.trim().slice(-8000), '```', '');
  }

  lines.push(
    '',
    '_Generated by `Tests/scripts/run-with-report.mjs`. See `documentation/test_guidelines.md`._',
    '',
  );

  return lines.join('\n');
}

function buildSummaryMarkdown({ completedAt, runId, runs, git, overallExitCode }) {
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const run of runs) {
    totalPassed += run.passed?.length ?? 0;
    totalFailed += run.failed?.length ?? 0;
    totalSkipped += run.skipped?.length ?? 0;
  }

  const lines = [
    '# Lab Door Customs — Full Test Run Summary',
    '',
    `**Completed:** ${formatDisplayDate(completedAt)}`,
    `**Run ID:** \`${runId}\``,
    `**Command:** \`npm run test:all\` (or \`node Tests/scripts/run-with-report.mjs all\`)`,
    `**Overall result:** ${overallExitCode === 0 ? 'PASS' : 'FAIL'}`,
    '',
    '## Environment',
    '',
    '| Key | Value |',
    '|-----|-------|',
    `| Node | ${process.version} |`,
    `| Platform | ${process.platform} |`,
    `| Git branch | \`${git.branch}\` |`,
    `| Git commit | \`${git.commit}\` |`,
    '',
    '## Totals',
    '',
    '| Metric | Count |',
    '|--------|-------|',
    `| Passed | ${totalPassed} |`,
    `| Failed | ${totalFailed} |`,
    `| Skipped | ${totalSkipped} |`,
    `| Exit code | ${overallExitCode} |`,
    '',
    '## Per-suite reports',
    '',
    '| Suite | Passed | Failed | Skipped | Duration | Exit | Individual report |',
    '|-------|--------|--------|---------|----------|------|-------------------|',
  ];

  for (const run of runs) {
    const slug = run.slug ?? 'unknown';
    lines.push(
      `| ${run.name} | ${run.passed?.length ?? 0} | ${run.failed?.length ?? 0} | ${run.skipped?.length ?? 0} | ${formatDuration(run.durationMs)} | ${run.exitCode} | \`${slug}-${runId}.md\` |`,
    );
  }

  lines.push('', '## Suite details', '');

  for (const run of runs) {
    lines.push(`### ${run.name}`, '');
    if (run.parseError) {
      lines.push('> **Parse warning:** ' + run.parseError, '');
    }
    lines.push('#### Failed tests', '', renderTestList(run.failed ?? []));
    lines.push('#### Failure logs', '', renderFailures(run.failed ?? []));
    lines.push('---', '');
  }

  lines.push(
    '_Generated by `Tests/scripts/run-with-report.mjs`. Individual suite reports are saved alongside this summary._',
    '',
  );

  return {
    markdown: lines.join('\n'),
    summary: { totalPassed, totalFailed, totalSkipped, overallExitCode },
  };
}

function writeSuiteReport(run, { runId, completedAt, suiteArg, git }) {
  const slug = run.slug ?? 'unknown';
  const baseName = `${slug}-${runId}`;
  const mdPath = join(resultsDir, `${baseName}.md`);
  const jsonPath = join(resultsDir, `${baseName}.json`);

  const markdown = buildSuiteMarkdown({ completedAt, runId, suiteArg, run, git });
  const passed = run.passed?.length ?? 0;
  const failed = run.failed?.length ?? 0;
  const skipped = run.skipped?.length ?? 0;

  writeFileSync(mdPath, markdown, 'utf8');
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        runId,
        completedAt: completedAt.toISOString(),
        suite: suiteArg,
        slug,
        name: run.name,
        git,
        summary: {
          passed,
          failed,
          skipped,
          exitCode: run.exitCode,
          durationMs: run.durationMs,
        },
        passed: run.passed ?? [],
        failed: run.failed ?? [],
        skipped: run.skipped ?? [],
        parseError: run.parseError ?? null,
      },
      null,
      2,
    ),
    'utf8',
  );

  return { mdPath, jsonPath, passed, failed };
}

function writeSummaryReport(runs, { runId, completedAt, git, overallExitCode }) {
  const baseName = `summary-${runId}`;
  const mdPath = join(resultsDir, `${baseName}.md`);
  const jsonPath = join(resultsDir, `${baseName}.json`);
  const latestPath = join(resultsDir, 'latest-summary.json');

  const { markdown, summary } = buildSummaryMarkdown({
    completedAt,
    runId,
    runs,
    git,
    overallExitCode,
  });

  writeFileSync(mdPath, markdown, 'utf8');
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        runId,
        completedAt: completedAt.toISOString(),
        suite: 'all',
        git,
        summary,
        suites: runs.map(({ name, slug, exitCode, durationMs, passed, failed, skipped, parseError }) => ({
          name,
          slug,
          exitCode,
          durationMs,
          reportMarkdown: `${slug}-${runId}.md`,
          reportJson: `${slug}-${runId}.json`,
          passed: passed?.length ?? 0,
          failed: failed?.length ?? 0,
          skipped: skipped?.length ?? 0,
          parseError: parseError ?? null,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    latestPath,
    JSON.stringify(
      {
        runId,
        completedAt: completedAt.toISOString(),
        summary,
        summaryMarkdown: `${baseName}.md`,
        suites: runs.map((r) => ({
          slug: r.slug,
          report: `${r.slug}-${runId}.md`,
          exitCode: r.exitCode,
          passed: r.passed?.length ?? 0,
          failed: r.failed?.length ?? 0,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );

  return { mdPath, jsonPath, summary };
}

function resolveRuns(suiteArg) {
  if (suiteArg === 'all') {
    return [
      runVitest('unit'),
      runVitest('api'),
      runFrontendUnit(),
      runPlaywright(),
      runViewportOverflowAudit(),
    ];
  }
  if (suiteArg === 'frontend') {
    return [runPlaywright(), runViewportOverflowAudit()];
  }
  if (suiteArg === 'frontend-unit') {
    return [runFrontendUnit()];
  }
  if (suiteArg === 'viewport-audit') {
    const build = ensureFrontendBuild();
    if (build.exitCode !== 0) {
      return [{
        name: 'Viewport overflow audit',
        slug: SUITE_SLUG['viewport-audit'],
        scope: 'viewport-audit',
        ...build,
        passed: [],
        failed: [],
        skipped: [],
        parseError: 'Frontend build failed before viewport audit could run.',
      }];
    }
    return [runViewportOverflowAudit()];
  }
  if (suiteArg === 'unit' || suiteArg === 'api' || suiteArg === 'vitest') {
    return [runVitest(suiteArg)];
  }
  return null;
}

function main() {
  mkdirSync(resultsDir, { recursive: true });

  const runs = resolveRuns(suite);
  if (!runs) {
    console.error(`Unknown suite "${suite}". Use: all | unit | api | vitest | frontend | frontend-unit | viewport-audit`);
    process.exit(1);
  }

  const runId = formatTimestamp(new Date());
  const git = gitInfo();
  const completedAt = new Date();
  const reportPaths = [];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const run of runs) {
    const suiteArg = runs.length === 1 ? suite : run.scope ?? suite;
    const { mdPath, jsonPath, passed, failed } = writeSuiteReport(run, {
      runId,
      completedAt,
      suiteArg,
      git,
    });
    reportPaths.push({ slug: run.slug, mdPath, jsonPath });
    totalPassed += passed;
    totalFailed += failed;
  }

  const overallExitCode = runs.some((r) => r.exitCode !== 0)
    ? runs.find((r) => r.exitCode !== 0).exitCode
    : 0;

  let summaryInfo = null;
  if (suite === 'all') {
    summaryInfo = writeSummaryReport(runs, { runId, completedAt, git, overallExitCode });
  }

  console.log('\n── Test reports ──');
  for (const { slug, mdPath, jsonPath } of reportPaths) {
    console.log(`  ${slug}: ${relPath(mdPath)}`);
    console.log(`         ${relPath(jsonPath)}`);
  }
  if (summaryInfo) {
    console.log(`  summary: ${relPath(summaryInfo.mdPath)}`);
    console.log(`           ${relPath(summaryInfo.jsonPath)}`);
    console.log(`  latest:  documentation/test-results/latest-summary.json`);
  }

  console.log(
    `\nResult: ${overallExitCode === 0 ? 'PASS' : 'FAIL'} (${totalPassed} passed, ${totalFailed} failed)\n`,
  );

  process.exit(overallExitCode);
}

main();
