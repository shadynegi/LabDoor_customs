#!/usr/bin/env node
/**
 * Reports production bundle sizes from frontend/dist.
 * Run after: npm run build -w frontend
 */
import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distAssets = join(__dirname, '../dist/assets');

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function listFiles(dir) {
  try {
    const names = await readdir(dir);
    const files = await Promise.all(
      names.map(async (name) => {
        const path = join(dir, name);
        const info = await stat(path);
        if (!info.isFile()) return null;
        return { name, path, size: info.size, ext: extname(name).toLowerCase() };
      })
    );
    return files.filter(Boolean).sort((a, b) => b.size - a.size);
  } catch {
    return null;
  }
}

const files = await listFiles(distAssets);
if (!files) {
  console.error('measure-dist: frontend/dist/assets not found — run npm run build -w frontend first');
  process.exit(1);
}

const byExt = {};
let total = 0;
for (const f of files) {
  total += f.size;
  byExt[f.ext] = (byExt[f.ext] || 0) + f.size;
}

console.log('=== Lab Door Customs — dist/assets report ===\n');
console.log(`Total: ${formatMb(total)} (${files.length} files)\n`);

console.log('By extension:');
for (const [ext, size] of Object.entries(byExt).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${ext || '(none)'}: ${formatMb(size)}`);
}

console.log('\nTop 15 largest files:');
for (const f of files.slice(0, 15)) {
  console.log(`  ${formatKb(f.size).padStart(10)}  ${f.name}`);
}

const jsTotal = files.filter((f) => f.ext === '.js').reduce((s, f) => s + f.size, 0);
const imgTotal = files.filter((f) => ['.png', '.webp', '.jpg', '.jpeg', '.gif', '.svg'].includes(f.ext))
  .reduce((s, f) => s + f.size, 0);
const cssTotal = files.filter((f) => f.ext === '.css').reduce((s, f) => s + f.size, 0);

console.log('\nSummary:');
console.log(`  Images: ${formatMb(imgTotal)}`);
console.log(`  JS:     ${formatMb(jsTotal)}`);
console.log(`  CSS:    ${formatKb(cssTotal)}`);
