# Performance baseline & optimization

Lab Door Customs performance tracking. Authoritative architecture: [`info.md`](info.md).

## Pre-optimization baseline (Phase 0 — 2026-06-10)

Captured before the image optimization rollout (`vite build`):

| Metric | Value |
|--------|-------|
| `dist/assets` total | **~7.78 MB** |
| Images (PNG) | **~6.85 MB** |
| JavaScript (raw) | **~943 KB** |
| JavaScript (gzip est.) | **~330 KB** |
| Largest single asset | Background PNGs **~1.0–1.2 MB each** |

### Routes to visually verify after each phase

1. **Home** — all 5 carousel slides (background + shoe visible)
2. **/products** — grid thumbnails, search, filters
3. **/product/:id** — hero image, spin toggle
4. **/cart** — line-item thumbnails
5. **/checkout** — thumbnails, country field, Place Order + policy checkbox
6. **App header** — logos on all pages

### Scripts

```bash
npm run optimize-assets -w frontend   # WebP variants from source PNGs
npm run build -w frontend
npm run measure:dist -w frontend      # Size report
npm run build:budget -w frontend      # Fail if budgets exceeded
```

**Automated contract test:** `Tests/unit/backend/infrastructure/performanceBudgets.test.ts` asserts `build-budget.mjs` thresholds match this document.

## Post-optimization targets

| Metric | Budget (`build-budget.mjs`) |
|--------|----------------------------|
| `dist/assets` total | ≤ **3.0 MB** |
| Images | ≤ **2.0 MB** |
| JS (raw in assets) | ≤ **1.4 MB** |
| Largest single image | ≤ **400 KB** |

## Kept assets (never removed)

- **5 backgrounds:** `blue`, `gold`, `pink`, `brown`, `brown pink` (source PNGs + WebP variants)
- **5 shoe images:** `blue nike`, `gold black nike`, `pink nike`, `black and brown nike`, `brown pink nike`
- **Logos:** `LogoAllPages`, `LogoAllPagesText`, `LogoHomePageText`

## Architecture diagrams

Large PNG diagrams (~79 MB) were removed from `documentation/Diagrams/` to reduce clone size. Filenames are listed in [`Diagrams/README.md`](Diagrams/README.md); restore from git history if needed.

## Post-optimization results (Phases 0–6 complete)

| Metric | Before | After |
|--------|--------|-------|
| `dist/assets` total | ~7.78 MB | **~1.27 MB** |
| Images | ~6.85 MB | **~0.44 MB** |
| JS (raw in assets) | ~0.94 MB | **~0.82 MB** |
| Checkout chunk (gzip) | ~40 KB | **~9 KB** |
| Largest image | ~1.2 MB PNG | **~41 KB WebP** |

## Search

Client-side Fuse.js was replaced with `POST /api/products/search` (Phase 5) — same UI, server-side filtering.
