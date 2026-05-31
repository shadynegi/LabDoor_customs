# Google Search Console Setup

Configure Search Console for Lab Door Customs.

**Full reference:** [`../info.md`](../info.md)

---

## Verification

Set in frontend environment:

```
VITE_GSC_VERIFICATION=your_verification_token
```

The app injects the verification meta tag at startup via `searchConsole.ts`.

---

## Sitemap

Build generates `public/sitemap.xml` with:

- Static pages (home, products, policies, etc.)
- Live product URLs from `GET /api/products/sitemap-urls`

Submit in Search Console: `https://www.yourdomain.com/sitemap.xml`

Production builds require product URLs unless `SITEMAP_REQUIRE_PRODUCTS=false`.

---

## robots.txt

Generated alongside sitemap. Disallows admin, checkout, cart, and payment paths.

---

## Admin status

Admin analytics tab shows GSC configuration status and link to Search Console dashboard.
