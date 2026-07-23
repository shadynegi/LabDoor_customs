# Optimization baseline (auto-generated)

**Last run:** 2026-07-05T09:38:51.346Z

Regenerate: `npm run audit:codebase` from repository root.

**Living references:** [`info.md`](info.md) · [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md) · [`test_guidelines.md`](test_guidelines.md)

---

## Test inventory (file counts)

| Suite | Files |
|-------|------:|
| Backend unit (`Tests/unit/backend/`) | 35 |
| API integration (`Tests/integration/api/`) | 21 |
| Frontend unit (`Tests/unit/frontend/`) | 3 |
| Playwright specs (`Tests/e2e/specs/`) | 24 |

**CI marker:** 529 automated tests (141 + 88 + 13 + 286 + 1) — verify with `npm test`.

---

## Dependency audit (depcheck)

### Backend

```
Unused devDependencies
* @types/supertest
* pino-pretty
* supertest
Missing dependencies
* resend: .\dist\lib\email.js
```

### Frontend

```
Unused devDependencies
* @testing-library/jest-dom
* @testing-library/react
* @testing-library/user-event
Missing dependencies
* @emotion/is-prop-valid: .\dist\assets\framer-motion-mqhwQEHC.js
```

> Root `concurrently` is used by `scripts/dev.mjs` (depcheck may false-positive on the root workspace).

---

## Legacy feature scan

| Pattern | Hits in src/Tests |
|---------|-------------------|
| PayPal | 1 file(s) |
| Reviews API / review_votes | 0 file(s) |

- `backend/src/lib/orderSchemaMigrations.ts`

_No live reviews API references in application source._

---

## Frontend bundle

```
> client@0.0.0 measure:dist
> node scripts/measure-dist.mjs

=== Lab Door Customs — dist/assets report ===

Total: 1.25 MB (78 files)

By extension:
  .js: 0.79 MB
  .webp: 0.44 MB
  .css: 0.01 MB

Top 15 largest files:
    254.7 KB  index-DjZiX7AT.js
    124.0 KB  framer-motion-mqhwQEHC.js
    112.4 KB  AdminDashboard-CiFCkR8Z.js
     55.8 KB  liquid-web-BUGbmENA.js
     51.3 KB  react-vendor-DlG7Rx7U.js
     41.4 KB  gold-bg-1280-C3IC4_rY.webp
     38.2 KB  blue-bg-1280-BXznUTej.webp
     38.1 KB  brown-pink-nike-640-BRZxxqDo.webp
     34.7 KB  pink-bg-1280-BsMoTeoh.webp
     32.7 KB  Checkout-Cd89GhB4.js
     32.5 KB  brown-pink-bg-1280-DDoS3Hv0.webp
     32.3 KB  pink-nike-640-BSxwR9gU.webp
     28.3 KB  gold-black-nike-640-CbtgEEiQ.webp
     27.8 KB  logo-all-pages-400-Fy6ADOE7.webp
     26.5 KB  MyOrders-D0RY0GPg.js

Summary:
  Images: 0.44 MB
  JS:     0.79 MB
  CSS:    13.3 KB
```

---

## Recommended quarterly checks

1. `npm run audit:codebase`
2. `npm test` (529 + viewport audit)
3. `npm audit --omit=dev`
4. Skim [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md) payment/order rows only
5. Supabase verification queries in [`SUPABASE_SQL_TO_RUN.md`](SUPABASE_SQL_TO_RUN.md)

