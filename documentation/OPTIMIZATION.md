# Codebase optimization — strategy & execution

Phased plan to audit, sanitize, and optimize Lab Door Customs without speculative refactors. Follow `documentation/behavioural guidelines prompt.mdc`: **surgical changes**, **verifiable success criteria**, **simplicity first**.

**Baseline (auto-generated):** [`OPTIMIZATION_BASELINE.md`](OPTIMIZATION_BASELINE.md) — run `npm run audit:codebase` from repo root.

---

## Phase 0 — Baseline (complete)

| Deliverable | Status |
|-------------|--------|
| `scripts/audit-codebase.mjs` | ✅ depcheck, legacy scan, test file counts |
| `npm run audit:codebase` | ✅ root script |
| `OPTIMIZATION_BASELINE.md` | ✅ regenerated each audit run |

**Verify:** `npm run audit:codebase` writes `documentation/OPTIMIZATION_BASELINE.md`.

---

## Phase 1 — Safe cleanup (complete)

| Task | Status | Notes |
|------|--------|-------|
| PayPal / reviews dead code in `src/` | ✅ Clean | Only tests/comments reference removed features |
| CI `validate-env` alignment | ✅ Fixed | Pooler `DATABASE_URL`, `WHATSAPP_CONTACT_NUMBER`; removed stale `RESEND_API_KEY` |
| Test suite alignment | ✅ 528 tests | No obsolete PayPal route tests in tree |
| Historical `*_COMPLETE.md` | ✅ Archived | `documentation/archive/milestones/` |

**Verify:** `npm test`; CI validate-env step env matches `validateEnv.test.ts` rules.

---

## Phase 2 — Performance (already in place)

| Area | Current state |
|------|----------------|
| Frontend code splitting | ✅ `React.lazy` on all pages in `App.tsx` |
| Vendor chunks | ✅ `react-vendor`, `framer-motion`, `liquid-web` in `vite.config.ts` |
| Bundle budgets | ✅ `build-budget.mjs` + `performanceBudgets.test.ts` |
| DB pooler | ✅ Port 6543 / `prepare=false` in `db.ts` |
| Redis + cache warm | ✅ Production required; `warmCaches()` on boot |
| Bootstrap DDL skip | ✅ `BOOTSTRAP_SKIP_DDL=true` on Railway after migrations |

**Next (optional, quarterly):** `npm run build:analyze -w frontend` when budgets fail.

---

## Phase 3 — CI/CD, DB, security (complete)

| Task | Status |
|------|--------|
| Link checker routes | ✅ `/replacement-policy`, `/admin` added to `scripts/link-check.mjs` |
| Legacy SQL marked | ✅ See [`SUPABASE_SQL_TO_RUN.md`](SUPABASE_SQL_TO_RUN.md) legacy section |
| Env validation tests | ✅ `validateEnv.test.ts` |
| Upload persistence tests | ✅ `upload-persistence.test.ts` |

**Verify:** `npm run links:check`; `npm run validate-env`.

---

## Phase 4 — Documentation hygiene (complete)

| Task | Status |
|------|--------|
| Archive milestone docs | ✅ `documentation/archive/milestones/` |
| Living index updated | ✅ `DOCUMENTATION_INDEX.md`, `README.md` |
| Optimization docs | ✅ This file + `OPTIMIZATION_BASELINE.md` |

**Do not delete** archived files — link checker scans `documentation/` recursively.

---

## Risk management

1. One domain per PR (deps, CI, docs, code).
2. `npm test` (520 + viewport audit) before merge.
3. Staging deploy + `PRE_LAUNCH_CHECKLIST.md` smoke for infra changes.
4. Railway rollback for production issues; DB fixes via forward migrations only.

---

## Quarterly checklist

```bash
npm run audit:codebase
npm test
npm audit --omit=dev
npm run links:check
```

Skim [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md) payment/order rows only — not a full repo re-audit.

---

## Related

| Document | Purpose |
|----------|---------|
| [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) | Remediation log (append-only) |
| [`AUDIT_SUMMARY.md`](AUDIT_SUMMARY.md) | Security controls reference |
| [`PRE_LAUNCH_CHECKLIST.md`](PRE_LAUNCH_CHECKLIST.md) | Production gates |
| [`test_guidelines.md`](test_guidelines.md) | Test inventory (520) |
