/**
 * Build-time sitemap + robots.txt generator.
 * Usage: VITE_SITE_URL=https://www.example.com node scripts/generate-sitemap.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const SITE_URL = (process.env.VITE_SITE_URL || 'https://www.labdoorcustoms.com').replace(/\/$/, '');
const API_BASE = (process.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

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
    const res = await fetch(`${API_BASE}/products?limit=100&page=1`);
    if (!res.ok) return [];
    const json = await res.json();
    const products = json.data || [];
    return products.map((p) => ({
      path: `/product/${p.id}`,
      changefreq: 'weekly',
      priority: '0.8',
    }));
  } catch {
    console.warn('Sitemap: could not fetch products from API (using static routes only).');
    return [];
  }
}

function buildUrlEntry({ path, changefreq, priority }) {
  const loc = `${SITE_URL}${path}`;
  const lastmod = new Date().toISOString().split('T')[0];
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

async function main() {
  mkdirSync(publicDir, { recursive: true });

  const productRoutes = await fetchProductPaths();
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

  console.log(`Wrote ${allRoutes.length} URLs to public/sitemap.xml`);
  console.log(`Wrote public/robots.txt (Sitemap: ${SITE_URL}/sitemap.xml)`);
}

main();
