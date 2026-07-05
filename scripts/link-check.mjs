/**
 * Validates internal documentation links and frontend route references. Skips `documentation/archive/` (historical milestone snapshots with stale relative links).
 * Run from LabDoor_customs/: npm run links:check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DOC_DIR = path.join(ROOT, 'documentation');
const FRONTEND_SRC = path.join(ROOT, 'frontend', 'src');
const INFO_MD = path.join(DOC_DIR, 'info.md');

/** Static React Router paths from frontend/src/App.tsx */
const VALID_ROUTES = new Set([
  '/',
  '/products',
  '/about',
  '/contact',
  '/help',
  '/privacy-policy',
  '/terms-of-service',
  '/returns-policy',
  '/replacement-policy',
  '/shipping-policy',
  '/orders',
  '/admin',
  '/admin/login',
  '/adminshivamdashboard',
  '/cart',
  '/checkout',
  '/payment/success',
  '/payment/cancel',
]);

const ROUTE_PATTERN = /^\/(?:product\/[^/?#]+)?$/;

const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const FRONTEND_LINK_RE = /(?:to|href)\s*=\s*["'](\/[^"'#?]*)["']/g;

const errors = [];

function isExternalLink(target) {
  return /^(?:https?:|mailto:|tel:|javascript:)/i.test(target);
}

function collectMarkdownFiles(dir = DOC_DIR, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'archive') continue;
      collectMarkdownFiles(full, files);
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function resolveMarkdownTarget(fromFile, target) {
  const withoutAnchor = target.split('#')[0];
  if (!withoutAnchor) return null;

  const resolved = path.normalize(path.join(path.dirname(fromFile), withoutAnchor));
  const relative = path.relative(ROOT, resolved);

  if (relative.startsWith('..')) {
    return resolved;
  }
  return resolved;
}

function checkMarkdownLinks(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relFile = path.relative(ROOT, filePath);

  for (const match of content.matchAll(MARKDOWN_LINK_RE)) {
    const target = match[2].trim();
    if (!target || isExternalLink(target) || target.startsWith('#')) continue;

    const resolved = resolveMarkdownTarget(filePath, target);
    if (!resolved || !fs.existsSync(resolved)) {
      errors.push(`[docs] ${relFile}: broken link "${target}"`);
    }
  }
}

function walkDir(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, ext, out);
    } else if (entry.name.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

function isValidFrontendRoute(route) {
  if (VALID_ROUTES.has(route)) return true;
  if (/^\/product\/[^/]+$/.test(route)) return true;
  return false;
}

function checkFrontendRoutes() {
  const files = walkDir(FRONTEND_SRC, '.tsx').concat(walkDir(FRONTEND_SRC, '.ts'));

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relFile = path.relative(ROOT, filePath);

    for (const match of content.matchAll(FRONTEND_LINK_RE)) {
      const route = match[1];
      if (!route || route === '/') continue;
      if (!isValidFrontendRoute(route)) {
        errors.push(`[frontend] ${relFile}: unknown route "${route}"`);
      }
    }
  }
}

function main() {
  console.log('Checking documentation links...');
  const mdFiles = collectMarkdownFiles();
  if (fs.existsSync(INFO_MD) && !mdFiles.includes(INFO_MD)) {
    mdFiles.unshift(INFO_MD);
  }
  for (const file of mdFiles) {
    checkMarkdownLinks(file);
  }

  console.log('Checking frontend internal routes...');
  checkFrontendRoutes();

  if (errors.length === 0) {
    console.log('✅ All checked links and routes are valid.');
    process.exit(0);
  }

  console.error(`\n❌ Found ${errors.length} issue(s):\n`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

main();
