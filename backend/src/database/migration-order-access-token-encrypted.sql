-- Durable encrypted access token for post-capture email tracking links (webhook/admin paths).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT;
