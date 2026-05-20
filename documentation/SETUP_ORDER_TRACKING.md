# 🚀 Setup Order Tracking Feature

Complete step-by-step guide to enable order tracking in your Lab Door Customs store.

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ Supabase account and project setup
- ✅ Backend running on port 5000
- ✅ Frontend running on port 5173
- ✅ Orders table created in Supabase

---

## Step 1: Update Database Schema

### If You Haven't Created the Database Yet

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the entire contents of `backend/src/database/schema.sql`
3. Click **Run**
4. Verify tables created successfully

### If You Already Have an Orders Table

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `backend/src/database/migrations/add_tracking_fields.sql`
3. Click **Run**
4. This will add the new tracking fields without losing existing data

**Migration adds:**
- `tracking_number` - Blue Dart tracking number
- `tracking_url` - Full tracking URL
- `carrier` - Shipping carrier (default: Blue Dart)
- `estimated_delivery` - Expected delivery date
- `delivered_at` - Actual delivery timestamp
- Indexes for better performance
- Auto-update trigger for `updated_at` field

---

## Step 2: Restart Backend

The backend needs to restart to load the new route handlers:

```bash
# In backend terminal
# Press Ctrl+C to stop, then:
npm run dev
```

**Expected output should now include:**
```
📋 Order Endpoints:
  GET    /api/orders
  POST   /api/orders
  GET    /api/orders/:id
  GET    /api/orders/customer/:email    ← NEW!
  ...
```

---

## Step 3: Test the Feature

### Test 1: Access the Orders Page

1. Open browser to: http://localhost:5173/orders
2. You should see a beautiful order tracking page with email input

### Test 2: Place a Test Order

1. Go to home page
2. Add items to cart
3. Complete checkout with PayPal Sandbox credentials:
   - Email: `sb-buyer@example.com` (or your sandbox account)
   - Password: (your sandbox password)
4. Complete payment
5. Order should save automatically to database

### Test 3: Look Up Your Order

1. Go to http://localhost:5173/orders
2. Enter the email you used for checkout
3. Click "Search"
4. You should see your order with status "Processing"

### Test 4: Add Tracking Information

#### Option A: Via Supabase Dashboard (Recommended)

1. Go to Supabase → Table Editor → `orders`
2. Find your test order (look for your email)
3. Click the row to edit
4. Update these fields:
   ```
   tracking_number: BD123456789IN
   carrier: Blue Dart
   status: shipped
   estimated_delivery: 2025-12-15
   ```
5. Click Save

#### Option B: Via SQL

```sql
-- Find your order first
SELECT order_number, customer_email FROM orders LIMIT 5;

-- Update with tracking info (replace with your order_number)
UPDATE orders 
SET 
  tracking_number = 'BD123456789IN',
  carrier = 'Blue Dart',
  status = 'shipped',
  estimated_delivery = '2025-12-15'
WHERE order_number = 'GSS-xxx';  -- Replace with actual order number
```

### Test 5: Verify Tracking Display

1. Go back to http://localhost:5173/orders
2. Enter your email again
3. Click Search
4. You should now see:
   - ✅ Status changed to "Shipped" (blue badge)
   - ✅ Tracking information box
   - ✅ Tracking number: BD123456789IN
   - ✅ "Track on Blue Dart" button
5. Click the "Track on Blue Dart" button
6. Should open Blue Dart website in new tab

---

## Step 4: Verify Everything Works

### Checklist

- [ ] Orders page loads at `/orders`
- [ ] Can search by email
- [ ] Orders display correctly
- [ ] Order status shows with colored badge
- [ ] Items list is visible
- [ ] "Show All Items" expands full list
- [ ] Shipping address appears when expanded
- [ ] Tracking info appears when added
- [ ] "Track on Blue Dart" button works
- [ ] Page is responsive on mobile
- [ ] No console errors in browser

### Check Navigation

- [ ] "Orders" link appears in top navigation
- [ ] Package icon displays correctly
- [ ] Link highlights when on orders page
- [ ] Mobile view shows just the icon

---

## 🎯 Quick Test Order Workflow

### Create Test Order

```bash
# 1. Add to cart
# 2. Checkout
# 3. Use PayPal sandbox account
# 4. Complete payment
```

### Add Tracking (SQL - Quick Method)

```sql
-- Get the most recent order
SELECT id, order_number, customer_email, status 
FROM orders 
ORDER BY created_at DESC 
LIMIT 1;

-- Add tracking to that order (use the ID from above)
UPDATE orders 
SET 
  tracking_number = 'BD123456789IN',
  carrier = 'Blue Dart',
  status = 'shipped',
  estimated_delivery = CURRENT_DATE + INTERVAL '5 days'
WHERE id = 'paste-id-here';
```

### Verify in UI

```
1. Go to /orders
2. Enter customer email
3. See order with tracking
4. Click "Track on Blue Dart"
```

---

## 🔧 Troubleshooting

### Issue: Orders page shows 404

**Solution:**
- Make sure you restarted the frontend after changes
- Clear browser cache (Ctrl+Shift+R)
- Check App.tsx has the route:
  ```tsx
  <Route path="/orders" element={<MyOrders />} />
  ```

### Issue: "Failed to fetch orders"

**Solution:**
- Check backend is running
- Verify Supabase credentials in backend `.env`
- Check browser console for exact error
- Test API directly:
  ```bash
  curl http://localhost:5000/api/orders/customer/test@example.com
  ```

### Issue: No orders showing for email

**Solution:**
- Verify order exists in database:
  ```sql
  SELECT * FROM orders WHERE customer_email = 'your-email@example.com';
  ```
- Check email matches exactly (case-sensitive)
- Try different email that definitely has orders

### Issue: Tracking URL not working

**Solution:**
- Verify tracking number format (e.g., BD123456789IN)
- Check Blue Dart website is accessible
- Note: Some tracking numbers take 24 hours to activate in Blue Dart system
- Test URL manually:
  ```
  https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=BD123456789IN
  ```

### Issue: Backend errors about Supabase

**Solution:**
- If you see "fetch failed" in backend logs, you have two options:

**Option A: Use without Supabase (for testing)**
- The recent fix allows the app to work without Supabase
- Products will use fallback data
- Orders won't save to database
- Good for testing UI/UX

**Option B: Setup Supabase (for full functionality)**
1. Create account at https://app.supabase.com
2. Create new project
3. Get credentials from Settings → API
4. Update `backend/.env`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-service-role-key
   ```
5. Run schema.sql in Supabase SQL Editor
6. Restart backend

---

## 📱 Mobile Testing

### Test on Mobile Device

1. Find your computer's local IP:
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig | grep inet
   ```

2. Access from mobile:
   ```
   http://YOUR-IP:5173/orders
   ```

3. Test all features:
   - Email input and search
   - Order cards display
   - Tracking buttons work
   - Responsive layout

---

## 🎨 Customization (Optional)

### Change Blue Dart to Different Carrier

Edit `frontend/src/pages/MyOrders.tsx`:

```tsx
// Line ~175 - Change default carrier display
carrier: order.carrier || 'Your Carrier Name'

// Line ~200 - Change tracking URL function
const getTrackingUrl = (trackingNumber: string) => {
  return `https://your-carrier.com/track?number=${trackingNumber}`;
};
```

### Change Status Colors

Edit `MyOrders.tsx`, find `getStatusColor` function:

```tsx
const getStatusColor = (status: string) => {
  switch (status) {
    case 'delivered': return '#YOUR_COLOR';
    case 'shipped': return '#YOUR_COLOR';
    // ... etc
  }
};
```

---

## 📊 Monitor Your Orders

### View All Orders (SQL)

```sql
-- Recent orders
SELECT order_number, customer_email, status, total, created_at
FROM orders 
ORDER BY created_at DESC 
LIMIT 20;

-- Orders by status
SELECT status, COUNT(*) as count, SUM(total) as revenue
FROM orders 
GROUP BY status;

-- Orders needing tracking
SELECT order_number, customer_email, created_at
FROM orders 
WHERE status = 'processing' 
  AND tracking_number IS NULL
ORDER BY created_at;
```

### Test Customer Experience

1. Place order with real email
2. Check email for PayPal receipt
3. Go to /orders page
4. Search with email
5. Add tracking as admin
6. Refresh page
7. Click "Track on Blue Dart"

---

## ✅ Success Checklist

After completing setup, you should have:

- [x] Database schema updated with tracking fields
- [x] Backend API working with `/api/orders/customer/:email`
- [x] Frontend orders page at `/orders`
- [x] Orders link in navigation
- [x] Can place test order
- [x] Order saves with email
- [x] Can search orders by email
- [x] Can add tracking info via Supabase
- [x] Tracking displays on frontend
- [x] Blue Dart link works
- [x] Mobile responsive
- [x] No errors in console or backend logs

---

## 🎉 You're Done!

Your order tracking system is now live! Customers can:
- Track their orders by email
- See real-time order status
- View complete order history
- Track deliveries on Blue Dart

You can:
- Manage orders via Supabase
- Add tracking information easily
- Monitor order statistics
- Provide excellent customer service

---

## 📚 Next Steps

1. **Read the docs:**
   - `ORDER_MANAGEMENT_GUIDE.md` - Admin guide
   - `ORDERS_FEATURE_SUMMARY.md` - Feature overview
   - `backend/API_DOCUMENTATION.md` - API reference

2. **Setup email notifications (optional):**
   - Integrate SendGrid/AWS SES
   - Send order confirmations
   - Send shipping notifications

3. **Add automation (optional):**
   - Auto-update from Blue Dart API
   - Scheduled status updates
   - Analytics dashboard

4. **Go live:**
   - Test thoroughly with real orders
   - Update documentation for your team
   - Train staff on order management

---

## 🆘 Need Help?

Check these resources:
- Backend logs: Check terminal where backend is running
- Frontend logs: Check browser console (F12)
- Database: Check Supabase dashboard
- API: Test with curl or Postman

Common commands:
```bash
# Test orders API
curl http://localhost:5000/api/orders/customer/test@example.com

# Test health
curl http://localhost:5000/api/health

# Check backend logs
# (Just look at the terminal where backend is running)
```

---

**Last Updated:** December 8, 2025
**Version:** 1.0.0

