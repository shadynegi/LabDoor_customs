# SSL and DNS Checklist

HTTPS and DNS configuration for production.

**Full reference:** [`../info.md`](../info.md) | **Cloudflare:** [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md)

---

## DNS

- [ ] Public domain (`www`) → Cloudflare → Railway service (repository root)
- [ ] Record proxied (orange cloud)

---

## SSL/TLS

- [ ] Cloudflare SSL mode: Full (strict)
- [ ] Railway service serves HTTPS behind Cloudflare
- [ ] Backend enforces HTTPS redirect via `x-forwarded-proto` in production

---

## Backend TLS to database

- [ ] `DB_SSL_CA_PATH` set to Supabase CA bundle
- [ ] `DB_SSL_REJECT_UNAUTHORIZED` defaults to true

---

## Environment

- [ ] `FRONTEND_URL=https://www.yourdomain.com`
- [ ] `VITE_API_BASE_URL=/api`
- [ ] `VITE_SITE_URL=https://www.yourdomain.com`
- [ ] `TRUST_CLOUDFLARE=true`

---

## Verify

- [ ] `https://www.yourdomain.com` loads the storefront
- [ ] `https://www.yourdomain.com/api/health` returns 200
- [ ] `https://www.yourdomain.com/sitemap.xml` is reachable
- [ ] No mixed content warnings in the browser console
