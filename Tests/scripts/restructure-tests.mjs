#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, renameSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testsRoot = join(__dirname, '..');

const MOVES = [
  ['fixtures/products.ts', 'shared/fixtures/products.ts'],
  ['helpers/http.ts', 'shared/helpers/http.ts'],
  ['helpers/adminAuth.ts', 'shared/helpers/adminAuth.ts'],
  ['backend/adminCredentials.test.ts', 'unit/backend/auth/adminCredentials.test.ts'],
  ['backend/adminSession.test.ts', 'unit/backend/auth/adminSession.test.ts'],
  ['backend/cartLineSize.test.ts', 'unit/backend/checkout/cartLineSize.test.ts'],
  ['backend/checkoutPricing.test.ts', 'unit/backend/checkout/checkoutPricing.test.ts'],
  ['backend/clientId.test.ts', 'unit/backend/checkout/clientId.test.ts'],
  ['backend/computeCheckoutPricingForCart.test.ts', 'unit/backend/checkout/computeCheckoutPricingForCart.test.ts'],
  ['backend/paymentIdempotency.test.ts', 'unit/backend/checkout/paymentIdempotency.test.ts'],
  ['backend/postPaymentCapture.test.ts', 'unit/backend/checkout/postPaymentCapture.test.ts'],
  ['backend/whatsappCheckout.test.ts', 'unit/backend/checkout/whatsappCheckout.test.ts'],
  ['backend/whatsappNotifications.test.ts', 'unit/backend/checkout/whatsappNotifications.test.ts'],
  ['backend/contactWhatsAppMessage.test.ts', 'unit/backend/contact/contactWhatsAppMessage.test.ts'],
  ['backend/emailPortalUrl.test.ts', 'unit/backend/orders/orderPortalUrl.test.ts'],
  ['backend/orderAccessExchange.test.ts', 'unit/backend/orders/orderAccessExchange.test.ts'],
  ['backend/orderTokenEncryption.test.ts', 'unit/backend/orders/orderTokenEncryption.test.ts'],
  ['backend/orderTokens.test.ts', 'unit/backend/orders/orderTokens.test.ts'],
  ['backend/productImage.test.ts', 'unit/backend/products/productImage.test.ts'],
  ['backend/productPublicId.test.ts', 'unit/backend/products/productPublicId.test.ts'],
  ['backend/productUpload.test.ts', 'unit/backend/products/productUpload.test.ts'],
  ['backend/productVideo.test.ts', 'unit/backend/products/productVideo.test.ts'],
  ['backend/couponScope.test.ts', 'unit/backend/coupons/couponScope.test.ts'],
  ['backend/couponValidateVolume.test.ts', 'unit/backend/coupons/couponValidateVolume.test.ts'],
  ['backend/adminAnalyticsCache.test.ts', 'unit/backend/analytics/adminAnalyticsCache.test.ts'],
  ['backend/adminAnalyticsDates.test.ts', 'unit/backend/analytics/adminAnalyticsDates.test.ts'],
  ['backend/analyticsIst.test.ts', 'unit/backend/analytics/analyticsIst.test.ts'],
  ['backend/salesAnalytics.test.ts', 'unit/backend/analytics/salesAnalytics.test.ts'],
  ['backend/clientIp.test.ts', 'unit/backend/infrastructure/clientIp.test.ts'],
  ['backend/dbConcurrency.test.ts', 'unit/backend/infrastructure/dbConcurrency.test.ts'],
  ['backend/keepAlive.test.ts', 'unit/backend/infrastructure/keepAlive.test.ts'],
  ['backend/performanceBudgets.test.ts', 'unit/backend/infrastructure/performanceBudgets.test.ts'],
  ['backend/processErrorHandlers.test.ts', 'unit/backend/infrastructure/processErrorHandlers.test.ts'],
  ['backend/rlsGrantRevoke.test.ts', 'unit/backend/infrastructure/rlsGrantRevoke.test.ts'],
  ['backend/rlsMigration.test.ts', 'unit/backend/infrastructure/rlsMigration.test.ts'],
  ['backend/transientDbError.test.ts', 'unit/backend/infrastructure/transientDbError.test.ts'],
  ['api/checkout.test.ts', 'integration/api/checkout/place-order.validation.test.ts'],
  ['api/checkoutWhatsAppIntegration.test.ts', 'integration/api/checkout/place-order.whatsapp.test.ts'],
  ['api/validateCart.test.ts', 'integration/api/checkout/validate-cart.test.ts'],
  ['api/orders.test.ts', 'integration/api/orders/orders.routes.test.ts'],
  ['api/orderPolicyAdmin.test.ts', 'integration/api/orders/order-policy-admin.test.ts'],
  ['api/adminMarkPaid.test.ts', 'integration/api/orders/mark-paid.test.ts'],
  ['api/whatsappPaymentConfirmation.test.ts', 'integration/api/orders/whatsapp-payment-confirmation.test.ts'],
  ['api/adminEnhancements.test.ts', 'integration/api/admin/enhancements.test.ts'],
  ['api/adminAnalytics.test.ts', 'integration/api/admin/analytics.test.ts'],
  ['api/productsSearch.test.ts', 'integration/api/products/search.test.ts'],
  ['api/productUpload.test.ts', 'integration/api/products/upload.test.ts'],
  ['api/activityBatch.test.ts', 'integration/api/activity/batch.test.ts'],
  ['api/activityLog.test.ts', 'integration/api/activity/log.test.ts'],
  ['api/security.test.ts', 'integration/api/security/security.test.ts'],
  ['api/stabilityConcurrency.test.ts', 'integration/api/security/stability-concurrency.test.ts'],
  ['api/health.test.ts', 'integration/api/health.test.ts'],
  ['frontend/fixtures/storefront.ts', 'e2e/fixtures/storefront.ts'],
  ['frontend/fixtures/admin.ts', 'e2e/fixtures/admin.ts'],
  ['frontend/fixtures/mock-data.ts', 'e2e/fixtures/mock-data.ts'],
  ['frontend/helpers/checkout.ts', 'e2e/helpers/checkout.ts'],
  ['frontend/helpers/mock-api.ts', 'e2e/helpers/mock-api.ts'],
  ['frontend/helpers/mock-admin-api.ts', 'e2e/helpers/mock-admin-api.ts'],
  ['frontend/helpers/responsive.ts', 'e2e/helpers/responsive.ts'],
  ['frontend/helpers/ui.ts', 'e2e/helpers/ui.ts'],
  ['frontend/helpers/viewports.ts', 'e2e/helpers/viewports.ts'],
  ['frontend/storefront.spec.ts', 'e2e/specs/storefront/storefront.spec.ts'],
  ['frontend/navigation-ui.spec.ts', 'e2e/specs/storefront/navigation-ui.spec.ts'],
  ['frontend/cookie-consent.spec.ts', 'e2e/specs/storefront/cookie-consent.spec.ts'],
  ['frontend/products-ui.spec.ts', 'e2e/specs/storefront/products-ui.spec.ts'],
  ['frontend/checkout-ui.spec.ts', 'e2e/specs/checkout/checkout-ui.spec.ts'],
  ['frontend/checkout-place-order-ui.spec.ts', 'e2e/specs/checkout/checkout-place-order-ui.spec.ts'],
  ['frontend/cart-ui.spec.ts', 'e2e/specs/checkout/cart-ui.spec.ts'],
  ['frontend/orders-ui.spec.ts', 'e2e/specs/orders/orders-ui.spec.ts'],
  ['frontend/contact-ui.spec.ts', 'e2e/specs/contact/contact-ui.spec.ts'],
  ['frontend/admin-ui.spec.ts', 'e2e/specs/admin/admin-ui.spec.ts'],
  ['frontend/admin-analytics-ui.spec.ts', 'e2e/specs/admin/admin-analytics-ui.spec.ts'],
  ['frontend/mobile-ui.spec.ts', 'e2e/specs/responsive/mobile-ui.spec.ts'],
  ['frontend/responsive-ui.spec.ts', 'e2e/specs/responsive/responsive-ui.spec.ts'],
  ['frontend/responsive-pages-ui.spec.ts', 'e2e/specs/responsive/responsive-pages-ui.spec.ts'],
  ['frontend/deep-flows-ui.spec.ts', 'e2e/specs/regression/deep-flows-ui.spec.ts'],
];

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function moveFile(fromRel, toRel) {
  const from = join(testsRoot, fromRel);
  const to = join(testsRoot, toRel);
  if (!existsSync(from)) {
    console.warn(`skip missing: ${fromRel}`);
    return;
  }
  if (existsSync(to)) {
    console.warn(`skip exists: ${toRel}`);
    return;
  }
  ensureDir(to);
  renameSync(from, to);
  console.log(`moved ${fromRel} -> ${toRel}`);
}

function relImport(fromFile, targetPath) {
  const fromDir = dirname(join(testsRoot, fromFile));
  const target = join(testsRoot, targetPath);
  let rel = relative(fromDir, target).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel.replace(/\.ts$/, '');
}

function rewriteFile(fileRel) {
  const full = join(testsRoot, fileRel);
  if (!existsSync(full)) return;
  let content = readFileSync(full, 'utf8');

  if (fileRel.endsWith('.test.ts')) {
    content = content.replace(
      /from ['"](\.\.\/)+backend\/src\/([^'"]+)['"]/g,
      (_, __, mod) => `from '${relImport(fileRel, `../backend/src/${mod}`)}'`,
    );
    content = content.replace(
      /from ['"](\.\.\/)+setup['"]/g,
      `from '${relImport(fileRel, 'setup.ts')}'`,
    );
    content = content.replace(
      /from ['"](\.\.\/)+helpers\/http['"]/g,
      `from '${relImport(fileRel, 'shared/helpers/http.ts')}'`,
    );
    content = content.replace(
      /from ['"](\.\.\/)+helpers\/adminAuth['"]/g,
      `from '${relImport(fileRel, 'shared/helpers/adminAuth.ts')}'`,
    );
    content = content.replace(
      /from ['"](\.\.\/)+fixtures\/products['"]/g,
      `from '${relImport(fileRel, 'shared/fixtures/products.ts')}'`,
    );
  }

  if (fileRel.startsWith('e2e/')) {
    content = content
      .replace(/from ['"]\.\/fixtures\//g, "from '../../fixtures/")
      .replace(/from ['"]\.\.\/fixtures\//g, "from '../../fixtures/")
      .replace(/from ['"]\.\.\/helpers\//g, "from '../../helpers/");
    if (fileRel === 'e2e/fixtures/mock-data.ts') {
      content = content.replace(
        /from ['"][^'"]*fixtures\/products['"]/,
        `from '${relImport(fileRel, 'shared/fixtures/products.ts')}'`,
      );
    }
  }

  if (fileRel === 'shared/helpers/http.ts') {
    content = content.replace(
      /from ['"][^'"]*backend\/src\/server['"]/,
      `from '${relImport(fileRel, '../backend/src/server.ts')}'`,
    );
  }

  writeFileSync(full, content, 'utf8');
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules' || entry === 'scripts' || entry === 'test-results') continue;
      walk(p, files);
    } else if (/\.(test|spec)\.ts$/.test(entry) || entry === 'http.ts' || entry === 'mock-data.ts') {
      files.push(relative(testsRoot, p).replace(/\\/g, '/'));
    }
  }
  return files;
}

function main() {
  for (const [from, to] of MOVES) moveFile(from, to);

  const obsolete = ['api/orderLookup.test.ts', 'api/orderTracking.test.ts'];
  for (const f of obsolete) {
    const p = join(testsRoot, f);
    if (existsSync(p)) {
      unlinkSync(p);
      console.log(`deleted obsolete ${f}`);
    }
  }

  for (const file of walk(testsRoot)) rewriteFile(file);
  console.log('Done.');
}

main();
