# Optional Future Enhancements

Items not yet implemented that may be considered for future work.

**Full reference:** [`../info.md`](../info.md)

## Known gaps

- Admin **Mark paid** can set `payment_status: completed` without PayPal verification (intentional for offline payments; requires `admin_note` and activity log)
- No PayPal dispute/chargeback webhook handlers
- Sentry release/source maps not wired in CI
- Frontend security headers depend on static host configuration
- E2E coverage is smoke-level only
- OpenAPI specification not generated

## Deferred by design

- Category slug routes (`/category/:slug`)

For current capabilities, see [`../info.md`](../info.md).
