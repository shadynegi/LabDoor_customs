# Toast Notifications

Sonner toast notification usage in Lab Door Customs.

**Full reference:** [`info.md`](info.md)


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
