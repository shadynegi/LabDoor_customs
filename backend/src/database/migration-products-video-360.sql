-- Optional 360° product spin video (MP4 URL or data URL stored by admin)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS video_360 TEXT;

COMMENT ON COLUMN products.video_360 IS 'MP4 URL or data URL for 360° product viewer';
