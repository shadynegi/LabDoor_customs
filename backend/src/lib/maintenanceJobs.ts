import { logger } from './logger';
import { pingDatabase } from './db';
import { expireStalePendingOrders } from './orderLifecycle';
import {
  cleanupExpiredIdempotencyKeys,
  reapStuckIdempotencyKeys,
} from './paymentIdempotency';
import { cleanupExpiredCheckoutExchanges } from './orderCheckoutExchange';
import { cleanupExpiredOrderAccessExchanges } from './orderAccessExchange';

async function runInitialMaintenance(): Promise<void> {
  const started = Date.now();
  try {
    logger.info('Maintenance: starting initial run');
    await pingDatabase();
    logger.info('Maintenance: expiring stale pending orders');
    await expireStalePendingOrders();
    logger.info('Maintenance: reaping stuck idempotency keys');
    await reapStuckIdempotencyKeys();
    logger.info(`Maintenance: initial run complete (${Date.now() - started}ms)`);
  } catch (err) {
    logger.warn('Initial maintenance run skipped (DB not ready):', err);
  }
}

export function startMaintenanceJobs(): void {
  const hourMs = 60 * 60 * 1000;
  const fifteenMinMs = 15 * 60 * 1000;

  setInterval(() => {
    cleanupExpiredIdempotencyKeys().catch((err) =>
      logger.warn('Idempotency cleanup failed:', err)
    );
    expireStalePendingOrders().catch((err) =>
      logger.warn('Stale pending order cleanup failed:', err)
    );
    cleanupExpiredCheckoutExchanges().catch((err) =>
      logger.warn('Checkout exchange cleanup failed:', err)
    );
    cleanupExpiredOrderAccessExchanges().catch((err) =>
      logger.warn('Order access exchange cleanup failed:', err)
    );
  }, hourMs);

  setInterval(() => {
    reapStuckIdempotencyKeys().catch((err) =>
      logger.warn('Stuck idempotency reaper failed:', err)
    );
  }, fifteenMinMs);

  // Defer first run and ping DB so pooler connections are fresh after bootstrap.
  const deferMs = parseInt(process.env.MAINTENANCE_DEFER_MS || '120000', 10);
  setTimeout(() => {
    runInitialMaintenance().catch((err) =>
      logger.warn('Initial maintenance run failed:', err)
    );
  }, deferMs);

  logger.info(`Maintenance jobs scheduled (first run in ${deferMs}ms)`);
}
