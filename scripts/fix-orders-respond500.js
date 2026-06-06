const fs = require('fs');
const path = require('path');

const fp = path.join(__dirname, '../backend/src/routes/orders.ts');
let c = fs.readFileSync(fp, 'utf8');

if (!c.includes("import { respond500 }")) {
  c = c.replace(
    "import { logger } from '../lib/logger';",
    "import { logger } from '../lib/logger';\nimport { respond500 } from '../lib/safeError';"
  );
}

if (!c.includes("from '../lib/orderStatus'")) {
  c = c.replace(
    "import { getClientIp } from '../lib/clientIp';",
    "import { getClientIp } from '../lib/clientIp';\nimport { validateStatusTransition, type OrderStatus } from '../lib/orderStatus';"
  );
  c = c.replace(
    /\/\/ ============================================\n\/\/ ORDER STATUS STATE MACHINE[\s\S]*?\/\/ ============================================\n\/\/ INVENTORY MANAGEMENT/,
    '// ============================================\n// INVENTORY MANAGEMENT'
  );
}

if (!c.includes('payment_id (PayPal capture ID) is required')) {
  c = c.replace(
    `    if (
      payment_status === 'completed' &&
      currentOrder[0].payment_status === 'pending' &&
      (!admin_note || String(admin_note).trim().length < 3)
    ) {
      return res.status(400).json({
        success: false,
        error: 'admin_note is required (min 3 characters) when manually marking an order paid',
      });
    }`,
    `    if (
      payment_status === 'completed' &&
      currentOrder[0].payment_status === 'pending'
    ) {
      if (!admin_note || String(admin_note).trim().length < 3) {
        return res.status(400).json({
          success: false,
          error: 'admin_note is required (min 3 characters) when manually marking an order paid',
        });
      }
      if (!payment_id || String(payment_id).trim().length < 5) {
        return res.status(400).json({
          success: false,
          error: 'payment_id (PayPal capture ID) is required when marking an order paid',
        });
      }
    }`
  );
}

const blockRe =
  /\} catch \(error: any\) \{\s*logger\.error\(([^)]+)\);\s*res\.status\(500\)\.json\(\{\s*success: false,\s*error: (?:error\.message \|\| |error instanceof Error \? error\.message : )'([^']*)'(?:,\s*)?\s*\}\);\s*\}/g;

c = c.replace(blockRe, (m, logArgs, fallback) => {
  return `} catch (error: unknown) {\n    logger.error(${logArgs});\n    respond500(res, error, '${fallback}');\n  }`;
});

c = c.replace(
  /\} catch \(error: any\) \{\s*logger\.error\(([^)]+)\);\s*res\.status\(500\)\.json\(\{\s*success: false,\s*error: error\.message,\s*\}\);\s*\}/g,
  (m, logArgs) =>
    `} catch (error: unknown) {\n    logger.error(${logArgs});\n    respond500(res, error, 'Request failed');\n  }`
);

// Use parseOrderRow for mutation responses
c = c.replace(
  /const dbOrder = result\[0\] as Order;\s*\n\s*const parsedResult: Order = \{[\s\S]*?shipping_address,\s*\};/g,
  'const parsedResult = parseOrderRow(result[0] as Record<string, unknown>) as Order;'
);

fs.writeFileSync(fp, c);
console.log('orders.ts fixed');
