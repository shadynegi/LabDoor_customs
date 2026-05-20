# Database Setup Guide

This guide will help you set up the Supabase database for Lab Door Customs.

## Prerequisites

1. A Supabase account (free tier is sufficient for development)
2. A Supabase project created

## Setup Steps

### 1. Create a Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click "New Project"
3. Fill in:
   - Project Name: `gaultier-shoe-store` (or your preferred name)
   - Database Password: (generate a strong password and save it)
   - Region: Choose the closest to your location
4. Click "Create new project"
5. Wait for the project to be created (takes 1-2 minutes)

### 2. Get Your Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
   - **Project API Key** → `service_role` key (secret key)

### 3. Configure Backend Environment

1. Navigate to `backend` directory
2. Copy `env.template` to `.env`:
   ```bash
   cp env.template .env
   ```

3. Edit `.env` file and add your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your-service-role-key
   ```

### 4. Run Database Schema

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `backend/src/database/schema.sql`
5. Paste it into the SQL Editor
6. Click **Run** button to execute

This will create:
- `products` table
- `orders` table
- `contact_messages` table
- Necessary indexes
- Row Level Security policies
- Auto-update triggers

### 5. (Optional) Add Sample Data

1. In the SQL Editor, create another **New Query**
2. Copy the contents of `backend/src/database/seed.sql`
3. Paste and **Run**

This will add:
- Sample products (6 shoe products)
- Sample orders (2 test orders)
- Sample contact messages (3 test messages)

### 6. Verify Setup

1. Go to **Table Editor** in Supabase dashboard
2. You should see three tables:
   - `products`
   - `orders`
   - `contact_messages`
3. Click on each table to see the data

### 7. Test Backend Connection

1. Start your backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Test the health endpoint:
   ```bash
   curl http://localhost:5000/api/health
   ```

3. Test the products endpoint:
   ```bash
   curl http://localhost:5000/api/products
   ```

You should see a list of products if everything is set up correctly!

## Table Structures

### Products Table
- `id` - Serial primary key
- `name` - Product name
- `price` - Product price (decimal)
- `image` - Image path/URL
- `description` - Product description
- `background` - Background image for product display
- `category` - Product category
- `stock` - Available stock quantity
- `created_at` - Auto-generated timestamp
- `updated_at` - Auto-updated timestamp

### Orders Table
- `id` - UUID primary key
- `order_number` - Unique order identifier
- `customer_email` - Customer email
- `customer_name` - Customer name
- `shipping_address` - JSONB field with address details
- `items` - JSONB array of order items
- `subtotal`, `shipping_cost`, `tax`, `total` - Price calculations
- `payment_status` - pending | completed | failed | refunded
- `payment_method` - Payment method used
- `payment_id`, `paypal_order_id`, `paypal_capture_id` - Payment references
- `status` - pending | processing | shipped | delivered | cancelled
- `created_at`, `updated_at` - Timestamps

### Contact Messages Table
- `id` - UUID primary key
- `name` - Sender name
- `email` - Sender email
- `subject` - Message subject
- `message` - Message content
- `status` - new | read | replied | archived
- `created_at`, `updated_at` - Timestamps

## Security Notes

### Row Level Security (RLS)

RLS is enabled on all tables with the following policies:

**Products:**
- Public read access (anyone can view)
- Authenticated users can create/update/delete

**Orders:**
- Users can read their own orders (by email)
- Anyone can create orders
- Authenticated users can update

**Contact Messages:**
- Anyone can submit
- Only authenticated users can read/manage

### API Keys

**NEVER** expose your `service_role` key in frontend code! This key bypasses RLS and should only be used in your backend.

For frontend applications, use the `anon` public key instead.

## Troubleshooting

### "relation does not exist" error
- Make sure you ran the schema.sql file completely
- Check that all tables were created in the Table Editor

### "permission denied" error
- Verify your `service_role` key is correct
- Check RLS policies are set up correctly

### Connection timeout
- Check your Supabase project is active
- Verify the SUPABASE_URL is correct
- Check your internet connection

### Cannot insert data
- Verify RLS policies allow the operation
- Check table constraints (e.g., price must be >= 0)
- Ensure required fields are provided

## Need Help?

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord Community](https://discord.supabase.com/)
- Check backend logs for detailed error messages

## Production Checklist

Before deploying to production:

- [ ] Remove sample data from seed.sql
- [ ] Update RLS policies for production security
- [ ] Set up proper authentication
- [ ] Add rate limiting
- [ ] Configure backup schedules
- [ ] Set up monitoring and alerts
- [ ] Use environment-specific Supabase projects
- [ ] Rotate API keys regularly
- [ ] Review and tighten CORS settings

