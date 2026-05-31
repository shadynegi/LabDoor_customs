# Optional Future Enhancements

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
