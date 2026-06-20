-- Drop permissive authenticated policies on sensitive tables.
-- Also applied at server boot via ensureRlsPolicies().

DROP POLICY IF EXISTS "Authenticated users can manage customers" ON customers;
DROP POLICY IF EXISTS "Admin can read activity logs" ON activity_logs;

-- Tighten orders read policy if old bootstrap schema was applied
DROP POLICY IF EXISTS "Users can read their own orders" ON orders;
