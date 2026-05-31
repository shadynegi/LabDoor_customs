import { logger } from './logger';
import { expireStalePendingOrders } from './orderLifecycle';
import {
  cleanupExpiredIdempotencyKeys,
  reapStuckIdempotencyKeys,
} from './paymentIdempotency';

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
  }, hourMs);

  setInterval(() => {
    reapStuckIdempotencyKeys().catch((err) =>
      logger.warn('Stuck idempotency reaper failed:', err)
    );
  }, fifteenMinMs);

  expireStalePendingOrders().catch(() => {});
  reapStuckIdempotencyKeys().catch(() => {});

  logger.info('Maintenance jobs scheduled (pending orders, idempotency)');
}
