# Launch Cost Strategy — Lab Door Customs

Strategic plan for **total cost of going live** at `https://www.labdoorcustoms.com`: account setup, production infrastructure, and **Instagram sponsored ads** (Meta Ads).

**Related:** [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) · [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) · [WHATSAPP_CHECKOUT_GUIDE.md](./WHATSAPP_CHECKOUT_GUIDE.md) · [info.md](./info.md)

**Currency:** USD (approximate, mid-2026). Meta ad rates vary by country — verify on official pricing pages before committing budget.

---

## Executive summary

| Phase | Timing | One-time | Monthly (recurring) |
|-------|--------|----------|---------------------|
| **A — Accounts & domain** | Week 0 | **~$11** | — |
| **B — Production infra (minimum)** | Week 1–2 | — | **~$5** |
| **B — Production infra (recommended)** | Week 2+ | — | **~$30–38** |
| **C — Organic marketing** | Week 2–4 | **$0–200** (optional creative) | **$0** |
| **D — Instagram ads (test)** | Month 2–3 | — | **$150–300** |
| **D — Instagram ads (scale)** | Month 4+ | — | **$500–1,500** |

**Year 1 conservative total (recommended infra + 3-month ad test):**

- Setup: **~$11**
- Infra (12 × ~$35): **~$420**
- Instagram ads (3 × ~$225 avg): **~$675**
- **≈ $1,100 fixed** (no payment-processor fees — customers pay via WhatsApp/UPI/bank; admin confirms manually)

**Year 1 bootstrap total (minimum infra, no paid ads):**

- Setup: **~$11**
- Infra (12 × ~$5): **~$60**
- **≈ $70** (bootstrap; no payment-processor subscription)

---

## Assumptions

| Item | Plan |
|------|------|
| **Domain** | `labdoorcustoms.com` (Cloudflare Registrar) |
| **Canonical URL** | `https://www.labdoorcustoms.com` (matches `FRONTEND_URL` / `VITE_SITE_URL`) |
| **Hosting** | Railway (monorepo root, single Express + SPA) |
| **Database** | Existing Supabase project (migrations applied) |
| **Payments** | WhatsApp checkout + manual admin confirmation |
| **Primary paid channel** | Instagram sponsored ads via **Meta Ads Manager** (Instagram + optional Facebook placement) |
| **Analytics** | GA4 (`VITE_GA4_MEASUREMENT_ID`, consent-gated) + Google Search Console |

Adjust dollar amounts if you are outside the US (ad CPMs and domain pricing differ).

---

## Phase A — Account setup (one-time)

Create these accounts before or during first Railway deploy. None require paid plans at signup.

| # | Service | Purpose | Setup cost | Monthly (default) |
|---|---------|---------|------------|-------------------|
| 1 | **Cloudflare** | Domain + DNS + SSL proxy | **~$10.46/yr** (`.com` registration) | **$0** (Free plan) |
| 2 | **Railway** | Host API + storefront | **$0** signup | **$5** (Hobby plan) |
| 3 | **Supabase** | PostgreSQL (already in use) | **$0** | **$0** (Free) or **$25** (Pro) |
| 4 | **Upstash** | Redis (required in prod) | **$0** | **$0** (Free tier) |
| 5 | **Sentry** | Error tracking (required for prod build) | **$0** | **$0** (Developer) |
| 6 | **WhatsApp Cloud API** | Automated customer texts (optional) | **$0** | Meta free tier for low volume |
| 7 | **WhatsApp Business** | Customer order messages | **$0** | **$0** |
| 8 | **GitHub** | Source + CI | **$0** | **$0** |
| 9 | **Meta Business** | Instagram ads + Meta Pixel | **$0** | Ad spend only |
| 10 | **Google** | Search Console + GA4 | **$0** | **$0** |

### Phase A checklist

- [ ] Register `labdoorcustoms.com` on Cloudflare
- [ ] Create Railway project linked to GitHub repo root
- [ ] Create Upstash Redis database (same region as Supabase when possible)
- [ ] Create Sentry projects (Express + React DSNs)
- [ ] Configure `WHATSAPP_CONTACT_NUMBER` on Railway (E.164) and matching `VITE_WHATSAPP_CONTACT_NUMBER` on frontend build; optional Meta Cloud API vars for automated customer texts
- [ ] Create **Meta Business Portfolio** + connect Instagram professional account
- [ ] Create GA4 property + Search Console property for `www.labdoorcustoms.com`

**Phase A one-time cash outlay: ~$10–11** (domain only).

---

## Phase B — Production infrastructure (recurring)

### Architecture (fixed cost stack)

```
Customer → Cloudflare → Railway (Express + React)
                      → Supabase (PostgreSQL pooler :6543)
                      → Upstash Redis
                      → WhatsApp (customer messages)
                      → WhatsApp Cloud API
                      → Sentry
```

Deploy steps: [DEPLOYMENT.md](./DEPLOYMENT.md) · [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md) · [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md).

### Plan comparison

| Service | Minimum launch | Recommended production |
|---------|----------------|------------------------|
| **Railway Hobby** | $5/mo (includes $5 usage credit) | $5–12/mo (small overages possible) |
| **Cloudflare** | $0 | $0 |
| **Upstash Redis** | $0 (256 MB, 500k cmds/mo) | $0 → $0–10 if traffic spikes |
| **Sentry** | $0 | $0 |
| **WhatsApp Cloud API** | $0 | $0 (pay Meta only at high message volume) |
| **Supabase** | $0 Free | **$25 Pro** (no 7-day pause, backups) |
| **Domain (amortized)** | ~$0.87/mo | ~$0.87/mo |
| **Monthly subtotal** | **~$5–6** | **~$31–38** |

### When to upgrade Supabase to Pro ($25/mo)

Upgrade before marketing spend or steady traffic:

- Free projects **pause after 7 days of inactivity** (bad for demos and quiet weeks)
- Pro adds **8 GB** database, **no auto-pause**, daily backups
- Commercial use is allowed on Free, but Pro is the production-safe choice

### Railway overage note

Hobby is **$5/mo subscription + usage**. The $5 credit often covers a single low-traffic service. Heavy admin analytics, large images, or traffic spikes may add **$3–10/mo** overage.

### Payment processing (WhatsApp checkout)

No online payment processor fees. Customers pay via WhatsApp (UPI, bank transfer, etc.) and admin confirms with **Mark paid**. Budget **staff time** for order confirmation instead of per-transaction fees.

---

## Phase C — Pre-ad marketing (organic, $0 platform cost)

Complete before spending on Instagram ads.

| Task | Cost | Tooling in this project |
|------|------|-------------------------|
| Product photos + 360° MP4s | $0–500 one-time | Admin upload; `video_360` column |
| Instagram business profile + bio link | $0 | Link to `https://www.labdoorcustoms.com` |
| 8–12 organic posts (grid + Reels) | $0 | Phone or Canva |
| Google Search Console | $0 | `VITE_GSC_VERIFICATION` |
| GA4 after cookie consent | $0 | `VITE_GA4_MEASUREMENT_ID` |
| Email on purchase | $0 | WhatsApp (store contact + optional Cloud API) |

**Gate for Phase D:** WhatsApp checkout works on mobile + desktop; product pages load fast; at least 3 strong creatives (static or Reels) ready for ads.

---

## Phase D — Instagram sponsored ads strategy

Instagram ads run through **Meta Ads Manager**. You pay Meta directly; there is no separate “Instagram ads subscription.”

### Why Instagram fits Lab Door Customs

- Visual products (custom shoes, 360° viewers) perform well in **Feed**, **Stories**, and **Reels**
- Meta can optimize for **Landing page views** or **Purchases** once Pixel + events fire
- Retargeting website visitors is cost-effective after Phase C traffic exists

### Meta account setup (no extra fee)

1. **Meta Business Portfolio** — [business.facebook.com](https://business.facebook.com)
2. Connect **Instagram professional account** (same brand as Lab Door Customs)
3. **Meta Pixel** on storefront — install on `www.labdoorcustoms.com` (via Meta Events Manager snippet or tag manager)
4. **Conversions API (CAPI)** — optional later; improves attribution if browser blocks cookies
5. Verify **domain** in Meta Business Settings (matches `FRONTEND_URL`)
6. Checkout on your site — Meta does not process payments; ads drive traffic to **Place Order** → WhatsApp

**Site-side tracking alignment:** Enable GA4 (`VITE_GA4_MEASUREMENT_ID`) for onsite analytics; use Meta Pixel separately for ad optimization and ROAS reporting in Ads Manager.

### Recommended campaign structure (Month 2–3 test)

| Campaign | Objective | Daily budget | Duration | Purpose |
|----------|-----------|--------------|----------|---------|
| **1 — Awareness** | Reach or Video views | $3–5/day | 14 days | Test hooks, 360° / Reels creative |
| **2 — Traffic** | Landing page views | $5–8/day | 14–30 days | Drive to product or collection page |
| **3 — Retargeting** | Sales or Conversions | $3–5/day | 14+ days | Visitors last 7–30 days (after Pixel data) |

**Month 2–3 ad budget:** **$150–300/month** (~$5–10/day average).

Start with **one audience + two creatives**; add variants only after 1,000+ impressions per ad.

### Scale phase (Month 4+, if profitable)

| Signal | Action | Budget |
|--------|--------|--------|
| Cost per purchase **< 30%** of AOV | Increase daily budget 20% every 3–5 days | $500–1,000/mo |
| Stable ROAS **> 2.0** (revenue ÷ ad spend) | Expand placements (Stories + Reels + Advantage+) | $1,000–1,500/mo |
| Creative fatigue (CPM rising, CTR falling) | New photo/Reels batch every 2–3 weeks | Same budget, fresh ads |

### Instagram ad cost benchmarks (planning ranges)

Niche e-commerce varies widely. Use these for **spreadsheet planning**, not guarantees:

| Metric | Conservative | Moderate | Aggressive |
|--------|--------------|----------|------------|
| **CPM** (cost per 1k impressions) | $8–15 | $12–25 | $20–40 |
| **CPC** (cost per click) | $0.50–1.50 | $1–3 | $2–5 |
| **CPM → CTR** | 0.8–1.5% | 1–2% | 1.5–3% |
| **Site conversion** (click → purchase) | 0.5–1.5% | 1–2.5% | 2–4% |
| **Cost per purchase** | $40–80 | $25–50 | $15–35 |

**Example at $225/mo spend, $1.25 CPC:**

- ~180 clicks/month
- At 1.5% conversion → **~2–3 orders/month** from ads (early stage)
- At $80 AOV → **~$160–240 revenue** → likely **below break-even on ads alone** until creative and landing pages improve

This is normal for month 1–2 of paid social. Goal is learning, not profit on day one.

---

## Unit economics worksheet

Fill in your real numbers before scaling ad spend.

```
Average order value (AOV)           = $______
Cost of goods + packaging (COGS)    = $______
Shipping subsidy (if any)           = $______
Gross profit per order              = AOV − COGS − shipping

Target max cost per purchase (CPA)  = 25–30% × AOV  (starter rule)
Required ROAS at scale              = Revenue ÷ Ad spend ≥ 2.0–3.0
```

**Do not scale Instagram budget until:**

`Gross profit per order − CPA > $0` on a **7-day rolling average**, or  
you accept intentional loss-leader spend for brand awareness with a fixed cap.

---

## 90-day rollout timeline and budget

### Month 1 — Go live (no paid ads)

| Week | Actions | Spend |
|------|---------|-------|
| 1 | Buy domain; Railway deploy; Cloudflare DNS; env vars | **~$11** + **$5** Railway |
| 2 | WhatsApp checkout smoke test; optional Cloud API setup; smoke tests | **$5** Railway |
| 3 | Instagram organic content; GSC + GA4; Meta Pixel installed | **$5** Railway |
| 4 | Fix checkout/mobile issues from real device testing | **$5** Railway |

**Month 1 total:** **~$26–36** (domain + minimum infra) or **~$46–56** (if Supabase Pro from day 1).

### Month 2 — Ad learning phase

| Week | Actions | Spend |
|------|---------|-------|
| 1–2 | Campaign 1 (video/Reels awareness), $5/day | **~$70 ads** + **~$35 infra** |
| 3–4 | Campaign 2 (traffic to hero product), $5–8/day | **~$80–110 ads** + **~$35 infra** |

**Month 2 total:** **~$185–220** (recommended infra + ~$150–180 ads).

### Month 3 — Optimize or pause

| Outcome | Action | Spend |
|---------|--------|-------|
| CPA too high | Pause scale; refresh creatives; improve product page | **~$100–150 ads** + infra |
| CPA acceptable | Add retargeting; test 2 new creatives | **~$200–300 ads** + infra |
| Strong ROAS | Increase budget 20%; document winning ad | **~$300–400 ads** + infra |

**Month 3 total:** **~$135–435** depending on ad decision.

### 90-day cumulative (recommended path)

| Category | Low | Mid | High |
|----------|-----|-----|------|
| Domain (one-time) | $11 | $11 | $11 |
| Infra (3 × ~$35) | $105 | $105 | $105 |
| Instagram ads (3 mo) | $0 | $525 | $900 |
| Optional creative (photo/video) | $0 | $200 | $500 |
| **90-day total** | **~$116** | **~$841** | **~$1,516** |

*Low = organic only, minimum infra. Mid = recommended infra + moderate ad test. High = recommended infra + aggressive ad test + paid creative.*

---

## Annual outlook (Year 1)

| Scenario | Infra/year | Ads/year | Setup | Year 1 total |
|----------|------------|----------|-------|--------------|
| **Bootstrap** (Free Supabase, no ads) | ~$60 | $0 | $11 | **~$70** |
| **Soft launch** (Pro Supabase, organic only) | ~$420 | $0 | $11 | **~$430** |
| **Growth** (Pro Supabase, 6 mo ads @ $250/mo avg) | ~$420 | ~$1,500 | $11 | **~$1,930** |
| **Aggressive** (Pro Supabase, 12 mo ads @ $500/mo avg) | ~$420 | ~$6,000 | $11 | **~$6,430** |

Add **COGS/shipping** to margin planning — not included above.

---

## Upgrade triggers

| Trigger | Upgrade | Extra cost |
|---------|---------|------------|
| High outbound message volume | Meta WhatsApp Cloud API pricing | Per Meta rate card |
| >5,000 Sentry errors/month | Sentry Team | ~$26/mo |
| Redis command limit exceeded | Upstash pay-as-you-go | ~$0–10/mo typical |
| Supabase >500 MB or need no-pause | Supabase Pro | $25/mo |
| Railway usage exceeds credit consistently | Stay Hobby or review Pro | $0–15/mo overage or $20/mo Pro |
| Instagram CPA < target for 14 days | Increase ad budget | Your choice |
| Instagram CPA > 40% AOV for 14 days | Pause or replace creatives | $0 (save ad spend) |

---

## Risk and guardrails

1. **Do not run Instagram ads until checkout is Live and tested** — paying for broken funnels wastes budget.
2. **Cap daily ad spend** in Ads Manager (account spending limit) — e.g. $15/day max during learning.
3. **Separate dev and prod mentally** — same Supabase project works for launch but dev mistakes affect live data.
4. **Track MER** (total revenue ÷ total marketing spend) monthly, not only platform ROAS.
5. **All sales final** — ad copy must match store policy ([info.md](./info.md)); no “money-back” claims.

---

## Master checklist

### Infrastructure

- [ ] Domain registered; `www` CNAME → Railway; apex → www redirect
- [ ] Railway env complete ([PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) Phase 2–3)
- [ ] `TRUST_CLOUDFLARE=true` after Cloudflare proxied
- [ ] `/api/health` returns 200 on public domain
- [ ] WhatsApp checkout smoke test passed (place-order → message → mark paid)

### Marketing foundation

- [ ] Instagram professional account live
- [ ] Meta Business + Pixel on production domain
- [ ] GA4 + Search Console configured
- [ ] 3+ ad-ready creatives (1080×1080 feed, 9:16 Reels)
- [ ] Link in bio → `https://www.labdoorcustoms.com`

### Instagram ads launch

- [ ] Campaign budget cap set in Ads Manager
- [ ] Landing URL matches `VITE_SITE_URL` product/collection page
- [ ] UTM parameters on ad URLs (optional: `?utm_source=instagram&utm_medium=paid`)
- [ ] Review performance weekly: CTR, CPC, CPA, ROAS
- [ ] Decision at day 30: scale, iterate creative, or pause

---

## Quick reference links

| Topic | Document |
|-------|----------|
| Deploy Railway + env | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Go-live checklist | [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) |
| Cloudflare + DNS | [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md) |
| WhatsApp checkout | [WHATSAPP_CHECKOUT_GUIDE.md](./WHATSAPP_CHECKOUT_GUIDE.md) |
| Search Console | [SEARCH_CONSOLE_SETUP.md](./SEARCH_CONSOLE_SETUP.md) |
| Media / 360° assets | [MEDIA_ASSET_GUIDE.md](./MEDIA_ASSET_GUIDE.md) |
| System reference | [info.md](./info.md) |

---

*Last updated: 2026-06-10. Revisit quarterly or when switching Supabase tier, Railway plan, or monthly ad budget.*
