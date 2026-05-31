# Media Asset Guide

Guidelines for product and site media assets in Lab Door Customs.

**Full reference:** [`../../info.md`](../../info.md)

## Product images

- Store URLs in product `images` array (database)
- Primary image: first URL in array
- 360° sequences: separate field on product record
- Recommended: WebP or optimized JPEG, consistent aspect ratio

## Static assets

Located in `frontend/src/assets/` and `frontend/public/`:

- Logo, favicon, hero images
- Referenced in components via import or public path

## Admin upload

Product images added via admin dashboard as URLs (hosted externally or on CDN).

## Performance

- Lazy load on product grids
- Appropriate sizing for mobile and desktop breakpoints
