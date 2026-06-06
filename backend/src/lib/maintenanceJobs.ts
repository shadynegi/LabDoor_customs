import { logger } from './logger';
import { expireStalePendingOrders } from './orderLifecycle';
import {
  cleanupExpiredIdempotencyKeys,
  reapStuckIdempotencyKeys,
} from './paymentIdempotency';
import { cleanupExpiredCheckoutExchanges } from './orderCheckoutExchange';
import { cleanupExpiredOrderAccessExchanges } from './orderAccessExchange';

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

  // Defer first run so Supabase pooler connections are warm (avoids CONNECTION_ENDED on boot).
  const deferMs = parseInt(process.env.MAINTENANCE_DEFER_MS || '60000', 10);
  setTimeout(() => {
    expireStalePendingOrders().catch((err) =>
      logger.warn('Stale pending order cleanup failed:', err)
    );
    reapStuckIdempotencyKeys().catch((err) =>
      logger.warn('Stuck idempotency reaper failed:', err)
    );
  }, deferMs);

  logger.info('Maintenance jobs scheduled (pending orders, idempotency)');
}
