#!/usr/bin/env python3
"""Update remaining documentation markdown files to current-state content."""
import os

DOC = os.path.join(os.path.dirname(__file__), "..", "documentation")
INFO = "../info.md"

def write(name, content):
    path = os.path.join(DOC, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print(f"  {name}")

def ref(title, body):
    return f"# {title}\n\n**Authoritative reference:** [`{INFO}`]({INFO})\n\n{body}\n"

# Domain-specific content
SPECIAL = {
    "SUPABASE_SETUP_INSTRUCTIONS.md": """# Supabase Project Setup

Create and configure Supabase PostgreSQL for Lab Door Customs.

**Full reference:** [`../info.md`](../info.md) | **Database:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

## Steps

1. Create a project at [supabase.com](https://supabase.com).
2. Note the project URL and service role key (backend only — never expose to frontend).
3. Copy the connection pooler URI (port 6543) for `DATABASE_URL`.
4. Run schema SQL from `backend/migrations/` or follow [STEP_BY_STEP_SQL.md](./STEP_BY_STEP_SQL.md).
5. Configure RLS if using Supabase client directly — see [RLS_OPTIMIZATION.md](./RLS_OPTIMIZATION.md).

## Connection

- **App runtime:** PgBouncer pooler on port 6543
- **Migrations:** Direct connection on port 5432
- **TLS:** Set `DB_SSL_CA_PATH` to Supabase CA bundle in production
""",
    "SUPABASE_SQL_TO_RUN.md": """# Supabase SQL Scripts

SQL scripts to initialize and maintain the Lab Door Customs database.

**Full reference:** [`../info.md`](../info.md) | **Setup:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

## Schema files

Located in `backend/migrations/`:

- Core tables: products, orders, order_items, customers, coupons, reviews, contact_messages
- PayPal fields: capture IDs, refund amounts, access token hashes
- Idempotency and refund event tables (also patched at server boot)

## Running SQL

1. Open Supabase SQL Editor or connect via psql with direct URI (port 5432).
2. Run migration files in order.
3. Verify with `GET /api/health` after backend restart.

See [STEP_BY_STEP_SQL.md](./STEP_BY_STEP_SQL.md) for a guided walkthrough.
""",
    "STEP_BY_STEP_SQL.md": """# Step-by-Step SQL

Run database schema and migrations for Lab Door Customs.

**Full reference:** [`../info.md`](../info.md) | **Setup:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

## Prerequisites

- Supabase project created
- Direct connection URI (port 5432) from [GET_DATABASE_URL.md](./GET_DATABASE_URL.md)

## Steps

1. Connect to Supabase SQL Editor.
2. Run scripts from `backend/migrations/` in filename order.
3. Confirm tables exist: products, orders, order_items, customers, coupons, reviews, contact_messages, idempotency_keys, refund_events.
4. Set `DATABASE_URL` to pooler URI (6543) on backend.
5. Start backend — runtime schema patches apply automatically for incremental DDL.

## Verify

```bash
curl http://localhost:5000/api/health
```

Should report database connected.
""",
    "RLS_OPTIMIZATION.md": """# Row-Level Security

Supabase RLS policies for direct client access.

**Full reference:** [`../info.md`](../info.md)

## Architecture note

The production app routes all data access through the Express API with service-role database credentials. RLS policies apply when using the Supabase JavaScript client directly from the browser.

## Recommended policies

- **products:** Public read for active products; admin write via service role only
- **orders:** No public read; customer access via API token validation
- **reviews:** Public read for approved reviews; insert via API
- **contact_messages:** Admin read only

## Summary

See [RLS_OPTIMIZATION_SUMMARY.md](./RLS_OPTIMIZATION_SUMMARY.md) for policy overview.
""",
    "RLS_OPTIMIZATION_SUMMARY.md": """# RLS Summary

Row-level security policy overview for Supabase.

**Full reference:** [`../info.md`](../info.md) | **Details:** [RLS_OPTIMIZATION.md](./RLS_OPTIMIZATION.md)

## Current approach

- Primary data path: Express API → postgres.js (bypasses RLS with server credentials)
- RLS enabled on sensitive tables as defense-in-depth for direct Supabase client usage
- Public storefront never uses service role key in browser

## Tables with RLS

Products (read-only public), reviews (approved only), orders (no public access), admin-only tables for coupons and contact messages.
""",
    "AUDIT_SUMMARY.md": """# Security Controls Reference

Security implementation overview for Lab Door Customs.

**Full reference:** [`../info.md`](../info.md) — see Security and Logging sections

## Authentication

- Admin: bcrypt password hash, HTTP-only session cookie, 24h TTL
- Customer orders: access token (SHA-256 hash stored), required for lookup and capture

## Request protection

- CSRF double-submit on all mutating routes
- Helmet security headers, CSP for PayPal domains
- Rate limiting on login, contact, checkout (Redis-backed in production)
- HTTPS enforced in production via Cloudflare `x-forwarded-proto`

## Payment security

- Server-side pricing only — client totals validated against server calculation
- PayPal webhook signature verification on raw body
- Capture amount mismatch triggers auto-refund
- Idempotency keys prevent duplicate orders and refunds

## Data protection

- Secrets stripped from API responses (access tokens, password hashes)
- Parameterized SQL via postgres.js
- Admin routes require session middleware
""",
    "CRITICAL_FIXES_SUMMARY.md": """# Payment and Order Reliability

Reliability features for checkout, refunds, and order sync.

**Full reference:** [`../info.md`](../info.md) — Checkout and payments section

## Atomic checkout

- Stock decremented in same transaction as pending order creation
- Coupon reservations tied to order lifecycle
- Pending orders expire via maintenance job; stock restored on expiry/cancel

## PayPal integration

- Create-payment → capture → webhook three-path reconciliation
- Webhook amount validation against order total
- Refund idempotency via `refund_events` table and PayPal-Request-Id
- Admin cancel with refund syncs DB only after PayPal confirms

## Idempotency

- Client-supplied idempotency keys on create-payment and refunds
- Reclaim logic for stale pending keys
- Redis + database backing
""",
    "CRITICAL_FIXES_TODO.md": """# Optional Future Enhancements

Items not yet implemented that may be considered for future work.

**Full reference:** [`../info.md`](../info.md)

## Known gaps

- Admin `PATCH /payment-status` can set completed without PayPal verification
- No PayPal dispute/chargeback webhook handlers
- `JWT_SECRET` and PayPal creds not enforced at startup (only Sentry, Redis, etc.)
- Sentry release/source maps not wired in CI
- Frontend security headers depend on static host configuration
- Migration runner is partial — some DDL still applied at server boot
- E2E coverage is smoke-level only

## Deferred by design

- OpenAPI specification
- Category slug routes (`/category/:slug`)

For current capabilities, see [`../info.md`](../info.md).
""",
    "BUGS_AND_FIXES.md": """# Troubleshooting Reference

Common issues and where to find solutions.

**Full reference:** [`../info.md`](../info.md)

| Issue | Guide |
|-------|-------|
| PayPal checkout failures | [diagnose-paypal-issue.md](./diagnose-paypal-issue.md) |
| CORS / CSRF / fetch errors | [DEBUG_FETCH_ERROR.md](./DEBUG_FETCH_ERROR.md) |
| Database connection | [GET_DATABASE_URL.md](./GET_DATABASE_URL.md), [DATABASE_SETUP.md](./DATABASE_SETUP.md) |
| SSL / DNS | [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md) |
| Backend restart | [RESTART_BACKEND.md](./RESTART_BACKEND.md) |
| Form validation | [FORMS_QA_CHECKLIST.md](./FORMS_QA_CHECKLIST.md) |
""",
    "CLEAR_CART_INSTRUCTIONS.md": """# Shopping Cart

How the cart works in Lab Door Customs.

**Full reference:** [`../info.md`](../info.md)

## Storage

- Cart persisted in browser `localStorage` under app-specific key
- Survives page refresh; cleared after successful payment capture

## Behavior

- Add/remove/update quantities on product pages and cart page
- Stock validated server-side at checkout (create-payment)
- Server rejects checkout if items out of stock or quantities exceed inventory

## Clear cart manually

Open browser DevTools → Application → Local Storage → delete cart key, or use cart page remove-all if available.
""",
    "COMPLETE_SYSTEM_VERIFICATION.md": """# Production Readiness Checklist

Verify Lab Door Customs is ready for production.

**Full reference:** [`../info.md`](../info.md) | **Deploy:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## Backend

- [ ] `DATABASE_URL`, `FRONTEND_URL`, `ADMIN_PASSWORD_HASH` set
- [ ] `PAYPAL_WEBHOOK_ID`, `PAYPAL_MODE=live`, live credentials
- [ ] `REDIS_URL`, `SENTRY_DSN`, `TRUST_CLOUDFLARE=true`
- [ ] `GET /api/health` returns all components healthy

## Frontend

- [ ] `VITE_API_BASE_URL`, `VITE_SITE_URL`, `VITE_SENTRY_DSN` set at build
- [ ] Sitemap builds with product URLs
- [ ] PayPal sandbox/live mode matches backend

## Infrastructure

- [ ] Cloudflare DNS + SSL (Full strict) — [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md)
- [ ] PayPal webhook registered — [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md)
- [ ] Resend email configured
- [ ] Search Console verified — [SEARCH_CONSOLE_SETUP.md](./SEARCH_CONSOLE_SETUP.md)

## Functional smoke test

- [ ] Browse products, add to cart, complete PayPal checkout
- [ ] Order confirmation email received
- [ ] Admin login, view order, update status
- [ ] Customer order lookup with token
""",
    "FEATURE_IMPLEMENTATION_SUMMARY.md": """# Platform Features

Implemented capabilities in Lab Door Customs.

**Full reference:** [`../info.md`](../info.md)

## Storefront

Product catalog with search/filters, 360° product viewer, cart, PayPal checkout, order tracking, reviews, contact form, policy pages, SEO sitemap.

## Admin

Dashboard for products, orders, customers, coupons, reviews, contact inbox, activity log, analytics/GSC status.

## Backend

REST API with CSRF, rate limiting, Redis cache, PayPal webhooks, email notifications, maintenance jobs, structured logging, Sentry.
""",
    "ORDERS_FEATURE_SUMMARY.md": """# Orders Capabilities

Order management features in Lab Door Customs.

**Full reference:** [`../info.md`](../info.md) | **Guide:** [ORDER_MANAGEMENT_GUIDE.md](./ORDER_MANAGEMENT_GUIDE.md)

- PayPal-only order creation via create-payment
- Pending → completed → shipped → delivered lifecycle
- Access-token-based customer lookup
- Admin cancel with optional PayPal refund
- Partial and full refunds with remaining-balance guard
- Shipping notifications via email
- Inventory restore on cancel/refund/expiry
""",
    "UI_IMPROVEMENTS.md": """# UI Features

Storefront and admin UI capabilities.

**Full reference:** [`../info.md`](../info.md)

## Storefront

- Liquid-web glass morphism components
- Framer Motion animations
- Responsive layout (mobile-first)
- Sonner toast notifications
- Product carousel, filters, 360° viewer
- Accessible navigation and forms

## Admin

- Tabbed dashboard
- Data tables with search/filter
- Modal forms for CRUD operations
- Status badges for orders and payments
""",
    "RESPONSIVE_SUMMARY.md": """# Responsive Design

Responsive layout approach for Lab Door Customs.

**Full reference:** [`../info.md`](../info.md) | **QA:** [RESPONSIVE_QA_CHECKLIST.md](./RESPONSIVE_QA_CHECKLIST.md)

- Mobile-first CSS with breakpoint-based grid reflow
- Collapsible filters and navigation on small screens
- Touch-friendly targets on product and checkout pages
- Admin tables scroll horizontally on narrow viewports
""",
    "MOBILE_RESPONSIVE.md": """# Mobile Layout

Mobile-specific layout and breakpoints.

**Full reference:** [`../info.md`](../info.md) | **QA:** [RESPONSIVE_QA_CHECKLIST.md](./RESPONSIVE_QA_CHECKLIST.md)

## Breakpoints

Primary testing at 375px (phone), 768px (tablet), 1280px+ (desktop).

## Mobile behavior

- Single-column product grid
- Full-width checkout form fields
- Swipeable hero carousel
- Stacked cart items
- Collapsed admin navigation
""",
    "ERROR_HANDLING_IMPLEMENTATION.md": """# Error Handling

Frontend and backend error handling.

**Full reference:** [`../info.md`](../info.md)

## Backend

- Structured JSON error responses with appropriate HTTP status codes
- Pino logging with request IDs (`X-Request-Id`)
- Sentry capture for unhandled errors in production
- PayPal errors mapped to client-safe messages

## Frontend

- `apiFetch` wrapper with timeout, CSRF retry, credential handling
- Sonner toasts for user-facing errors
- Sentry browser SDK in production
- Graceful fallbacks for network failures
""",
    "IMAGE_FIX_SUMMARY.md": """# Product Images

Product image URLs and display.

**Full reference:** [`../info.md`](../info.md) | **Assets:** [`../frontend/src/assets/MEDIA_ASSET_GUIDE.md`](../frontend/src/assets/MEDIA_ASSET_GUIDE.md)

- Product images stored as URL arrays in database
- Frontend renders primary image with gallery support
- 360° viewer uses separate image sequence field
- Lazy loading on product grids
- Fallback placeholder when image URL missing
""",
    "SONNER_SETUP_COMPLETE.md": """# Toast Notifications

Sonner toast notification usage in Lab Door Customs.

**Full reference:** [`../info.md`](../info.md)

## Usage

- `<Toaster />` mounted in app root
- Success/error/info toasts on form submit, cart actions, checkout
- Admin dashboard uses toasts for CRUD feedback

## Patterns

```typescript
import { toast } from 'sonner';
toast.success('Order updated');
toast.error('Failed to save product');
```
""",
    "LIQUID_WEB_IMPLEMENTATION.md": """# Liquid Web Components

liquid-web integration in the Lab Door Customs storefront.

**Full reference:** [`../info.md`](../info.md)

## Package

Vendored at `Utilities/liquid-web-1.1.1/`. Provides glass-morphism UI primitives.

## Usage

- Glass cards, buttons, and panels on home and product pages
- Consistent blur/transparency aesthetic
- See [LIQUID_GLASS_COMPLETE_IMPLEMENTATION.md](./LIQUID_GLASS_COMPLETE_IMPLEMENTATION.md) for component mapping
""",
    "LIQUID_GLASS_COMPLETE_IMPLEMENTATION.md": """# Liquid Glass UI

liquid-web glass UI components in the storefront.

**Full reference:** [`../info.md`](../info.md)

Glass-morphism components from liquid-web used for:

- Hero sections and feature cards
- Product detail panels
- Navigation elements
- Call-to-action buttons

Styling integrates with Tailwind/CSS modules alongside liquid-web defaults.
""",
    "LIQUID_WEB_TEST_REPORT.md": """# Liquid Web UI Reference

liquid-web component usage and behavior.

**Full reference:** [`../info.md`](../info.md)

Components render correctly across Chrome, Firefox, Safari, and mobile browsers. Backdrop-filter support required for glass effect; degrades gracefully on unsupported browsers.
""",
    "PRICE_TYPE_FIX.md": """# Server-Side Pricing

How pricing is calculated and validated.

**Full reference:** [`../info.md`](../info.md)

## Rules

- All prices computed server-side at create-payment
- Client-submitted totals validated against server calculation
- Mismatch rejects checkout before PayPal redirect
- Coupon discounts applied server-side with scope validation (product/category/global)
- Currency: USD, two decimal places
""",
    "PAYPAL_VERIFICATION_COMPLETE.md": """# PayPal Integration Reference

PayPal Checkout integration in Lab Door Customs.

**Full reference:** [`../info.md`](../info.md) | **Setup:** [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md)

## Flow

1. `POST /api/paypal/create-payment` — creates pending order, PayPal order
2. Customer approves on PayPal
3. `POST /api/paypal/capture` — captures payment, sends confirmation email
4. Webhooks reconcile capture/refund/denial events

## Security

- Webhook signature verification on raw body
- Capture amount validated against order total
- Refund idempotency and remaining-balance guards
""",
    "PAYPAL_INTEGRATION_TEST_REPORT.md": """# PayPal Testing Reference

PayPal integration testing procedures.

**Full reference:** [`../info.md`](../info.md) | **Guide:** [PAYPAL_TESTING_GUIDE.md](./PAYPAL_TESTING_GUIDE.md)

## Automated tests

Backend unit tests cover webhook parsing, refund idempotency, amount validation, and CSRF utilities.

## Manual testing

Follow [PAYPAL_TESTING_GUIDE.md](./PAYPAL_TESTING_GUIDE.md) for end-to-end sandbox checkout, capture, refund, and webhook verification.
""",
    "DATABASE_SETUP_COMPLETE.md": """# Database Setup Reference

Database schema and configuration.

**Full reference:** [`../info.md`](../info.md) | **Guide:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

PostgreSQL on Supabase with tables for products, orders, customers, coupons, reviews, contact messages, idempotency keys, and refund events. Connection via pooler (6543) at runtime, direct (5432) for migrations.
""",
    "MIGRATION_COMPLETE_SUMMARY.md": """# Database Migrations

Migration files and runtime schema patches.

**Full reference:** [`../info.md`](../info.md)

## Files

`backend/migrations/` — SQL scripts for initial schema and incremental changes.

## Runtime patches

Server boot applies incremental DDL for idempotency and refund event tables if not yet migrated.

## Running

Use Supabase SQL Editor or psql with direct connection. See [STEP_BY_STEP_SQL.md](./STEP_BY_STEP_SQL.md).
""",
    "REBRANDING_COMPLETE.md": """# Branding

Lab Door Customs branding assets and usage.

**Full reference:** [`../info.md`](../info.md)

- Site name: Lab Door Customs
- Logo and favicon in `frontend/public/` and `frontend/src/assets/`
- Email templates use branded header/footer
- Meta tags and Open Graph configured via `VITE_SITE_URL`
""",
    "PROJECT_CLEANUP_REPORT.md": """# Project Structure

Repository organization for Lab Door Customs.

**Full reference:** [`../info.md`](../info.md)

```
LabDoor_customs/
├── frontend/          React SPA
├── backend/           Express API
├── documentation/     Guides and references
├── scripts/           Utilities
├── .github/workflows/ CI and cron
└── info.md            Master project reference
```
""",
    "README_UPDATE_REQUIRED.md": """# Documentation Structure

How documentation is organized.

**Full reference:** [`../info.md`](../info.md) | **Index:** [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)

- **`info.md`** — master reference (architecture, security, payments, API, env vars)
- **`documentation/`** — topic guides (setup, deploy, PayPal, orders, QA checklists)
- **`DOCUMENTATION_INDEX.md`** — full file listing with descriptions
""",
    "README copy.md": """# Documentation Archive

Legacy documentation pointer.

**Current documentation:** [`../info.md`](../info.md) and [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)

All guides describe current system behavior. Start with [`../info.md`](../info.md) for the complete project reference.
""",
}

GENERIC = {
    "FIXES_IMPLEMENTED.md": ("System Reference", "current platform capabilities"),
    "IMPLEMENTATION_COMPLETE.md": ("Implementation Reference", "current platform features"),
    "IMPLEMENTATION_SUMMARY.md": ("Platform Summary", "Lab Door Customs capabilities"),
}

print("Updating documentation...")
for name, content in SPECIAL.items():
    write(name, content)

for name, (title, topic) in GENERIC.items():
    write(name, ref(title, f"This document describes **{topic}**.\n\nSee [`{INFO}`]({INFO}) for the complete reference including architecture, security, payments, logging, and API documentation."))

# Frontend media guide
MEDIA = os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "assets", "MEDIA_ASSET_GUIDE.md")
media_content = """# Media Asset Guide

Guidelines for product and site media assets in Lab Door Customs.

**Full reference:** [`../../info.md`](../../info.md)

## Product images

- Store URLs in product `images` array (database)
- Primary image: first URL in array
- 360° sequences: separate field on product record
- Recommended: WebP or optimized JPEG, consistent aspect ratio

## Static assets

Located in `frontend/src/assets/` and `frontend/public/`:

- Logo, favicon, hero images
- Referenced in components via import or public path

## Admin upload

Product images added via admin dashboard as URLs (hosted externally or on CDN).

## Performance

- Lazy load on product grids
- Appropriate sizing for mobile and desktop breakpoints
"""
with open(MEDIA, "w", encoding="utf-8") as f:
    f.write(media_content.strip() + "\n")
print("  frontend/src/assets/MEDIA_ASSET_GUIDE.md")
print("Done.")
