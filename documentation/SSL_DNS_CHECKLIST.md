# SSL and DNS Checklist

HTTPS and DNS configuration for production.

**Full reference:** [`../info.md`](../info.md) | **Cloudflare:** [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md)

---

## DNS

- [ ] Frontend domain (www) → Cloudflare → Railway frontend
- [ ] API domain (api) → Cloudflare → Railway backend
- [ ] Both records proxied (orange cloud)

---

## SSL/TLS

- [ ] Cloudflare SSL mode: Full (strict)
- [ ] Railway services serve HTTPS
- [ ] Backend enforces HTTPS redirect via `x-forwarded-proto` in production

---

## Backend TLS to database

- [ ] `DB_SSL_CA_PATH` set to Supabase CA bundle
- [ ] `DB_SSL_REJECT_UNAUTHORIZED` defaults to true

---

## Environment

- [ ] `FRONTEND_URL=https://www.yourdomain.com`
- [ ] `VITE_API_BASE_URL=https://api.yourdomain.com/api`
- [ ] `VITE_SITE_URL=https://www.yourdomain.com`
- [ ] `TRUST_CLOUDFLARE=true`

---

## Verify

- [ ] https://www.yourdomain.com loads storefront
- [ ] https://api.yourdomain.com/api/health returns 200
- [ ] No mixed content warnings in browser console
