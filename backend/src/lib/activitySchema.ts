import sql from './db';
import { logger } from './logger';

/** Idempotent activity_logs + product metric columns (see migration-activity-logs.sql). */
export async function ensureActivityLogsTable(): Promise<void> {
  await sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cart_count INTEGER DEFAULT 0
  `.catch(() => {});

  await sql`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR(255),
      user_email VARCHAR(255),
      action_type VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50),
      entity_id VARCHAR(255),
      entity_name VARCHAR(255),
      metadata JSONB DEFAULT '{}',
      ip_address VARCHAR(45),
      user_agent TEXT,
      page_url TEXT,
      referrer TEXT,
      country VARCHAR(100),
      city VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_session ON activity_logs(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at)`;

  logger.info('Activity logs schema ready');
}
