import sql from './db';
import { logger } from './logger';

/** Remove legacy plaintext admin session tokens (pre-hashing deploy). */
export async function purgeLegacyAdminSessions(): Promise<void> {
  try {
    const result = await sql`
      DELETE FROM admin_sessions
      WHERE token IS NULL
         OR length(token) != 64
         OR token !~ '^[a-f0-9]{64}$'
      RETURNING id
    `;
    if (result.length > 0) {
      logger.info(`Purged ${result.length} legacy admin session row(s)`);
    }
  } catch (error) {
    logger.warn('Legacy admin session purge failed:', error);
  }
}
