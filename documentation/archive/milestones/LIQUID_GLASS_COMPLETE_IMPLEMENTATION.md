# Liquid Glass UI

liquid-web glass UI components in the storefront.

**Full reference:** [`info.md`](info.md)

Glass-morphism components from liquid-web used for:

- Hero sections and feature cards
- Product detail panels
- Navigation elements
- Call-to-action buttons

Styling integrates with Tailwind/CSS modules alongside liquid-web defaults.

## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 10 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; WhatsApp place-order checkout; order tracking via signed access token. |
| **Admin** | Bulk updates max **500** IDs; manual mark paid requires payment reference + admin note; paid orders cannot cancel (no refunds); product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

