# WhatsApp checkout guide

Orders are placed through **`POST /api/checkout/place-order`**. There is no online payment processor — the customer completes checkout on the site, the order is saved with `payment_status=pending`, and the browser redirects to WhatsApp with a pre-filled message.

See [`info.md`](info.md) for the full API reference.

## Customer flow

1. Fill checkout form and accept the no-refund policy.
2. Click **Place Order**.
3. Server validates cart, reserves stock, creates a pending order (`payment_method=WhatsApp`).
4. Browser redirects to `https://wa.me/{phone}?text=...` with order details.
5. Customer sends the message; admin confirms payment and marks the order paid in the dashboard.

## Admin flow

1. Find the order by **Order ID** (the `orders.id` UUID from the WhatsApp message) — admin search supports `order_number`, email, name, and **order id**.
2. When payment is confirmed, open the order → **Mark paid** with a payment reference (UPI ID, WhatsApp note, etc.) and admin note.
3. Order moves to `payment_status=completed`, `status=processing`.
4. Customer receives a **confirmation email** (Resend) and a **WhatsApp message** to the mobile number from checkout (WhatsApp Cloud API when `WHATSAPP_CLOUD_ACCESS_TOKEN` and `WHATSAPP_CLOUD_PHONE_NUMBER_ID` are set).

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `WHATSAPP_ORDER_PHONE` | No | E.164 digits only (default `919888514572`) — business number for place-order `wa.me` links |
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | No* | Meta Graph API token for outbound payment confirmation texts |
| `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | No* | WhatsApp Business phone number ID from Meta developer console |

\*Both Cloud API vars are required together to send WhatsApp confirmations automatically. Without them, email still sends when Resend is configured; WhatsApp is skipped with a server log warning.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/checkout/place-order` | Validate cart, create order, return `whatsappUrl` |

Response includes `orderNumber`, `serverOrderId`, `total`, and `whatsappUrl`.

The pre-filled WhatsApp text uses **`Order ID: {serverOrderId}`** (`orders.id` UUID). The human-readable `orderNumber` (e.g. `GSS-...`) is returned in the API and shown on the optional `/payment/success` page as **Order number**; the page **Order ID** field shows the UUID.

## Automated tests

| Layer | Files | Coverage |
|-------|-------|----------|
| Unit | `Tests/backend/whatsappCheckout.test.ts` | Place-order message formatting, URL encoding |
| Unit | `Tests/backend/whatsappNotifications.test.ts` | Payment confirmation message, phone normalization, Cloud API send |
| Unit | `Tests/backend/whatsappNotifications.test.ts` | Payment confirmation message, phone normalization, Cloud API send |
| Unit | `Tests/backend/postPaymentCapture.test.ts` | Email + WhatsApp hooks on mark paid |
| API | `Tests/api/orderTracking.test.ts` | Lookup validation, shipped tracking, deprecated links, admin-only GET |
| API | `Tests/api/whatsappPaymentConfirmation.test.ts` | Mark paid triggers notifications; idempotent skip when already paid |
| API | `Tests/api/checkout.test.ts`, `checkoutWhatsAppIntegration.test.ts` | Validation, happy path, `whatsappUrl` payload, idempotency cache |
| UI | `Tests/frontend/orders-ui.spec.ts` | OrderId+email lookup, sessionStorage, errors, shipped tracking |
| UI | `Tests/frontend/checkout-place-order-ui.spec.ts` | Policy + form + Place Order → mocked `whatsappUrl` |

Product ids in tests come from **`Tests/fixtures/products.ts`** (DB-shaped SERIAL ids, not hardcoded `1`). See [`test_guidelines.md`](test_guidelines.md#product-catalog-fixtures).
