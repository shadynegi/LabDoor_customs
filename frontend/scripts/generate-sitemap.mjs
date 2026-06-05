/**
 * Build-time sitemap + robots.txt generator.
 * Usage: VITE_SITE_URL=https://www.example.com node scripts/generate-sitemap.mjs
 *
 * Set SITEMAP_REQUIRE_PRODUCTS=true in CI/deploy to fail when the API returns no products.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const SITE_URL = (process.env.VITE_SITE_URL || 'https://www.labdoorcustoms.com').replace(/\/$/, '');

function resolveApiBase(rawBase, siteUrl) {
  const base = (rawBase || 'http://localhost:5000/api').trim().replace(/\/$/, '');
  if (base.startsWith('/')) {
    return `${siteUrl}${base}`;
  }
  return base;
}

const rawApiBase =
  process.env.SITEMAP_API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  'http://localhost:5000/api';
const API_BASE = resolveApiBase(rawApiBase, SITE_URL);
const isRelativeApiBase = rawApiBase.trim().startsWith('/');
const isStrictBuild =
  process.env.NODE_ENV === 'production' ||
  process.env.CI === 'true' ||
  process.env.VITE_STRICT_ENV === 'true';
const REQUIRE_PRODUCTS =
  process.env.SITEMAP_REQUIRE_PRODUCTS === 'true' ||
  (isStrictBuild &&
    process.env.SITEMAP_REQUIRE_PRODUCTS !== 'false' &&
    !isRelativeApiBase);

const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/products', changefreq: 'daily', priority: '0.9' },
  { path: '/about', changefreq: 'monthly', priority: '0.6' },
  { path: '/contact', changefreq: 'monthly', priority: '0.6' },
  { path: '/help', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms-of-service', changefreq: 'yearly', priority: '0.3' },
  { path: '/returns-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/shipping-policy', changefreq: 'yearly', priority: '0.3' },
];

async function fetchProductPaths() {
  try {
    const sitemapRes = await fetch(`${API_BASE}/products/sitemap-urls`, {
      signal: AbortSignal.timeout(15000),
    });

    if (sitemapRes.ok) {
      const json = await sitemapRes.json();
      const rows = json.data || [];
      return rows.map((p) => ({
        path: p.path || `/product/${p.id}`,
        changefreq: 'weekly',
        priority: '0.8',
        lastmod: p.updated_at ? String(p.updated_at).split('T')[0] : undefined,
      }));
    }

    const all = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const res = await fetch(`${API_BASE}/products?limit=100&page=${page}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) break;

      const json = await res.json();
      const products = json.data || [];
      totalPages = json.pagination?.totalPages || 1;

      all.push(
        ...products.map((p) => ({
          path: `/product/${p.id}`,
          changefreq: 'weekly',
          priority: '0.8',
        }))
      );

      page += 1;
    }

    return all;
  } catch (error) {
    console.warn('Sitemap: could not fetch products from API (using static routes only).', error?.message || error);
    return [];
  }
}

function buildUrlEntry({ path, changefreq, priority, lastmod }) {
  const loc = `${SITE_URL}${path}`;
  const mod = lastmod || new Date().toISOString().split('T')[0];
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${mod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

async function main() {
  mkdirSync(publicDir, { recursive: true });

  const productRoutes = await fetchProductPaths();

  if (REQUIRE_PRODUCTS && productRoutes.length === 0) {
    console.error('Sitemap: SITEMAP_REQUIRE_PRODUCTS=true but no product URLs were fetched.');
    process.exit(1);
  }

  const allRoutes = [...STATIC_ROUTES, ...productRoutes];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes.map(buildUrlEntry).join('\n')}
</urlset>
`;

  const robots = `User-agent: *
Allow: /

Disallow: /admin/
Disallow: /adminshivamdashboard
Disallow: /checkout
Disallow: /cart
Disallow: /payment/

Sitemap: ${SITE_URL}/sitemap.xml
`;

  writeFileSync(join(publicDir, 'sitemap.xml'), sitemap.trim() + '\n');
  writeFileSync(join(publicDir, 'robots.txt'), robots.trim() + '\n');

  console.log(`Wrote ${allRoutes.length} URLs (${productRoutes.length} products) to public/sitemap.xml`);
  console.log(`Wrote public/robots.txt (Sitemap: ${SITE_URL}/sitemap.xml)`);
}

main();
