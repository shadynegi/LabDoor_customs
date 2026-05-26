# Google Search Console Setup — Lab Door Customs

Use this guide after deploying the frontend with `public/sitemap.xml` and `public/robots.txt` (generated via `npm run sitemap` in `frontend/`).

---

## Prerequisites

| Item | Example |
|------|---------|
| Live site on HTTPS | `https://www.labdoorcustoms.com` |
| `VITE_SITE_URL` | Same origin as the public site (no trailing slash) |
| Sitemap reachable | `https://www.labdoorcustoms.com/sitemap.xml` |
| `robots.txt` | `https://www.labdoorcustoms.com/robots.txt` |

Regenerate sitemap before each production deploy:

```bash
cd frontend
VITE_SITE_URL=https://www.labdoorcustoms.com \
VITE_API_BASE_URL=https://api.yourdomain.com/api \
npm run sitemap
npm run build
```

---

## 1. Add property in Search Console

1. Open [Google Search Console](https://search.google.com/search-console).
2. Click **Add property** → choose **URL prefix** (recommended) or **Domain**.
3. Enter your production URL, e.g. `https://www.labdoorcustoms.com`.

---

## 2. Verify ownership (DNS TXT — Domain property)

If you use a **Domain** property (`labdoorcustoms.com`):

1. Search Console shows a TXT record, e.g.  
   `google-site-verification=XXXXXXXXXXXXXXXX`
2. In your DNS provider (Cloudflare, Route53, etc.), add:

| Type | Name / Host | Value |
|------|-------------|--------|
| TXT | `@` or root | `google-site-verification=...` (exact string from Console) |

3. Wait for DNS propagation (minutes to 48h).
4. Click **Verify** in Search Console.

### URL-prefix alternatives

- **HTML file upload:** download verification file → place in `frontend/public/` → rebuild → deploy.
- **HTML meta tag:** add to `frontend/index.html` temporarily, deploy, verify, then remove if desired.

---

## 3. Submit sitemap

1. In Search Console → **Sitemaps** (left menu).
2. Enter: `sitemap.xml` (not the full URL if using URL-prefix property).
3. Click **Submit**.
4. Status should move to **Success** after Google crawls (may take hours).

Verify manually:

```bash
curl -I https://www.labdoorcustoms.com/sitemap.xml
curl https://www.labdoorcustoms.com/robots.txt
```

`robots.txt` should include:

```text
Sitemap: https://www.labdoorcustoms.com/sitemap.xml
```

---

## 4. Request indexing (optional)

For important URLs (home, `/products`, key product pages):

1. **URL Inspection** → paste full URL → **Request indexing**.

---

## 5. Align with GA4 (Phase 6)

- Set `VITE_GA4_MEASUREMENT_ID` in production frontend env.
- Users must accept **Analytics cookies** in the footer cookie banner for GA4 to load.
- Link Search Console property with the same GA4 property in Google Analytics (Admin → Product links) for combined reporting.

---

## 6. Ongoing maintenance

| When | Action |
|------|--------|
| New public routes | Add path to `frontend/scripts/generate-sitemap.mjs` `STATIC_ROUTES` |
| New products | Re-run `npm run sitemap` before deploy (fetches from API) |
| Staging | Use `noindex` or block staging in `robots.txt` — do not submit staging sitemap |

---

## Sign-off checklist

- [ ] Property verified in Search Console
- [ ] `sitemap.xml` submitted and accepted
- [ ] `robots.txt` returns 200 and lists sitemap URL
- [ ] HTTPS works on canonical domain (see `documentation/SSL_DNS_CHECKLIST.md`)
- [ ] Production `VITE_SITE_URL` matches Search Console property

**Last verified:** _fill on deploy_
