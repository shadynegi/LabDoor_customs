-- Payment idempotency: durable deduplication for concurrent create/capture requests
CREATE TABLE IF NOT EXISTS payment_idempotency (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  operation VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'processing',
  server_order_id UUID,
  paypal_order_id VARCHAR(128),
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_idempotency_expires ON payment_idempotency (expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_idempotency_operation ON payment_idempotency (operation);
CREATE INDEX IF NOT EXISTS idx_payment_idempotency_processing_created
  ON payment_idempotency (created_at)
  WHERE status = 'processing';
