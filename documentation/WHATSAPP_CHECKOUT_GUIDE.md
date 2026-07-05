# WhatsApp checkout guide

Orders are placed through **`POST /api/checkout/place-order`**. There is no online payment processor — the customer completes checkout on the site, the order is saved with `payment_status=pending`, and the browser redirects to WhatsApp with a pre-filled message.

See [`info.md`](info.md) for the full API reference.

## Customer flow

1. Fill checkout form and accept the no-refund policy.
2. Click **Place Order**.
3. Server validates cart, reserves stock, creates a pending order (`payment_method=WhatsApp`).
4. Browser redirects to `https://wa.me/{phone}?text=...` with order details.

Checkout sends `X-Idempotency-Key` from `createClientId()` (`frontend/src/lib/clientId.ts`) — `crypto.randomUUID()` when the browser allows it, otherwise an RFC-4122 v4 fallback for phones on **HTTP LAN** (`http://192.168.x.x`).

5. Customer sends the message; admin confirms payment and marks the order paid in the dashboard.

## Admin flow

1. Find the order by **Order ID** (the `orders.id` UUID from the WhatsApp message) — admin search supports `order_number`, email, name, and **order id**.
2. When payment is confirmed, open the order → **Mark paid** with a payment reference (UPI ID, WhatsApp note, etc.) and admin note.
3. Order moves to `payment_status=completed`, `status=processing`.
4. Customer receives a **WhatsApp message** to the mobile number from checkout (WhatsApp Cloud API when `WHATSAPP_CLOUD_ACCESS_TOKEN` and `WHATSAPP_CLOUD_PHONE_NUMBER_ID` are set).

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `WHATSAPP_CONTACT_NUMBER` | Yes (production) | E.164 store contact — place-order `wa.me` links and support |
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | No* | Meta Graph API token for outbound payment/shipping confirmation texts |
| `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | No* | WhatsApp Business phone number ID from Meta developer console |

\*Both Cloud API vars are required together to send WhatsApp confirmations automatically. Without them, checkout still redirects to the store WhatsApp number; automated customer texts are skipped with a server log warning.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/checkout/place-order` | Validate cart, create order, return `whatsappUrl` |

Response includes `orderNumber`, `serverOrderId`, `total`, and `whatsappUrl`.

The pre-filled WhatsApp text uses **`Order ID: {serverOrderId}`** (`orders.id` UUID). The human-readable `orderNumber` (e.g. `GSS-...`) is returned in the API and shown on the optional `/payment/success` page as **Order number**; the page **Order ID** field shows the UUID.

## Automated tests

| Layer | Files | Coverage |
|-------|-------|----------|
| Layer | Path | What it covers |
|-------|------|----------------|
| Unit | `Tests/unit/backend/checkout/whatsappCheckout.test.ts` | Place-order message formatting, URL encoding |
| Unit | `Tests/unit/backend/checkout/clientId.test.ts` | Checkout idempotency key — UUID fallback when `crypto.randomUUID` unavailable |
| Unit | `Tests/unit/backend/checkout/whatsappNotifications.test.ts` | Payment confirmation message, phone normalization, Cloud API send |
| Unit | `Tests/unit/backend/checkout/postPaymentCapture.test.ts` | WhatsApp hooks on admin mark paid |
| API | `Tests/integration/api/orders/lookup.test.ts` | Lookup validation, shipped tracking, deprecated links, admin-only GET |
| API | `Tests/integration/api/orders/whatsapp-payment-confirmation.test.ts` | Mark paid triggers notifications; idempotent skip when already paid |
| API | `Tests/integration/api/checkout/place-order.validation.test.ts`, `place-order.whatsapp.test.ts` | Validation, happy path, `whatsappUrl` payload, idempotency cache |
| UI | `Tests/e2e/specs/orders/orders-ui.spec.ts` | OrderId+email lookup, sessionStorage, errors, shipped tracking |
| UI | `Tests/e2e/specs/checkout/checkout-place-order-ui.spec.ts` | Policy + form + Place Order → mocked `whatsappUrl` |

Product ids in tests come from **`Tests/shared/fixtures/products.ts`** (DB-shaped SERIAL ids, not hardcoded `1`). See [`test_guidelines.md`](test_guidelines.md#product-catalog-fixtures).
