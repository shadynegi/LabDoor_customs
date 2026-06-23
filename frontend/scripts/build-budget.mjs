#!/usr/bin/env node
/**
 * Fails the build if dist/assets exceeds performance budgets.
 * Budgets are post-optimization targets (see documentation/PERFORMANCE_BASELINE.md).
 */
import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distAssets = join(__dirname, '../dist/assets');

/** @type {{ totalAssetsMb: number; imagesMb: number; jsMb: number; maxSingleImageKb: number }} */
const BUDGET = {
  totalAssetsMb: 3.0,
  imagesMb: 2.0,
  jsMb: 1.4,
  maxSingleImageKb: 400,
};

async function listFiles(dir) {
  const names = await readdir(dir);
  const files = [];
  for (const name of names) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isFile()) {
      files.push({ name, size: info.size, ext: extname(name).toLowerCase() });
    }
  }
  return files;
}

let files;
try {
  files = await listFiles(distAssets);
} catch {
  console.error('build-budget: frontend/dist/assets not found — run vite build first');
  process.exit(1);
}

const total = files.reduce((s, f) => s + f.size, 0);
const imgExts = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif', '.svg']);
const images = files.filter((f) => imgExts.has(f.ext)).reduce((s, f) => s + f.size, 0);
const js = files.filter((f) => f.ext === '.js').reduce((s, f) => s + f.size, 0);
const largestImage = files.filter((f) => imgExts.has(f.ext)).sort((a, b) => b.size - a.size)[0];

const failures = [];
const totalMb = total / (1024 * 1024);
const imagesMb = images / (1024 * 1024);
const jsMb = js / (1024 * 1024);

if (totalMb > BUDGET.totalAssetsMb) {
  failures.push(`total assets ${totalMb.toFixed(2)} MB > ${BUDGET.totalAssetsMb} MB`);
}
if (imagesMb > BUDGET.imagesMb) {
  failures.push(`images ${imagesMb.toFixed(2)} MB > ${BUDGET.imagesMb} MB`);
}
if (jsMb > BUDGET.jsMb) {
  failures.push(`JS ${jsMb.toFixed(2)} MB > ${BUDGET.jsMb} MB`);
}
if (largestImage && largestImage.size / 1024 > BUDGET.maxSingleImageKb) {
  failures.push(
    `largest image ${largestImage.name} ${(largestImage.size / 1024).toFixed(0)} KB > ${BUDGET.maxSingleImageKb} KB`
  );
}

console.log('=== Build budget check ===');
console.log(`  Total:  ${totalMb.toFixed(2)} MB (budget ${BUDGET.totalAssetsMb} MB)`);
console.log(`  Images: ${imagesMb.toFixed(2)} MB (budget ${BUDGET.imagesMb} MB)`);
console.log(`  JS:     ${jsMb.toFixed(2)} MB (budget ${BUDGET.jsMb} MB)`);
if (largestImage) {
  console.log(`  Largest image: ${largestImage.name} (${(largestImage.size / 1024).toFixed(0)} KB)`);
}

if (failures.length > 0) {
  console.error('\nbuild-budget FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nbuild-budget: OK');
