#!/usr/bin/env node
/**
 * Runs Vitest or Playwright and writes a timestamped report to Tests/test-results/.
 *
 * Usage: node run-with-report.mjs <vitest|unit|api|frontend|all>
 */

import { spawnSync } from 'node:child_process';
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
const resultsDir = join(testsRoot, 'test-results');

const suite = process.argv[2] ?? 'vitest';

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Filename-safe local timestamp at report completion time. */
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
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });
  const durationMs = Date.now() - started;
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const exitCode = result.status ?? 1;
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
  for (const suite of suites ?? []) {
    const suiteTitle = suite.title ?? '';
    const nextPath = filePath ? `${filePath} > ${suiteTitle}` : suiteTitle;

    for (const spec of suite.specs ?? []) {
      const specTitle = spec.title ?? 'unnamed spec';
      const fullTitle = nextPath ? `${nextPath} > ${specTitle}` : specTitle;

      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          entries.push({
            file: spec.file ?? suite.file ?? 'unknown',
            title: fullTitle,
            status: result.status ?? 'unknown',
            duration: result.duration ?? null,
            failureLog: formatPlaywrightError(result),
          });
        }
      }
    }

    walkPlaywrightSuites(suite.suites, nextPath, entries);
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

  if (scope === 'unit') args.push('../Tests/backend');
  else if (scope === 'api') args.push('../Tests/api');

  const run = runCommand('Vitest (backend + API)', 'npx', args, { cwd: backendRoot });
  const parsed = parseVitestJson(tmpJson);
  if (existsSync(tmpJson)) unlinkSync(tmpJson);

  return {
    name: scope === 'unit' ? 'Backend unit (Vitest)' : scope === 'api' ? 'API (Vitest)' : 'Backend + API (Vitest)',
    ...run,
    ...parsed,
  };
}

function runPlaywright() {
  const tmpJson = join(resultsDir, `.tmp-playwright-${Date.now()}.json`);
  const run = runCommand(
    'Frontend E2E (Playwright)',
    'npx',
    ['playwright', 'test'],
    {
      cwd: testsRoot,
      env: {
        ...process.env,
        PLAYWRIGHT_JSON_OUTPUT: tmpJson,
        CI: process.env.CI ?? '',
      },
    },
  );

  const parsed = parsePlaywrightJson(tmpJson);
  if (existsSync(tmpJson)) unlinkSync(tmpJson);

  return {
    name: 'Frontend E2E (Playwright)',
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

function buildMarkdown({ completedAt, suiteArg, runs, git, overallExitCode }) {
  const stamp = formatTimestamp(completedAt);
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const run of runs) {
    totalPassed += run.passed?.length ?? 0;
    totalFailed += run.failed?.length ?? 0;
    totalSkipped += run.skipped?.length ?? 0;
  }

  const lines = [
    '# Lab Door Customs — Test Report',
    '',
    `**Completed:** ${formatDisplayDate(completedAt)}`,
    `**Report ID:** \`${stamp}\``,
    `**Suite command:** \`${suiteArg}\``,
    `**Overall result:** ${overallExitCode === 0 ? 'PASS' : 'FAIL'}`,
    '',
    '## Environment',
    '',
    `| Key | Value |`,
    `|-----|-------|`,
    `| Node | ${process.version} |`,
    `| Platform | ${process.platform} |`,
    `| Git branch | \`${git.branch}\` |`,
    `| Git commit | \`${git.commit}\` |`,
    `| Report path | \`Tests/test-results/report-${stamp}.md\` |`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Passed | ${totalPassed} |`,
    `| Failed | ${totalFailed} |`,
    `| Skipped | ${totalSkipped} |`,
    `| Exit code | ${overallExitCode} |`,
    '',
  ];

  for (const run of runs) {
    lines.push(`## ${run.name}`, '');
    lines.push(
      `| Passed | Failed | Skipped | Command duration | Exit code |`,
      `|--------|--------|---------|------------------|-----------|`,
      `| ${run.passed?.length ?? 0} | ${run.failed?.length ?? 0} | ${run.skipped?.length ?? 0} | ${formatDuration(run.durationMs)} | ${run.exitCode} |`,
      '',
    );

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

    lines.push('---', '');
  }

  lines.push(
    '_Generated by `Tests/scripts/run-with-report.mjs`. Re-run tests only when explicitly requested (see test_guidelines.md)._',
    '',
  );

  return { stamp, markdown: lines.join('\n'), summary: { totalPassed, totalFailed, totalSkipped, overallExitCode } };
}

function main() {
  mkdirSync(resultsDir, { recursive: true });

  const runs = [];
  let overallExitCode = 0;

  if (suite === 'all') {
    runs.push(runVitest('vitest'));
    runs.push(runPlaywright());
    overallExitCode = runs.some((r) => r.exitCode !== 0)
      ? runs.find((r) => r.exitCode !== 0).exitCode
      : 0;
  } else if (suite === 'frontend') {
    runs.push(runPlaywright());
    overallExitCode = runs[0].exitCode;
  } else if (suite === 'unit' || suite === 'api' || suite === 'vitest') {
    runs.push(runVitest(suite));
    overallExitCode = runs[0].exitCode;
  } else {
    console.error(`Unknown suite "${suite}". Use: vitest | unit | api | frontend | all`);
    process.exit(1);
  }

  const completedAt = new Date();
  const git = gitInfo();
  const { stamp, markdown, summary } = buildMarkdown({
    completedAt,
    suiteArg: suite,
    runs,
    git,
    overallExitCode,
  });

  const reportBase = join(resultsDir, `report-${stamp}`);
  const mdPath = `${reportBase}.md`;
  const jsonPath = `${reportBase}.json`;

  writeFileSync(mdPath, markdown, 'utf8');
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        completedAt: completedAt.toISOString(),
        suite,
        git,
        summary,
        runs: runs.map(({ name, exitCode, durationMs, passed, failed, skipped, parseError }) => ({
          name,
          exitCode,
          durationMs,
          passed,
          failed,
          skipped,
          parseError,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`\nTest report written to ${relPath(mdPath)}`);
  console.log(`JSON summary: ${relPath(jsonPath)}`);
  console.log(`Result: ${summary.overallExitCode === 0 ? 'PASS' : 'FAIL'} (${summary.totalPassed} passed, ${summary.totalFailed} failed)\n`);

  process.exit(overallExitCode);
}

main();
