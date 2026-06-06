-- Migration: Add activity logs, admin sessions, customers, and product tracking
-- Run this in your Supabase SQL Editor

-- Add new columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cart_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_out_of_stock BOOLEAN DEFAULT FALSE;

-- Activity logs table (tracks user/buyer actions)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
);

-- Admin sessions table
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(500) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer history table (aggregated customer data)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(50),
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  last_order_date TIMESTAMP WITH TIME ZONE,
  first_order_date TIMESTAMP WITH TIME ZONE,
  addresses JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_session ON activity_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_total_orders ON customers(total_orders);
CREATE INDEX IF NOT EXISTS idx_customers_total_spent ON customers(total_spent);

-- Grant permissions to service role
GRANT ALL ON activity_logs TO service_role;
GRANT ALL ON admin_sessions TO service_role;
GRANT ALL ON customers TO service_role;

-- RLS Policies for new tables
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Activity logs policies
-- Drop any existing policies first
DROP POLICY IF EXISTS "Allow public to insert activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Only authenticated users can read activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Service role can manage activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Authenticated users can read activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Service role can insert activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Service role can update activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Service role can delete activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Admin can read activity logs" ON activity_logs;

-- Single service_role policy (avoids duplicate permissive policies per action)
DROP POLICY IF EXISTS "Service role manages activity_logs" ON activity_logs;
CREATE POLICY "Service role manages activity_logs" ON activity_logs
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Admin sessions policies
-- Drop any existing policies first
DROP POLICY IF EXISTS "Allow inserting admin sessions" ON admin_sessions;
DROP POLICY IF EXISTS "Allow reading admin sessions" ON admin_sessions;
DROP POLICY IF EXISTS "Allow deleting admin sessions" ON admin_sessions;
DROP POLICY IF EXISTS "Service role can manage admin sessions" ON admin_sessions;

-- Only service_role (backend) can manage admin sessions
-- All session operations go through the backend API which uses service_role
CREATE POLICY "Service role can manage admin sessions" ON admin_sessions
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Customers policies (single policy for all operations to avoid overlap)
-- Drop any existing overlapping policies first
DROP POLICY IF EXISTS "Allow reading customers" ON customers;
DROP POLICY IF EXISTS "Allow managing customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON customers;

CREATE POLICY "Service role manages customers" ON customers
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Update products view and cart counts to 0 if null
UPDATE products SET view_count = 0 WHERE view_count IS NULL;
UPDATE products SET cart_count = 0 WHERE cart_count IS NULL;
UPDATE products SET is_out_of_stock = FALSE WHERE is_out_of_stock IS NULL;

-- Fix overly permissive policies on existing tables
-- These policies allowed unrestricted INSERT which bypasses RLS security

-- Fix contact_messages INSERT policy
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Service role can insert contact messages" ON contact_messages;
CREATE POLICY "Service role can insert contact messages" ON contact_messages
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

-- Fix orders INSERT policy  
DROP POLICY IF EXISTS "Allow authenticated users to create orders" ON orders;
DROP POLICY IF EXISTS "Service role can create orders" ON orders;
CREATE POLICY "Service role can create orders" ON orders
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

-- Success message
SELECT 'Migration completed successfully!' as status;
