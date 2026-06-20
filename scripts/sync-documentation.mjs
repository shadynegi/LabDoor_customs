/**
 * Prepends May 2026 status banner to documentation/*.md files that lack it.
 * Run from LabDoor_customs/: node scripts/sync-documentation.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docDir = path.join(__dirname, '..', 'documentation');

const BANNER = `> **Documentation status (May 2026):** Authoritative reference: [\`info.md\`](info.md). Documentation index: [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md). Phases 1–6 are implemented (resilience, caching, HTTPS, customer soft-delete, frontend perf, GA4/SEO).\n\n`;

const SKIP = new Set([
  'DOCUMENTATION_INDEX.md',
  'SEARCH_CONSOLE_SETUP.md',
]);

let updated = 0;
let skipped = 0;

for (const file of fs.readdirSync(docDir)) {
  if (!file.endsWith('.md')) continue;
  if (SKIP.has(file)) continue;

  const fp = path.join(docDir, file);
  const content = fs.readFileSync(fp, 'utf8');

  if (content.includes('Documentation status (May 2026)')) {
    skipped++;
    continue;
  }

  fs.writeFileSync(fp, BANNER + content);
  updated++;
  console.log('Banner added:', file);
}

console.log(`Done. Updated: ${updated}, already current: ${skipped}`);
