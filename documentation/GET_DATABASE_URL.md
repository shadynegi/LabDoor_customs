# 🔗 Get Your DATABASE_URL from Supabase

## 📍 **How to Find It:**

### **Step 1: Open Supabase Dashboard**
1. Go to: https://app.supabase.com/
2. Select your project: `uinyqoeohwguhitohxyv`

### **Step 2: Navigate to Database Settings**
1. Click **Settings** (gear icon) in left sidebar
2. Click **Database**

### **Step 3: Copy Connection String**

Scroll down to **"Connection string"** section.

You'll see different formats:

#### **Use "URI" format:**
Click on **"URI"** tab (or "Connection string")

You'll see something like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.uinyqoeohwguhitohxyv.supabase.co:5432/postgres
```

**Important:** Replace `[YOUR-PASSWORD]` with your actual database password!

---

## 🔑 **Add to .env File**

Open `backend/.env` and add:

```env
# Existing Supabase config
SUPABASE_URL=https://uinyqoeohwguhitohxyv.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIs...

# Add this new line for direct PostgreSQL connection
DATABASE_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.uinyqoeohwguhitohxyv.supabase.co:5432/postgres

# Your existing PayPal config
PORT=5000
FRONTEND_URL=http://localhost:5173
...
```

---

## 🔐 **What's Your Database Password?**

If you don't remember your database password:

### **Option 1: Use Pooler Connection (Recommended)**

In Supabase Database settings, find **"Connection pooling"**:
- Enable connection pooling
- Use the **"Transaction"** mode connection string
- This doesn't require the password!

Format:
```
postgresql://postgres.uinyqoeohwguhitohxyv:[YOUR-POOLER-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### **Option 2: Reset Database Password**

1. In Supabase → Settings → Database
2. Scroll to **"Database password"**
3. Click **"Reset database password"**
4. Copy the new password
5. Update your connection string

---

## ✅ **Test the Connection**

After adding DATABASE_URL to .env:

```bash
cd backend
node -e "import('postgres').then(m => { const sql = m.default(process.env.DATABASE_URL); sql\`SELECT 1\`.then(() => console.log('✅ Connected!')).catch(console.error); })"
```

---

## 📊 **Now You Have Two Connection Methods:**

### **1. Supabase JS Client** (backend/src/lib/supabase.ts)
```typescript
import { supabase } from './lib/supabase';
const { data } = await supabase.from('products').select('*');
```
- ✅ Easy to use
- ✅ Works with RLS policies
- ✅ Built-in features

### **2. Direct PostgreSQL** (backend/src/lib/db.ts)
```typescript
import sql from './lib/db';
const products = await sql`SELECT * FROM products`;
```
- ✅ Direct SQL queries
- ✅ Better performance
- ✅ More control

---

**You can use both in your project!**

