# Order Tracking Setup

Configure customer order lookup.

**Full reference:** [`info.md`](info.md)

---

## How it works

Customers track orders on `/orders` with:

- **Order ID** — `orders.id` UUID (shown in WhatsApp message and track-order link `/orders?orderId={uuid}`)
- **Email** — address used at checkout

No access tokens are generated or emailed. The server verifies `orderId` + `email` match a single order row.

---

## Frontend

| Route | Behavior |
|-------|----------|
| `/orders` | Form for order ID + email; email links pre-fill `?orderId=` only |
| `/payment/success` | Optional confirmation after Place Order (order summary in sessionStorage) |

Lookup uses `POST /api/orders/lookup` (credentials in JSON body, not URL query strings except order ID pre-fill).

---

## Backend

| Endpoint | Purpose |
|----------|---------|
| `POST /api/orders/lookup` | Customer lookup — `{ orderId, email }` |
| `GET /api/orders/access-exchange/:code` | **410 Gone** (legacy) |
| `GET /api/orders/:id` | Admin only |
| `GET /api/orders/number/:orderNumber` | Admin only |

---

## Notifications (after admin Mark paid)

| Channel | Config | Content |
|---------|--------|---------|
| WhatsApp | `WHATSAPP_CONTACT_NUMBER`, optional `WHATSAPP_CLOUD_*` | Payment confirmed; order number + Order ID (UUID); **Track order** link `/orders?orderId={uuid}` |
| WhatsApp | `WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | Payment confirmation text to customer mobile from checkout (optional — skipped when not configured) |

Customer enters checkout email on `/orders` after following a WhatsApp or track-order link that pre-fills `?orderId=`.
