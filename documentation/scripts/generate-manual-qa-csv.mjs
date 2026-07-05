import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** [id, title, notes, description, prerequisites, priority, impact] */
const cases = [
  ['AUTH-001', 'Valid admin login', 'Authentication & authorization — Admin login', '1. Open /admin/login. 2. Enter valid credentials. 3. Submit.', 'Expected: Redirect to /adminshivamdashboard; analytics tab visible; admin_session cookie set (HttpOnly).', 'Known ADMIN_USERNAME and password; access /admin/login', 'High', 'Critical'],
  ['AUTH-002', 'Invalid credentials rejected', 'Authentication & authorization — Admin login', '1. Submit login with wrong password.', 'Expected: Error message; no dashboard access; after 5 failures in 15 min, rate limit message.', 'Wrong password available for test account', 'High', 'Critical'],
  ['AUTH-003', 'Unauthenticated redirect', 'Authentication & authorization — Admin session', '1. Visit /admin. 2. Visit /adminshivamdashboard.', 'Expected: Both redirect to /admin/login.', 'Logged out or incognito browser session', 'High', 'Critical'],
  ['AUTH-004', 'Authenticated /admin redirect', 'Authentication & authorization — Admin session', '1. Visit /admin.', 'Expected: Redirect to dashboard.', 'Admin logged in with valid session', 'Medium', 'Medium'],
  ['AUTH-005', 'Logout invalidates session', 'Authentication & authorization — Admin session', '1. Logout from dashboard. 2. Refresh dashboard. 3. Call protected admin API.', 'Expected: Redirect to login; subsequent admin API returns 401.', 'Admin logged in', 'High', 'Critical'],
  ['AUTH-006', 'CSRF on mutating routes', 'Authentication & authorization — Admin API', '1. Attempt admin POST/PUT/DELETE without X-CSRF-Token. 2. Retry with token from GET /api/csrf-token.', 'Expected: 403 CSRF error without token; request succeeds with valid token.', 'Logged in; browser DevTools open', 'High', 'Critical'],
  ['AUTH-007', 'No admin data on public routes', 'Authentication & authorization — Storefront', '1. Browse /products and /orders without admin cookie. 2. Attempt GET /api/admin/*.', 'Expected: No admin-only data exposed; admin API returns 401.', 'No admin session cookie', 'High', 'High'],
  ['AUTH-008', 'Public cannot list orders by email', 'Authentication & authorization — Orders API', '1. Call deprecated/public enumeration endpoints if documented.', 'Expected: Blocked or 404/401 per security.test.ts.', 'API client (curl/Postman); no auth', 'Medium', 'High'],
  ['SF-001', 'Home page loads', 'Storefront — Home', '1. Open /.', 'Expected: Hero/carousel visible; View All Products navigates to /products.', 'None', 'High', 'High'],
  ['SF-002', 'Global nav (non-home)', 'Storefront — Navigation', '1. Open /products. 2. Check header.', 'Expected: Logo, Orders, and Cart visible; no standalone Products nav icon.', 'On /products page', 'Medium', 'Medium'],
  ['SF-003', 'Catalog list and pagination', 'Storefront — Products', '1. Open /products. 2. Scroll/load more if applicable.', 'Expected: Products with prices; OOS badge when is_out_of_stock or stock === 0.', 'Products exist in database', 'High', 'High'],
  ['SF-004', 'Search and filters', 'Storefront — Products', '1. Use search/sort/price filters. 2. Open /products?q=keyword.', 'Expected: Results match query; URL deep link applies search.', 'Multiple products in catalog', 'High', 'High'],
  ['SF-005', 'Size required before add to cart', 'Storefront — Product detail', '1. Open /product/{public_id}. 2. Click Add to Cart without selecting size. 3. Select size and retry.', 'Expected: Button disabled or error without size; add succeeds after size selected.', 'In-stock product available', 'High', 'Critical'],
  ['SF-006', 'Out of stock product', 'Storefront — Product detail', '1. Open OOS product page.', 'Expected: OOS messaging; add disabled; sticky CTA hidden on mobile.', 'Product marked OOS or stock === 0', 'High', 'High'],
  ['SF-007', '360 video (if configured)', 'Storefront — Product detail', '1. Open product with video_360. 2. Interact with viewer.', 'Expected: MP4 plays/drags; placeholder copy if no video configured.', 'Product with video_360 field set', 'Low', 'Low'],
  ['SF-008', 'Shipping policy rates', 'Storefront — Static content', '1. Open /shipping-policy.', 'Expected: Shows $25 flat shipping and free over $200 (matches checkout).', 'None', 'Medium', 'Medium'],
  ['SF-009', 'Terms governing law', 'Storefront — Static content', '1. Open /terms-of-service.', 'Expected: Governing law shows Punjab, India.', 'None', 'Medium', 'Medium'],
  ['SF-010', 'Sitemap and robots', 'Storefront — SEO', '1. Fetch /sitemap.xml and /robots.txt.', 'Expected: Valid XML; product URLs present when API reachable.', 'Production or staging build deployed', 'Low', 'Low'],
  ['CART-001', 'Empty cart state', 'Cart', '1. Open /cart with empty cart.', 'Expected: Empty message; link to continue shopping.', 'Empty cart', 'Medium', 'Medium'],
  ['CART-002', 'Add/update/remove lines', 'Cart', '1. Add item from PDP. 2. Change quantity. 3. Remove line.', 'Expected: Totals update; badge count in nav matches item count.', 'In-stock product with size selected', 'High', 'Critical'],
  ['CART-003', 'Validate-cart on change', 'Cart', '1. Change quantity. 2. Observe network tab.', 'Expected: POST /api/products/validate-cart runs; prices refresh from server.', 'Item in cart', 'High', 'Critical'],
  ['CART-004', 'Validation failure retry', 'Cart', '1. Break network or block API. 2. Change cart. 3. Click Retry validation.', 'Expected: Error shown; retry recovers when online.', 'Ability to simulate offline/API failure', 'Medium', 'Medium'],
  ['CART-005', 'Cross-tab sync', 'Cart', '1. Open two tabs same origin. 2. Add item in tab A.', 'Expected: Tab B cart updates via BroadcastChannel.', 'Two browser tabs same site', 'Low', 'Low'],
  ['CART-006', 'OOS product blocked', 'Cart', '1. Admin marks product OOS. 2. Refresh cart validation on storefront.', 'Expected: Line shows error; checkout blocked.', 'Item in cart; admin access to toggle OOS', 'High', 'High'],
  ['CHK-001', 'Empty checkout guard', 'Checkout', '1. Open /checkout with empty cart.', 'Expected: Redirect or empty-cart messaging.', 'Empty cart', 'Medium', 'Medium'],
  ['CHK-002', 'Form validation', 'Checkout', '1. Leave required fields blank. 2. Click Place Order.', 'Expected: Toast — complete required fields plus first field hint.', 'Items in cart', 'High', 'High'],
  ['CHK-003', 'Policy gate', 'Checkout', '1. Submit without policy checkbox. 2. Check box and submit.', 'Expected: Blocked until accepted; succeeds after acceptance.', 'Filled form except policy checkbox', 'High', 'Critical'],
  ['CHK-004', 'Country default', 'Checkout', '1. Open checkout form with items in cart.', 'Expected: Country pre-selected to United States.', 'Items in cart', 'Low', 'Low'],
  ['CHK-005', 'Coupon valid', 'Checkout', '1. Enter valid coupon code. 2. Apply.', 'Expected: Discount in summary; server pricing matches display.', 'Active coupon with all scope', 'High', 'High'],
  ['CHK-006', 'Coupon invalid', 'Checkout', '1. Apply invalid code (e.g. INVALID).', 'Expected: Error message; no discount applied.', 'Items in cart', 'High', 'Medium'],
  ['CHK-007', 'Product-scoped coupon', 'Checkout', '1. Build cart with eligible and ineligible items. 2. Apply product-scoped coupon.', 'Expected: Discount only on eligible lines per server totals.', 'Product-scoped coupon and mixed cart', 'Medium', 'High'],
  ['CHK-008', 'Volume discount', 'Checkout', '1. Build cart with 2+ and 5+ item quantities. 2. Review totals.', 'Expected: 10% at 2+ items; 20% at 5+ (before coupon).', 'Sufficient items in cart', 'Medium', 'High'],
  ['CHK-009', 'Free shipping threshold', 'Checkout', '1. Build cart with subtotal >= $200 merchandise before discounts.', 'Expected: Shipping $0 in summary.', 'Large cart', 'Medium', 'Medium'],
  ['CHK-010', 'Total mismatch block', 'Checkout', '1. Alter displayed total via DevTools. 2. Place order.', 'Expected: Server rejects mismatch (> $0.01).', 'Items in cart; DevTools access', 'Medium', 'Critical'],
  ['CHK-011', 'Place order to WhatsApp', 'Checkout', '1. Complete valid form and accept policy. 2. Click Place Order. 3. Observe redirect.', 'Expected: Opens wa.me with order UUID, items, totals; cart clears on next navigation per sessionStorage flag.', 'Valid form; policy accepted; WhatsApp number configured', 'High', 'Critical'],
  ['CHK-012', 'Payment success page', 'Checkout', '1. Complete place-order flow. 2. Land on /payment/success if used.', 'Expected: Order received confirmation displayed.', 'Completed place-order flow', 'Medium', 'Medium'],
  ['CHK-013', 'Payment cancel page', 'Checkout', '1. Open /payment/cancel.', 'Expected: Checkout cancelled copy; cart preserved.', 'None', 'Low', 'Low'],
  ['CHK-014', 'Idempotency', 'Checkout', '1. Rapid double-click Place Order.', 'Expected: Single order created; duplicate idempotency key returns same payload.', 'Valid checkout ready to submit', 'High', 'Critical'],
  ['CHK-015', 'LAN mobile HTTP', 'Checkout', '1. Complete checkout on phone using http://192.168.x.x:5173.', 'Expected: Place order succeeds (createClientId fallback for non-secure context).', 'Phone on same LAN; HTTP dev server', 'Medium', 'Medium'],
  ['ORD-001', 'Email link prefill', 'Orders — Order lookup', '1. Open /orders?orderId={uuid} from email link.', 'Expected: Order ID field prefilled.', 'Email with orderId query param link', 'High', 'High'],
  ['ORD-002', 'Successful lookup', 'Orders — Order lookup', '1. Enter order UUID and checkout email. 2. Submit.', 'Expected: Order status and line items shown.', 'Placed order with known UUID and email', 'High', 'Critical'],
  ['ORD-003', 'Wrong email', 'Orders — Order lookup', '1. Submit lookup with valid UUID and wrong email.', 'Expected: Order not found (uniform message).', 'Valid order UUID; incorrect email', 'High', 'High'],
  ['ORD-004', 'Invalid UUID', 'Orders — Order lookup', '1. Submit malformed order ID.', 'Expected: Validation error or not found.', 'None', 'Medium', 'Medium'],
  ['ORD-005', 'Full page reload clears state', 'Orders — Order lookup', '1. Complete successful lookup. 2. Reload page.', 'Expected: Form empty; order details cleared.', 'After successful lookup', 'Medium', 'Low'],
  ['ORD-006', 'Shipped order tracking', 'Orders — Order tracking', '1. Lookup shipped order with tracking URL.', 'Expected: Tracking link visible and opens carrier URL.', 'Admin marked order shipped with tracking URL', 'High', 'High'],
  ['ORD-007', 'Legacy access-exchange link', 'Orders — Deprecated', '1. Follow legacy access-exchange URL if exists.', 'Expected: 410 or safe error page.', 'Legacy email link format if available', 'Low', 'Low'],
  ['CON-001', 'Form validation', 'Contact', '1. Submit empty form. 2. Submit with invalid email.', 'Expected: Field validation errors shown.', 'On /contact page', 'High', 'Medium'],
  ['CON-002', 'WhatsApp handoff', 'Contact', '1. Fill all fields with valid data. 2. Submit.', 'Expected: wa.me opens with prefilled name/email/subject/message.', 'Valid contact form data', 'High', 'High'],
  ['CON-003', 'Display phone', 'Contact', '1. View contact page.', 'Expected: Phone number matches VITE_WHATSAPP_CONTACT_NUMBER.', 'None', 'Medium', 'Low'],
  ['CON-004', 'Contact submit event', 'Contact — Activity', '1. Grant analytics consent. 2. Submit contact form. 3. Check activity log or admin export.', 'Expected: contact_submit logged; IP anonymized.', 'Analytics consent granted', 'Low', 'Low'],
  ['COOKIE-001', 'Accept all', 'Cookie consent', '1. Open site in fresh session. 2. Accept all cookies.', 'Expected: Banner hides; non-essential scripts allowed per policy.', 'Fresh browser session', 'Medium', 'Medium'],
  ['COOKIE-002', 'Reject non-essential', 'Cookie consent', '1. Open site in fresh session. 2. Reject non-essential cookies.', 'Expected: Essential-only storage applied.', 'Fresh browser session', 'Medium', 'Medium'],
  ['ADM-A01', 'Period presets', 'Admin — Analytics', '1. Switch between day/week/month/year/all periods.', 'Expected: Stats and charts update for each period.', 'Admin logged in; seeded orders (npm run seed:test-data)', 'High', 'High'],
  ['ADM-A02', 'Custom IST range', 'Admin — Analytics', '1. Set From/To dates. 2. Click Apply range.', 'Expected: Dashboard reflects selected IST date range.', 'Admin logged in', 'High', 'High'],
  ['ADM-A03', 'CSV export gating', 'Admin — Analytics', '1. Change custom dates without Apply — verify export disabled. 2. Apply range then export.', 'Expected: Export disabled until Apply; CSV downloads with expected columns.', 'Admin logged in; custom period selected', 'High', 'High'],
  ['ADM-A04', 'Error retry', 'Admin — Analytics', '1. Break network on analytics tab. 2. Click retry when restored.', 'Expected: Error state shown; retry succeeds when network restored.', 'Admin logged in; ability to simulate API failure', 'Medium', 'Medium'],
  ['ADM-P01', 'Create product', 'Admin — Products', '1. Open product modal. 2. Fill name, price, stock, image. 3. Save.', 'Expected: Product appears in admin list and storefront after cache refresh.', 'Admin logged in', 'High', 'Critical'],
  ['ADM-P02', 'Edit product', 'Admin — Products', '1. Edit existing product fields. 2. Save.', 'Expected: Changes persist on storefront.', 'Existing product; admin logged in', 'High', 'High'],
  ['ADM-P03', 'Out-of-stock toggle', 'Admin — Products', '1. Toggle OOS switch on in-stock product.', 'Expected: Optimistic UI update; PUT /api/products/:id; storefront shows OOS.', 'In-stock product; admin logged in', 'High', 'High'],
  ['ADM-P04', 'Low-stock filter', 'Admin — Products', '1. Enable low-stock filter.', 'Expected: Products with stock <= 5 units listed.', 'Product with stock <= 5 exists', 'Medium', 'Medium'],
  ['ADM-P05', 'Inventory movements', 'Admin — Products', '1. Adjust stock. 2. View movement history.', 'Expected: Movement row with delta and timestamp recorded.', 'Existing product; admin logged in', 'Medium', 'Medium'],
  ['ADM-P06', 'Bulk stock delta', 'Admin — Products', '1. Select multiple products. 2. Apply bulk stock delta.', 'Expected: All selected products update stock correctly.', 'Multiple products; admin logged in', 'Medium', 'Medium'],
  ['ADM-P07', 'Media upload', 'Admin — Products', '1. Upload image <= 20 MB via admin. 2. Save product.', 'Expected: Image URL serves correctly; oversized/broken upload rejected.', 'Image file <= 20 MB; admin logged in', 'Medium', 'Medium'],
  ['ADM-P08', 'Pagination', 'Admin — Products', '1. Load more when >50 products exist.', 'Expected: Next page appends without duplicates.', 'More than 50 products in database', 'Low', 'Low'],
  ['ADM-O01', 'Search', 'Admin — Orders', '1. Search by UUID, order number, email, and customer name.', 'Expected: Correct order found for each search type.', 'Seeded orders (GSS-TEST-SEED-*); admin logged in', 'High', 'High'],
  ['ADM-O02', 'Mark paid', 'Admin — Orders', '1. Open pending WhatsApp order. 2. Mark paid with payment_id and admin_note.', 'Expected: payment_status=completed, status=processing; WhatsApp confirmation if Cloud API configured.', 'Pending WhatsApp order; admin logged in', 'High', 'Critical'],
  ['ADM-O03', 'Mark paid validation', 'Admin — Orders', '1. Attempt mark paid without admin_note or payment_id.', 'Expected: Validation error; order remains pending.', 'Pending order; admin logged in', 'High', 'High'],
  ['ADM-O04', 'Status transitions', 'Admin — Orders', '1. Move processing order to shipped with carrier, tracking, and tracking URL.', 'Expected: Customer lookup shows tracking information.', 'Processing order; admin logged in', 'High', 'High'],
  ['ADM-O05', 'Estimated delivery', 'Admin — Orders', '1. Set estimated delivery date in order modal. 2. Save.', 'Expected: Field persists on reload.', 'Open order modal; admin logged in', 'Medium', 'Medium'],
  ['ADM-O06', 'Edit customer details', 'Admin — Orders', '1. Edit customer/shipping on unpaid pending order via modal.', 'Expected: Updates saved and visible on reload.', 'Unpaid pending order; admin logged in', 'High', 'High'],
  ['ADM-O07', 'Edit pending line items', 'Admin — Orders', '1. Change qty, add, or remove line items on unpaid pending order.', 'Expected: Totals recalculated; inventory adjusted.', 'Unpaid pending order; admin logged in', 'High', 'Critical'],
  ['ADM-O08', 'Cancel unpaid pending', 'Admin — Orders', '1. Cancel pending payment order.', 'Expected: Order cancelled; stock restored; coupon released.', 'Pending payment order; admin logged in', 'High', 'High'],
  ['ADM-O09', 'Cancel paid forbidden', 'Admin — Orders', '1. Attempt to cancel paid/completed order.', 'Expected: 403 or UI blocks action.', 'Paid order exists; admin logged in', 'High', 'Critical'],
  ['ADM-O10', 'Delete unpaid', 'Admin — Orders', '1. Delete pending unpaid order.', 'Expected: Row removed; stock and coupon restored.', 'Pending unpaid order; admin logged in', 'Medium', 'Medium'],
  ['ADM-O11', 'Bulk status update', 'Admin — Orders', '1. Select multiple orders. 2. Apply bulk status change.', 'Expected: Valid transitions succeed; invalid transitions rejected.', 'Multiple orders; admin logged in', 'Medium', 'Medium'],
  ['ADM-C01', 'Create coupon (all scope)', 'Admin — Coupons', '1. Enter code, discount %, entire order scope. 2. Create.', 'Expected: Coupon appears in list; works at checkout.', 'Admin logged in', 'High', 'High'],
  ['ADM-C02', 'Create product-scoped coupon', 'Admin — Coupons', '1. Set scope to specific products. 2. Pick products via search. 3. Create.', 'Expected: Scope column shows product count; checkout applies only to those products.', 'Products exist; admin logged in', 'High', 'High'],
  ['ADM-C03', 'Edit coupon', 'Admin — Coupons', '1. Edit description, max uses, expiry, scope. 2. Save.', 'Expected: Updates persist.', 'Existing coupon; admin logged in', 'High', 'Medium'],
  ['ADM-C04', 'Activate/deactivate', 'Admin — Coupons', '1. Deactivate active coupon. 2. Try at checkout.', 'Expected: Inactive coupon rejected at validate endpoint.', 'Active coupon; admin logged in', 'High', 'High'],
  ['ADM-C05', 'Delete coupon', 'Admin — Coupons', '1. Delete unused coupon.', 'Expected: Coupon removed from list.', 'Unused coupon; admin logged in', 'Medium', 'Low'],
  ['ADM-C06', 'Pagination', 'Admin — Coupons', '1. Navigate Next/Previous when >10 coupons exist.', 'Expected: 10 coupons per page; pagination works.', 'More than 10 coupons in database', 'Low', 'Low'],
  ['ADM-U01', 'Search and pagination', 'Admin — Customers', '1. Search for test. 2. Paginate results.', 'Expected: Matching rows only; pagination works.', 'Seeded customers; admin logged in', 'High', 'Medium'],
  ['ADM-U02', 'Admin notes', 'Admin — Customers', '1. Add or edit admin note on customer. 2. Save.', 'Expected: Note persists on reload.', 'Customer row; admin logged in', 'Medium', 'Medium'],
  ['ADM-U03', 'Order history modal', 'Admin — Customers', '1. Open View History. 2. Paginate orders (10/page).', 'Expected: Customer orders listed correctly.', 'Customer with order history; admin logged in', 'Medium', 'Medium'],
  ['ADM-U04', 'Soft delete and restore', 'Admin — Customers', '1. Soft delete test customer. 2. Enable show deleted toggle. 3. Restore customer.', 'Expected: Hidden by default; visible when show deleted enabled; restored customer visible again.', 'Test customer; admin logged in', 'Medium', 'Medium'],
  ['ADM-S01', 'Activity export', 'Admin — Settings', '1. Export activity log as NDJSON with optional date range.', 'Expected: Valid NDJSON file downloads.', 'Activity logs exist; admin logged in', 'Medium', 'Medium'],
  ['ADM-S02', 'Admin sessions list', 'Admin — Settings', '1. View active sessions. 2. Run expired session cleanup.', 'Expected: Stale sessions removed from list.', 'Active admin sessions; admin logged in', 'Low', 'Low'],
  ['ADM-S03', 'Customer recompute', 'Admin — Settings', '1. Run customer aggregate recompute after bulk order changes.', 'Expected: Customer aggregates match order data.', 'Bulk order changes made; admin logged in', 'Low', 'Low'],
  ['API-001', 'Health endpoint', 'API — Health', '1. Send GET /api/health.', 'Expected: success: true; database and Redis status reported.', 'Backend running locally or on staging', 'High', 'Critical'],
  ['API-002', 'POST /api/orders deprecated', 'API — Deprecated', '1. POST /api/orders via curl or Postman.', 'Expected: 410 Gone response.', 'API client; no auth required', 'Medium', 'Medium'],
  ['API-003', 'POST /api/coupons/use deprecated', 'API — Deprecated', '1. POST /api/coupons/use via curl.', 'Expected: 410 Gone response.', 'API client', 'Low', 'Low'],
  ['API-004', 'Coupon validate rate limit', 'API — Rate limits', '1. Send 21+ coupon validate requests within 15 minutes.', 'Expected: 429 response after limit exceeded.', 'Script or load tool', 'Low', 'Medium'],
  ['API-005', 'Admin login rate limit', 'API — Rate limits', '1. Submit 6+ failed admin login attempts.', 'Expected: Rate limited after threshold.', 'Wrong password; API or UI login', 'Medium', 'High'],
  ['API-006', 'Storefront CSRF', 'API — CSRF', '1. POST place-order without CSRF token.', 'Expected: 403 Forbidden.', 'API client without CSRF token', 'High', 'Critical'],
  ['XMOD-001', 'End-to-end order lifecycle', 'Cross-module — Place order to Admin', '1. Place order on storefront. 2. Find in admin. 3. Mark paid. 4. Ship. 5. Customer lookup.', 'Expected: Statuses consistent across modules; stock decremented then fulfilled.', 'Staging environment with full stack', 'High', 'Critical'],
  ['XMOD-002', 'Coupon reservation on cancel', 'Cross-module — Coupon reservation', '1. Place order with coupon. 2. Cancel pending order.', 'Expected: used_count not permanently incremented; coupon available again.', 'Active coupon; pending order', 'Medium', 'High'],
  ['XMOD-003', 'Catalog cache consistency', 'Cross-module — Catalog cache', '1. Edit product price in admin. 2. Validate cart on storefront.', 'Expected: Storefront shows new price after validation.', 'Product in cart; admin access', 'High', 'High'],
  ['XMOD-004', 'No refund policy enforcement', 'Cross-module — No refund policy', '1. Attempt refund or cancel on paid order via UI and API.', 'Expected: Blocked everywhere (API 403).', 'Paid/completed order exists', 'High', 'Critical'],
  ['A11Y-001', 'Label audit script', 'Forms & accessibility', '1. Run node frontend/scripts/audit-form-labels.mjs from repo root.', 'Expected: Output ends with count 0.', 'Repository checkout locally', 'High', 'High'],
  ['A11Y-002', 'Chrome DevTools Issues', 'Forms & accessibility', '1. Open DevTools Issues tab. 2. Exercise /checkout, /contact, /orders, /products, and admin modals.', 'Expected: No missing id/name or label association issues.', 'Desktop Chrome with DevTools', 'High', 'High'],
  ['RSP-001', 'Checkout sticky CTA', 'Responsive — Mobile', '1. Open /checkout at 320px viewport width.', 'Expected: Form usable; policy text not hidden under sticky bar.', 'Items in cart; mobile viewport or device', 'High', 'High'],
  ['RSP-002', 'Admin dashboard mobile', 'Responsive — Mobile', '1. Open orders and products tabs on phone viewport.', 'Expected: Tables scroll horizontally; cards readable.', 'Admin logged in; phone viewport', 'Medium', 'Medium'],
  ['NEG-001', 'Admin API without cookie', 'Negative & security — Auth', '1. GET /api/admin/analytics without admin_session cookie.', 'Expected: 401 Unauthorized.', 'curl or Postman; no auth cookie', 'High', 'Critical'],
  ['NEG-002', 'Place order without items', 'Negative & security — Checkout', '1. POST place-order with empty items array.', 'Expected: 400 validation error.', 'API client with CSRF token', 'Medium', 'High'],
  ['NEG-003', 'Insufficient stock', 'Negative & security — Checkout', '1. Place order with quantity exceeding available stock.', 'Expected: 409 Insufficient stock.', 'Low-stock SKU in database', 'High', 'Critical'],
  ['NEG-004', 'SQL injection in search', 'Negative & security — Orders', '1. Enter SQL injection string in admin order search.', 'Expected: Safe handling; no error leak or data corruption.', 'Admin logged in', 'Low', 'Medium'],
  ['NEG-005', 'Oversized image upload', 'Negative & security — Upload', '1. Attempt admin upload of file > 20 MB.', 'Expected: Rejected with clear error message.', 'Image file > 20 MB; admin logged in', 'Medium', 'Medium'],
];

function escapeCsv(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const headers = [
  'Test Case ID',
  'Test Case',
  'Test Case Description',
  'Notes',
  'Prerequisites',
  'Priority',
  'Impact',
  'Status (Pass/Fail)',
  'Bug',
];

const rows = [headers.join(',')];

for (const [id, title, notes, steps, expected, prereq, priority, impact] of cases) {
  const description = `${steps} ${expected}`;
  rows.push(
    [
      id,
      title,
      description,
      notes,
      prereq,
      priority,
      impact,
      'Not Executed',
      '',
    ]
      .map(escapeCsv)
      .join(',')
  );
}

const outPath = path.join(__dirname, '..', 'manual-qa-test-cases.csv');
fs.writeFileSync(outPath, `${rows.join('\r\n')}\r\n`, 'utf8');
console.log(`Wrote ${cases.length} test cases to ${outPath}`);
