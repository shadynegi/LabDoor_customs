import type { Server } from 'http';
import sql from './db';
import { logger } from './logger';
import { disconnectRedis } from './redis';

let registered = false;

export function registerGracefulShutdown(httpServer: Server): void {
  if (registered) return;
  registered = true;

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });
    try {
      await disconnectRedis().catch(() => {});
      await sql.end();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
