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

1. Find the order by **order number** (e.g. `GSS-...`) from the WhatsApp message — server search supports `order_number`.
2. When payment is confirmed, open the order → **Mark paid** with a payment reference (UPI ID, WhatsApp note, etc.) and admin note.
3. Order moves to `payment_status=completed`, `status=processing`; confirmation email sends if Resend is configured.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `WHATSAPP_ORDER_PHONE` | No | E.164 digits only (default `919888514572`) |

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/checkout/place-order` | Validate cart, create order, return `whatsappUrl` |

Response includes `orderNumber`, `serverOrderId`, `total`, and `whatsappUrl`.

## Automated tests

| Layer | Files | Coverage |
|-------|-------|----------|
| Unit | `Tests/backend/whatsappCheckout.test.ts` | Message formatting, URL encoding, volume/coupon lines |
| API | `Tests/api/checkout.test.ts`, `checkoutWhatsAppIntegration.test.ts` | Validation, happy path, `whatsappUrl` payload, idempotency cache |
| UI | `Tests/frontend/checkout-place-order-ui.spec.ts` | Policy + form + Place Order → mocked `whatsappUrl` |

Product ids in tests come from **`Tests/fixtures/products.ts`** (DB-shaped SERIAL ids, not hardcoded `1`). See [`test_guidelines.md`](test_guidelines.md#product-catalog-fixtures).
