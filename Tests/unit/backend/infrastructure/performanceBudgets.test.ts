import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Contract test — keeps documented performance budgets aligned with build-budget.mjs.
 * Full enforcement runs in `npm run build -w frontend` via build:budget.
 */
describe('frontend performance budgets (contract)', () => {
  const repoRoot = join(fileURLToPath(new URL('../../../../', import.meta.url)));
  const budgetPath = join(repoRoot, 'frontend/scripts/build-budget.mjs');
  const source = readFileSync(budgetPath, 'utf8');

  it('build-budget.mjs defines total, image, and JS caps', () => {
    expect(source).toMatch(/totalAssetsMb:\s*3\.0/);
    expect(source).toMatch(/imagesMb:\s*2\.0/);
    expect(source).toMatch(/jsMb:\s*1\.4/);
    expect(source).toMatch(/maxSingleImageKb:\s*400/);
  });

  it('build-budget exits non-zero when dist/assets is missing', () => {
    expect(source).toContain('process.exit(1)');
    expect(source).toContain('frontend/dist/assets not found');
  });
});
