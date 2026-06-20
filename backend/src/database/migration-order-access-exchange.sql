-- One-time order tracking link codes (email — avoids long-lived access token in URL)
CREATE TABLE IF NOT EXISTS order_access_exchanges (
  code_hash VARCHAR(64) PRIMARY KEY,
  order_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_access_exchanges_expires
  ON order_access_exchanges (expires_at);

ALTER TABLE order_access_exchanges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages order_access_exchanges" ON order_access_exchanges;
CREATE POLICY "Service role manages order_access_exchanges" ON order_access_exchanges
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

REVOKE ALL ON order_access_exchanges FROM anon, authenticated;
GRANT ALL ON order_access_exchanges TO service_role;
