# 📋 Supabase SQL Setup - Copy & Paste This

## ✅ Your connection is working!

Now you need to create the database tables.

---

## 🎯 **Quick Instructions:**

1. **Open Supabase Dashboard:** https://app.supabase.com/
2. **Select your project:** `uinyqoeohwguhitohxyv`
3. **Click: SQL Editor** (icon looks like `</>` in left sidebar)
4. **Click: "New query"** button (top right)
5. **Copy the ENTIRE SQL below** (click the copy button in the code block)
6. **Paste into the SQL Editor**
7. **Click "Run"** (or press Ctrl+Enter)
8. **Wait for:** ✅ **"Success. No rows returned"** message

---

## 📄 **SQL to Run:**

The complete SQL schema is in: `backend/src/database/schema.sql`

**Open that file in your code editor** and copy ALL 167 lines.

**Or use the file path:**
```
C:\Users\hp\Desktop\Lab_Door_Customs\backend\src\database\schema.sql
```

---

## ✅ **What This Creates:**

### Tables:
1. **products** - Store your shoe products
2. **orders** - Store customer orders (with tracking!)
3. **contact_messages** - Store contact form submissions

### Features:
- Auto-incrementing IDs
- Timestamps (created_at, updated_at)
- Indexes for fast queries
- Row Level Security (RLS) policies
- Triggers for auto-updating timestamps

### Sample Data:
- 5 sample products will be inserted (Nike shoes)
- You can delete/modify these later

---

## 🔍 **After Running:**

### Verify Tables Created:

1. **Click: Table Editor** (icon looks like a table grid in left sidebar)
2. **You should see 3 tables:**
   - ✅ `products` (should have 5 sample products)
   - ✅ `orders` (empty)
   - ✅ `contact_messages` (empty)

3. **Click on `products` table**
   - You should see 5 Nike shoes listed
   - Each with name, price, description, stock

---

## 🐛 **If You Get Errors:**

### "relation already exists"
- ✅ This is fine! Tables already exist
- Skip to verification step

### "permission denied"
- ❌ You might be using anon key instead of service_role key
- Go to Settings → API → Copy the **service_role** key
- Update `backend/.env`

### "syntax error"
- ❌ Make sure you copied the **entire** schema.sql file
- Check no parts were cut off
- Try copying again

---

## 📞 **Next Steps:**

After tables are created:

1. **Come back to your terminal**
2. **Tell me "tables created"**
3. **I'll test the API endpoints**
4. **Then start your backend server**
5. **Everything will be working!** 🎉

---

**When ready, let me know: "done" or "tables created"**

