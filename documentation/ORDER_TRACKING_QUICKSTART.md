# ⚡ Order Tracking - Quick Start Guide

**Get started in 5 minutes!**

---

## 🎯 What You Need to Do

### 1️⃣ Update Database (2 minutes)

**Open Supabase → SQL Editor → Run this:**

```sql
-- If you already have orders table, run this migration:
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS tracking_url TEXT,
ADD COLUMN IF NOT EXISTS carrier VARCHAR(50) DEFAULT 'Blue Dart',
ADD COLUMN IF NOT EXISTS estimated_delivery DATE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
```

✅ **Done!** Your database is ready.

---

### 2️⃣ Restart Backend (30 seconds)

```bash
cd backend
# Ctrl+C to stop, then:
npm run dev
```

✅ **Done!** Backend has the new routes.

---

### 3️⃣ Test It (2 minutes)

#### Visit Orders Page
```
http://localhost:5173/orders
```

You should see:
- Email input field
- Search button
- Beautiful gradient background

#### Place a Test Order
1. Add shoes to cart
2. Checkout with PayPal sandbox
3. Complete payment
4. Order auto-saves to database

#### Look Up Your Order
1. Go to `/orders`
2. Enter your email
3. Click Search
4. See your order!

✅ **Done!** Feature is working.

---

### 4️⃣ Add Tracking to an Order (1 minute)

**In Supabase → Table Editor → orders:**

Find your order, click to edit, update:
```
tracking_number: BD123456789IN
status: shipped
```

**Or via SQL:**
```sql
UPDATE orders 
SET tracking_number = 'BD123456789IN', status = 'shipped'
WHERE customer_email = 'your@email.com';
```

#### Refresh /orders page

You should now see:
- 🔵 "Shipped" status
- 📦 Tracking info box
- 🔗 "Track on Blue Dart" button

✅ **Done!** Customer can track order.

---

## 🎨 What It Looks Like

### Orders Page
```
┌─────────────────────────────────────────┐
│          🎯 Track Your Orders          │
│   Enter your email to view orders      │
│                                         │
│  ┌───────────────────┐  ┌──────────┐  │
│  │ your@email.com    │  │ Search   │  │
│  └───────────────────┘  └──────────┘  │
└─────────────────────────────────────────┘
```

### Order Card (with tracking)
```
┌─────────────────────────────────────────┐
│  Order #GSS-1234567890-ABC123           │
│  $299.99                    🔵 Shipped  │
│  December 8, 2025                       │
│                                         │
│  📦 Tracking: BD123456789IN            │
│  Carrier: Blue Dart                     │
│  📅 Est. Delivery: Dec 15, 2025        │
│  [Track on Blue Dart →]                │
│                                         │
│  Items (3)                              │
│  • Nike Air Max × 1 - $150.00          │
│  • Adidas Ultraboost × 2 - $149.99     │
└─────────────────────────────────────────┘
```

---

## 🚀 Usage for Customers

### Step 1: Click "Orders" in Navigation
- Package icon in top-right (next to Cart)
- Or go to: `/orders`

### Step 2: Enter Email
- Type email used during purchase
- Click "Search"

### Step 3: View Orders
- See all orders
- Click items to expand
- View order details

### Step 4: Track Shipment
- See tracking number
- Click "Track on Blue Dart"
- Opens Blue Dart website

---

## 👨‍💼 Usage for Admin

### Daily Workflow

**Morning: Check New Orders**
```sql
SELECT order_number, customer_email, total
FROM orders 
WHERE status = 'processing'
ORDER BY created_at DESC;
```

**Prepare Shipments**
1. Print shipping labels from Blue Dart
2. Get tracking numbers

**Update Orders**
```sql
UPDATE orders 
SET 
  tracking_number = 'BD123456789IN',
  status = 'shipped',
  estimated_delivery = CURRENT_DATE + INTERVAL '5 days'
WHERE order_number = 'GSS-xxx';
```

**Mark as Delivered** (when confirmed)
```sql
UPDATE orders 
SET status = 'delivered', delivered_at = NOW()
WHERE tracking_number = 'BD123456789IN';
```

---

## 🔥 Pro Tips

### Tip 1: Bulk Update
```sql
-- Update multiple orders at once
UPDATE orders 
SET carrier = 'Blue Dart', status = 'shipped'
WHERE status = 'processing' AND tracking_number IS NOT NULL;
```

### Tip 2: Find Orders Needing Tracking
```sql
SELECT order_number, customer_email, created_at
FROM orders 
WHERE status = 'processing' 
  AND tracking_number IS NULL
  AND created_at < NOW() - INTERVAL '24 hours';
```

### Tip 3: Quick Status Check
```sql
SELECT 
  status, 
  COUNT(*) as count,
  SUM(total) as revenue
FROM orders 
GROUP BY status;
```

---

## 📱 Mobile Experience

Perfect responsive design:
- ✅ Touch-friendly buttons
- ✅ Optimized layout
- ✅ Fast loading
- ✅ Smooth animations

Test on phone:
```
http://YOUR-LOCAL-IP:5173/orders
```

---

## 🎯 Order Status Flow

```
Pending → Processing → Shipped → Delivered
   ⏰        📦          🚚         ✅
```

**When to use each:**
- **Pending**: Payment issues, awaiting confirmation
- **Processing**: Payment confirmed, preparing order
- **Shipped**: Order handed to Blue Dart
- **Delivered**: Customer received order

---

## 🆘 Quick Troubleshooting

### Can't see orders?
```bash
# Test API
curl http://localhost:5000/api/orders/customer/test@example.com

# Check database
# Go to Supabase → Table Editor → orders
```

### Tracking link not working?
- Tracking numbers need 24 hours to activate
- Check Blue Dart website: https://www.bluedart.com
- Verify tracking number format

### Backend errors?
```bash
# Check backend logs (terminal where backend runs)
# Look for errors about Supabase or database
```

---

## ✅ Quick Checklist

Setup complete when:
- [ ] `/orders` page loads
- [ ] Can search by email
- [ ] Orders display
- [ ] Can add tracking via Supabase
- [ ] Tracking shows on frontend
- [ ] "Track on Blue Dart" button works

---

## 📚 Full Documentation

Need more details? Check these files:

1. **SETUP_ORDER_TRACKING.md** - Complete setup guide
2. **ORDER_MANAGEMENT_GUIDE.md** - Admin handbook
3. **ORDERS_FEATURE_SUMMARY.md** - Feature overview

---

## 🎉 That's It!

Your order tracking system is ready!

**Customers get:**
- ✅ Easy order lookup
- ✅ Real-time status
- ✅ Tracking links
- ✅ Order history

**You get:**
- ✅ Happy customers
- ✅ Fewer support tickets
- ✅ Professional appearance
- ✅ Easy management

---

**Need help?** Check the full documentation or backend logs for errors.

**Ready to go live?** Test thoroughly with real orders first!

🚀 **Happy selling!**

