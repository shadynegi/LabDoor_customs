import type { Server } from 'http';
import sql from './db';
import { logger } from './logger';
import { disconnectRedis } from './redis';

let registered = false;
let shuttingDown = false;

const SHUTDOWN_MS = 5000;

export function registerGracefulShutdown(httpServer: Server): void {
  if (registered) return;
  registered = true;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`${signal} received — shutting down gracefully`);

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        logger.warn('HTTP close timeout — continuing shutdown');
        resolve();
      }, SHUTDOWN_MS);

      httpServer.close(() => {
        clearTimeout(timer);
        logger.info('HTTP server closed');
        resolve();
      });
    });

    try {
      await disconnectRedis().catch(() => {});
      await sql.end();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
      return;
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

/** Reset for tests only. */
export function resetGracefulShutdownForTests(): void {
  registered = false;
  shuttingDown = false;
}
