-- Promo coupon LDCOFF10 (10% off order)
INSERT INTO coupons (
  code,
  description,
  discount_type,
  discount_value,
  minimum_order,
  is_active,
  applies_to,
  max_uses_per_customer
)
VALUES (
  'LDCOFF10',
  '10% off your order when applied at checkout',
  'percentage',
  10,
  0,
  TRUE,
  'all',
  NULL
)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  is_active = TRUE,
  applies_to = EXCLUDED.applies_to,
  updated_at = NOW();
