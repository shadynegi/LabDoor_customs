import { logger } from './logger';
import { pingDatabase, withRetry, isTransientDbError } from './db';
import { expireStalePendingOrders } from './orderLifecycle';
import {
  cleanupExpiredIdempotencyKeys,
  reapStuckIdempotencyKeys,
} from './paymentIdempotency';
import { cleanupExpiredOrderAccessExchanges } from './orderAccessExchange';
import { runLowStockAlertDigest } from './inventoryMovements';
import { backfillOrderLineItems } from './orderLineItems';

function dbErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return code != null ? String(code) : undefined;
  }
  return undefined;
}

function logMaintenanceFailure(step: string, err: unknown): void {
  const code = dbErrorCode(err);
  const message = err instanceof Error ? err.message : String(err);

  if (isTransientDbError(err)) {
    logger.warn(
      { step, code, err: message },
      'Maintenance: skipped (database unreachable)'
    );
    return;
  }

  logger.warn({ step, code, err }, 'Maintenance: step failed');
}

async function runWithMaintenanceRetry<T>(
  step: string,
  fn: () => Promise<T>
): Promise<T | undefined> {
  try {
    return await withRetry(fn, {
      retries: parseInt(process.env.MAINTENANCE_DB_RETRIES || '2', 10),
      baseMs: parseInt(process.env.MAINTENANCE_DB_RETRY_MS || '1000', 10),
      label: `maintenance:${step}`,
    });
  } catch (err) {
    logMaintenanceFailure(step, err);
    return undefined;
  }
}

async function runMaintenanceStep<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T | undefined> {
  const started = Date.now();
  logger.info({ step: label }, 'Maintenance: step started');
  const result = await runWithMaintenanceRetry(label, fn);
  if (result !== undefined) {
    logger.info(
      { step: label, durationMs: Date.now() - started, result },
      'Maintenance: step finished'
    );
  }
  return result;
}

async function runHourlyMaintenance(): Promise<void> {
  const ping = await runWithMaintenanceRetry('ping_database', () => pingDatabase());
  if (ping === undefined) return;

  await runWithMaintenanceRetry('idempotency_cleanup', cleanupExpiredIdempotencyKeys);
  await runWithMaintenanceRetry('expire_stale_orders', () => expireStalePendingOrders());
  await runWithMaintenanceRetry('low_stock_digest', runLowStockAlertDigest);
  await runWithMaintenanceRetry('order_line_items_backfill', () => backfillOrderLineItems(50));
  await runWithMaintenanceRetry(
    'order_access_exchange_cleanup',
    cleanupExpiredOrderAccessExchanges
  );
}

async function runFifteenMinuteMaintenance(): Promise<void> {
  const ping = await runWithMaintenanceRetry('ping_database', () => pingDatabase());
  if (ping === undefined) return;

  await runWithMaintenanceRetry('reap_idempotency', () => reapStuckIdempotencyKeys());
}

async function runInitialMaintenance(): Promise<void> {
  const started = Date.now();
  logger.info('Maintenance: starting initial run');
  await runMaintenanceStep('ping_database', () => pingDatabase());
  await runMaintenanceStep('expire_stale_orders', () => expireStalePendingOrders());
  await runMaintenanceStep('reap_idempotency', () => reapStuckIdempotencyKeys());
  logger.info({ durationMs: Date.now() - started }, 'Maintenance: initial run complete');
}

export function startMaintenanceJobs(): void {
  const hourMs = 60 * 60 * 1000;
  const fifteenMinMs = 15 * 60 * 1000;

  setInterval(() => {
    runHourlyMaintenance().catch((err) => logMaintenanceFailure('hourly_maintenance', err));
  }, hourMs);

  setInterval(() => {
    runFifteenMinuteMaintenance().catch((err) =>
      logMaintenanceFailure('fifteen_minute_maintenance', err)
    );
  }, fifteenMinMs);

  const deferMs = parseInt(process.env.MAINTENANCE_DEFER_MS || '120000', 10);
  setTimeout(() => {
    runInitialMaintenance().catch((err) => logMaintenanceFailure('initial_maintenance', err));
  }, deferMs);

  logger.info(`Maintenance jobs scheduled (first run in ${deferMs}ms)`);
}
