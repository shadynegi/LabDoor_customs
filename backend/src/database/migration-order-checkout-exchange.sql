-- One-time PayPal return exchange codes (30-minute TTL, single use).
CREATE TABLE IF NOT EXISTS order_checkout_exchanges (
  code_hash VARCHAR(64) PRIMARY KEY,
  order_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_checkout_exchanges_expires
  ON order_checkout_exchanges (expires_at);

CREATE INDEX IF NOT EXISTS idx_order_checkout_exchanges_order_id
  ON order_checkout_exchanges (order_id);
