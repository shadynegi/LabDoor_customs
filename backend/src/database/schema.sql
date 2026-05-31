-- Lab Door Customs Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  image TEXT,
  description TEXT,
  background TEXT,
  category VARCHAR(100),
  size VARCHAR(50),                -- Shoe sizes: 'US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12', etc.
  color VARCHAR(100),              -- Primary color: 'Blue', 'Gold', 'Pink', 'Brown', 'Black', etc.
  stock INTEGER DEFAULT 0 CHECK (stock >= 0),
  rating DECIMAL(3, 2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
  review_count INTEGER DEFAULT 0 CHECK (review_count >= 0),
  view_count INTEGER DEFAULT 0,
  cart_count INTEGER DEFAULT 0,
  is_out_of_stock BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(100) UNIQUE NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  shipping_address JSONB NOT NULL,
  items JSONB NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  shipping_cost DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method VARCHAR(50) NOT NULL,
  payment_id VARCHAR(255),
  paypal_order_id VARCHAR(255),
  paypal_capture_id VARCHAR(255),
  refunded_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  access_token_hash VARCHAR(64),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  tracking_number VARCHAR(100),
  tracking_url TEXT,
  carrier VARCHAR(50) DEFAULT 'Blue Dart',
  estimated_delivery DATE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coupons/Discount codes table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
  minimum_order DECIMAL(10, 2) DEFAULT 0 CHECK (minimum_order >= 0),
  maximum_discount DECIMAL(10, 2),  -- Cap for percentage discounts
  max_uses INTEGER,                  -- NULL means unlimited
  used_count INTEGER DEFAULT 0 CHECK (used_count >= 0),
  max_uses_per_customer INTEGER DEFAULT 1,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  applies_to VARCHAR(20) DEFAULT 'all' CHECK (applies_to IN ('all', 'category', 'product')),
  applies_to_ids INTEGER[],          -- Product or category IDs if applicable
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coupon usage tracking (to enforce per-customer limits)
CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_email VARCHAR(255) NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_size ON products(size);
CREATE INDEX IF NOT EXISTS idx_products_color ON products(color);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_paypal_order_id ON orders(paypal_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paypal_order_id_unique ON orders(paypal_order_id) WHERE paypal_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paypal_capture_id_unique ON orders(paypal_capture_id) WHERE paypal_capture_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_created_at ON contact_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_messages(email);

CREATE INDEX IF NOT EXISTS idx_activity_logs_session ON activity_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_is_deleted ON customers(is_deleted);
CREATE INDEX IF NOT EXISTS idx_customers_total_orders ON customers(total_orders);
CREATE INDEX IF NOT EXISTS idx_customers_total_spent ON customers(total_spent);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_dates ON coupons(valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_customer ON coupon_usage(customer_email);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order ON coupon_usage(order_id);

-- Create updated_at trigger function with secure search_path
-- This prevents search_path-based attacks by explicitly setting the search path
-- and using schema-qualified function calls
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Use schema-qualified NOW() function from pg_catalog
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

-- Apply updated_at trigger to tables
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contact_messages_updated_at ON contact_messages;
CREATE TRIGGER update_contact_messages_updated_at
  BEFORE UPDATE ON contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample products (optional - based on your frontend)
INSERT INTO products (name, price, image, description, background, category, size, color, stock, rating, review_count) VALUES
  ('Nike Drops - Blue', 98.00, '/assets/blue-nike.png', 'Self-lacing basketball shoe', '/assets/blue-bg.png', 'Athletic', 'US 9', 'Blue', 50, 4.5, 128),
  ('Golden ESSENCE', 98.00, '/assets/gold-black-nike.png', 'Premium athletic footwear', '/assets/gold-bg.png', 'Luxury', 'US 10', 'Gold', 30, 4.8, 94),
  ('Pink Panda Runners', 129.00, '/assets/pink-nike.png', 'Lightweight running shoe', '/assets/pink-bg.png', 'Running', 'US 8', 'Pink', 40, 4.3, 156),
  ('Browny CLASSIC', 89.00, '/assets/black-brown-nike.png', 'Timeless design classic', '/assets/brown-bg.png', 'Casual', 'US 11', 'Brown', 60, 4.6, 203),
  ('LAB DOOR SPORT', 89.00, '/assets/brown-pink-nike.png', 'Sport performance shoe', '/assets/brown-pink-bg.png', 'Athletic', 'US 9', 'Brown', 45, 4.4, 87)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products (public read, admin write)
-- Using subqueries for auth functions to prevent re-evaluation per row (performance optimization)
CREATE POLICY "Allow public read access to products" ON products
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to insert products" ON products
  FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Allow authenticated users to update products" ON products
  FOR UPDATE USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Allow authenticated users to delete products" ON products
  FOR DELETE USING ((select auth.role()) = 'authenticated');

-- RLS Policies for orders (users can read their own, admin can read all)
-- Using subqueries for auth functions to prevent re-evaluation per row (performance optimization)
CREATE POLICY "Users can read their own orders" ON orders
  FOR SELECT USING (
    (select auth.jwt()) ->> 'email' = customer_email OR
    (select auth.role()) = 'authenticated'
  );

-- Only service_role (backend) can create orders
-- Order creation goes through the backend API which validates payment first
CREATE POLICY "Service role can create orders" ON orders
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to update orders" ON orders
  FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- RLS Policies for contact messages
-- Using subqueries for auth functions to prevent re-evaluation per row (performance optimization)

-- Only service_role (backend) can insert contact messages
-- Contact form submissions go through the backend API which validates input
CREATE POLICY "Service role can insert contact messages" ON contact_messages
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Only authenticated users can read contact messages" ON contact_messages
  FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Only authenticated users can update contact messages" ON contact_messages
  FOR UPDATE USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Only authenticated users can delete contact messages" ON contact_messages
  FOR DELETE USING ((select auth.role()) = 'authenticated');

-- Grant permissions to service role
GRANT ALL ON products TO service_role;
GRANT ALL ON orders TO service_role;
GRANT ALL ON contact_messages TO service_role;

-- Comment: RLS policy design:
-- - Anyone can read products (public catalog)
-- - Service role (backend) can create orders (after payment validation)
-- - Service role (backend) can insert contact messages (after input validation)
-- - Users can read their own orders
-- - Authenticated users (admin) can manage orders, products, and contact messages
-- 
-- All write operations from the frontend go through the backend API which:
-- 1. Validates input data
-- 2. Uses service_role connection (bypasses RLS)
-- This ensures data integrity while preventing direct database manipulation

