# Troubleshooting Reference

Common issues and where to find solutions.

**Full reference:** [`info.md`](info.md)

| Issue | Guide |
|-------|-------|
| WhatsApp checkout / place-order | [WHATSAPP_CHECKOUT_GUIDE.md](./WHATSAPP_CHECKOUT_GUIDE.md) |
| CORS / CSRF / fetch errors | [DEBUG_FETCH_ERROR.md](./DEBUG_FETCH_ERROR.md) |
| Database connection | [GET_DATABASE_URL.md](./GET_DATABASE_URL.md), [DATABASE_SETUP.md](./DATABASE_SETUP.md) |
| SSL / DNS | [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md) |
| Backend restart | [RESTART_BACKEND.md](./RESTART_BACKEND.md) |
| Form validation | [FORMS_QA_CHECKLIST.md](./FORMS_QA_CHECKLIST.md) |

## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 10 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; `policy_accepted` required; **Place Order** → WhatsApp redirect (`Order ID` = `orders.id` UUID); after admin mark paid → WhatsApp confirmation to customer mobile (Cloud API when configured). |
| **Orders** | Email links pre-fill `?orderId=` on `/orders`; lookup via order ID + checkout email (`POST /api/orders/lookup`); tracked orders in sessionStorage; legacy access-exchange returns **410**; lookup failure message **Order not found**. |
| **Admin** | Bulk updates max **500** IDs; **Mark paid** with external `payment_id` + admin note; paid orders cannot cancel or refund (no-refund policy); product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---
