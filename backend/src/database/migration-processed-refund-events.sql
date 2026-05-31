-- Deduplicate PayPal refund webhooks and admin refund sync events
CREATE TABLE IF NOT EXISTS processed_refund_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dedupe_key VARCHAR(256) UNIQUE NOT NULL,
  capture_id VARCHAR(255) NOT NULL,
  refund_amount DECIMAL(10, 2),
  source VARCHAR(64) NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_refund_events_capture
  ON processed_refund_events (capture_id);
