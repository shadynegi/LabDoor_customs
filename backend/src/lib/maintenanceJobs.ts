import { logger } from './logger';
import { pingDatabase } from './db';
import { expireStalePendingOrders } from './orderLifecycle';
import {
  cleanupExpiredIdempotencyKeys,
  reapStuckIdempotencyKeys,
} from './paymentIdempotency';
import { cleanupExpiredCheckoutExchanges } from './orderCheckoutExchange';
import { cleanupExpiredOrderAccessExchanges } from './orderAccessExchange';

async function runMaintenanceStep<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const started = Date.now();
  logger.info({ step: label }, 'Maintenance: step started');
  try {
    const result = await fn();
    logger.info({ step: label, durationMs: Date.now() - started, result }, 'Maintenance: step finished');
    return result;
  } catch (err) {
    logger.warn(
      { step: label, durationMs: Date.now() - started, err },
      'Maintenance: step failed'
    );
    throw err;
  }
}

async function runInitialMaintenance(): Promise<void> {
  const started = Date.now();
  try {
    logger.info('Maintenance: starting initial run');
    await runMaintenanceStep('ping_database', () => pingDatabase());
    await runMaintenanceStep('expire_stale_orders', () => expireStalePendingOrders());
    await runMaintenanceStep('reap_idempotency', () => reapStuckIdempotencyKeys());
    logger.info({ durationMs: Date.now() - started }, 'Maintenance: initial run complete');
  } catch (err) {
    logger.warn({ durationMs: Date.now() - started, err }, 'Maintenance: initial run aborted');
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
