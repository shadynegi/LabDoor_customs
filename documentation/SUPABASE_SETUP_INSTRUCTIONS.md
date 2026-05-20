# 🗄️ Supabase Database Setup - Step by Step

## ⚠️ Current Issue

Your `.env` file has Supabase credentials, but we're getting a **"fetch failed"** error.

**This usually means:**
1. ✅ Your credentials are present and formatted correctly
2. ❌ But can't connect to the Supabase project

**Common causes:**
- Supabase project is paused (free tier auto-pauses after inactivity)
- Network/firewall blocking connection
- Wrong project URL
- Project was deleted

---

## 🔍 Step 1: Verify Your Supabase Project

### Go to Supabase Dashboard
1. Open: https://app.supabase.com/
2. Login to your account
3. Look for your project: **uinyqoeohwguyoqjysun**

### Check Project Status
- **🟢 Active** - Project is running (good!)
- **⏸️ Paused** - Click "Resume Project" and wait 2-3 minutes
- **❌ Not Found** - You'll need to create a new project

---

## 🆕 If Project is Paused or Missing - Create/Resume

### Resume Paused Project:
1. Click on your project
2. Click **"Restore"** or **"Resume Project"** button
3. Wait 2-3 minutes for project to wake up
4. Continue to Step 2 below

### Create New Project (if needed):
1. Click **"New Project"**
2. Choose organization
3. Fill in:
   - **Name**: `gaultier-shoe-store`
   - **Database Password**: (create a strong password - save it!)
   - **Region**: Choose closest to you
4. Click **"Create new project"**
5. Wait ~2 minutes for project to initialize
6. Continue to "Get New Credentials" below

---

## 🔑 Get Fresh Credentials

Once your project is **active** (green dot):

### Step 1: Go to Project Settings
1. Click **Settings** (gear icon) in left sidebar
2. Click **API**

### Step 2: Copy Your Credentials

You'll see:

**Project URL:**
```
https://xxxxx.supabase.co
```

**API Keys:**
- `anon public` - ❌ NOT this one
- `service_role` - ✅ Use this one (click to reveal)

### Step 3: Update Your .env File

Edit `backend/.env`:

```env
# Replace with your actual values
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-service-role-key-here

# Keep your existing PayPal credentials
PORT=5000
FRONTEND_URL=http://localhost:5173
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_SECRET=your-paypal-secret
PAYPAL_MODE=sandbox
```

⚠️ **Important:** Use the `service_role` key, NOT the `anon` key!

---

## 📋 Step 2: Create Database Tables

Now that your project is active, let's create the tables:

### Method 1: Via Supabase Dashboard (Recommended)

1. **Open SQL Editor**
   - In your Supabase project
   - Click **SQL Editor** (icon with `</>`) in left sidebar

2. **Create New Query**
   - Click **"New query"** button

3. **Copy Schema**
   - Open file: `backend/src/database/schema.sql` in your project
   - **Select ALL** content (Ctrl+A)
   - **Copy** (Ctrl+C)

4. **Paste and Run**
   - Paste into Supabase SQL Editor
   - Click **"Run"** button (or press Ctrl+Enter)

5. **Wait for Success**
   - You should see: ✅ **"Success. No rows returned"**
   - This means tables were created!

6. **Verify Tables Created**
   - Click **"Table Editor"** in left sidebar
   - You should see 3 tables:
     - `products`
     - `orders`
     - `contact_messages`

---

## ✅ Step 3: Test Connection

### From Backend Directory:

```bash
cd backend
node test-supabase-detailed.js
```

**Expected output:**
```
✅ Connection SUCCESSFUL!
✅ Tables already exist!
📊 Products table: 0 rows
```

If you see this, you're all set! 🎉

---

## 🚀 Step 4: Restart Your Backend

```bash
npm run dev
```

**You should see:**
```
✅ Supabase connected successfully!
🚀 Server Running Successfully!
```

---

## 🎯 Step 5: Test the API

### Test Products Endpoint:

Open browser or use curl:
```
http://localhost:5000/api/products
```

**Should return:**
```json
{
  "success": true,
  "data": [],
  "count": 0
}
```

If you see this (even with empty data), **your database is working!** 🎉

---

## 🌱 Optional: Seed Sample Data

The schema includes sample products. If they didn't insert, you can add them manually:

### Via Supabase Dashboard:

1. Go to **Table Editor** → **products**
2. Click **"Insert"** → **"Insert row"**
3. Fill in:
   - name: `Nike Drops - Blue`
   - price: `98.00`
   - category: `Athletic`
   - stock: `50`
4. Click **"Save"**

### Or Via SQL:

```sql
INSERT INTO products (name, price, description, category, stock) VALUES
  ('Nike Drops - Blue', 98.00, 'Self-lacing basketball shoe', 'Athletic', 50),
  ('Golden ESSENCE', 98.00, 'Premium athletic footwear', 'Luxury', 30),
  ('Pink Panda Runners', 129.00, 'Lightweight running shoe', 'Running', 40),
  ('Browny CLASSIC', 89.00, 'Timeless design classic', 'Casual', 60),
  ('GAULTIER SPORT', 89.00, 'Sport performance shoe', 'Athletic', 45);
```

---

## 🐛 Troubleshooting

### Still getting "fetch failed"?

**Check 1: Internet Connection**
```bash
# Try pinging Google
ping google.com
```

**Check 2: Firewall/Antivirus**
- Temporarily disable firewall
- Try again
- If works, add Supabase to whitelist

**Check 3: VPN**
- Disable VPN temporarily
- Try connection test again

**Check 4: Project URL**
- Double-check in Supabase Dashboard
- Settings → API → Project URL
- Make sure it matches exactly in `.env`

### "Cannot find module '@supabase/supabase-js'"?

```bash
cd backend
npm install
```

### Tables not appearing?

1. Check SQL Editor for error messages
2. Try running schema.sql again
3. Check Table Editor - tables should be there

### Connection works but API returns errors?

- Check backend terminal for detailed errors
- Verify you're using `service_role` key, not `anon` key
- Check RLS policies aren't blocking access

---

## 📊 Verify Everything Works

### Checklist:

- [ ] Supabase project is active (not paused)
- [ ] Updated `.env` with correct credentials
- [ ] Ran `schema.sql` in Supabase SQL Editor
- [ ] See 3 tables in Table Editor
- [ ] `node test-supabase-detailed.js` shows success
- [ ] Backend starts without errors
- [ ] `http://localhost:5000/api/products` returns JSON
- [ ] Frontend can fetch products
- [ ] Orders page works at `/orders`

---

## 🎉 Success!

Once all checkboxes above are checked, your database is fully setup!

**What works now:**
- ✅ Products API
- ✅ Orders API (saves orders to database)
- ✅ Contact form (saves messages)
- ✅ Order tracking by email
- ✅ All CRUD operations

---

## 📞 Need Help?

### Common Commands:

```bash
# Test connection
cd backend
node test-supabase-detailed.js

# Restart backend
npm run dev

# Check backend logs
# (just look at terminal where backend is running)
```

### Check Supabase Dashboard:
- Table Editor - See your data
- SQL Editor - Run queries
- API Docs - See your endpoints
- Logs - See query logs

---

## 🔄 Next Steps After Setup

1. **Test order placement**
   - Add items to cart
   - Complete checkout
   - Check order in Supabase Table Editor

2. **Test order tracking**
   - Go to `/orders`
   - Enter your email
   - See your order

3. **Add tracking info**
   - In Supabase, update order with tracking number
   - Refresh `/orders` page
   - See tracking info appear

4. **Go live!**
   - Test everything thoroughly
   - Deploy when ready

---

**Questions?** Check the error messages in:
- Backend terminal
- Browser console (F12)
- Supabase Dashboard → Logs

**Last Updated:** December 8, 2025

