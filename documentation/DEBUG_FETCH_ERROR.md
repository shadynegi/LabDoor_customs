# Debug: "TypeError: fetch failed" Error

This error means the frontend cannot connect to the backend API.

## Common Causes & Solutions

### 1. Backend Not Running ⚠️ MOST COMMON

**Check:**
```bash
# Is backend server running?
# Look for output like: "Server Running Successfully!"
```

**Solution:**
```bash
cd backend
npm run dev
```

**Expected output:**
```
╔════════════════════════════════════════╗
║   🚀 Server Running Successfully!     ║
╚════════════════════════════════════════╝
📍 Port: 5000
✅ Ready to accept connections!
```

---

### 2. Missing .env Files ⚠️ VERY COMMON

**Check if files exist:**
```bash
ls backend/.env
ls frontend/.env
```

**If missing, create them:**

#### Backend .env
```bash
cd backend
cp env.template .env
```

Edit `backend/.env`:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# REQUIRED - Get from https://app.supabase.com/
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key-here

# REQUIRED - Get from https://developer.paypal.com/
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_SECRET=your-sandbox-secret
PAYPAL_MODE=sandbox
```

#### Frontend .env
```bash
cd frontend
cp env.template .env
```

Edit `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_BACKEND_URL=http://localhost:5000
```

---

### 3. Wrong Port or URL

**Check frontend config:**
```bash
# Should be: http://localhost:5000
# NOT: https://... (no SSL locally)
# NOT: different port
```

**Verify backend is on port 5000:**
```bash
# Test directly
curl http://localhost:5000/api/health
```

**Expected response:**
```json
{"status":"OK","message":"Server is running",...}
```

---

### 4. CORS Issues

If backend is running but still fails:

**Check backend console for:**
```
CORS error
Access-Control-Allow-Origin
```

**Solution:** Already configured in server.ts, but verify FRONTEND_URL matches

---

### 5. Firewall/Antivirus

**Symptoms:** Backend runs but frontend can't connect

**Solution:**
- Allow Node.js through firewall
- Temporarily disable antivirus to test
- Check Windows Defender firewall settings

---

## Step-by-Step Fix

### Step 1: Create Backend .env
```bash
cd backend
cp env.template .env
```

**Edit with minimum config:**
```env
PORT=5000
FRONTEND_URL=http://localhost:5173

# Placeholder values - replace with real ones
SUPABASE_URL=https://placeholder.supabase.co
SUPABASE_KEY=placeholder-key

PAYPAL_CLIENT_ID=placeholder
PAYPAL_SECRET=placeholder
PAYPAL_MODE=sandbox
```

### Step 2: Start Backend
```bash
npm run dev
```

**If you see errors about missing env vars:**
- Backend needs real Supabase credentials
- See SETUP_GUIDE.md for getting credentials

### Step 3: Create Frontend .env
```bash
cd frontend
cp env.template .env
```

**Use defaults (should work):**
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_BACKEND_URL=http://localhost:5000
```

### Step 4: Restart Frontend
```bash
# Stop frontend (Ctrl+C)
npm run dev
```

**Vite must be restarted for .env changes to take effect!**

### Step 5: Test Connection
```bash
# In new terminal
curl http://localhost:5000/api/health
```

**Should return:**
```json
{"status":"OK",...}
```

### Step 6: Open Browser
Go to http://localhost:5173

**Check browser console (F12):**
- Should see products loading
- No more "fetch failed" errors

---

## Still Not Working?

### Check Backend Logs

Look for errors in backend terminal:
```
❌ Missing SUPABASE_URL
❌ Missing SUPABASE_KEY
Error: Cannot connect to database
```

**Solution:** Add real credentials to backend/.env

### Check Frontend Console

Press F12 in browser, look for:
```
Failed to fetch
net::ERR_CONNECTION_REFUSED
CORS error
```

**Each has different solution - see above**

### Verify Ports

```bash
# Check what's running on port 5000
netstat -ano | findstr :5000

# Check what's running on port 5173
netstat -ano | findstr :5173
```

---

## Quick Test Script

Run these commands in order:

```bash
# 1. Test if backend responds
curl http://localhost:5000/api/health

# 2. Test products API
curl http://localhost:5000/api/products

# 3. Test PayPal connection
curl http://localhost:5000/api/paypal/test
```

**All should return JSON, not errors**

---

## Environment Setup Checklist

- [ ] Node.js 18+ installed
- [ ] `backend/.env` exists
- [ ] `frontend/.env` exists
- [ ] Backend server running (port 5000)
- [ ] Frontend server running (port 5173)
- [ ] Backend shows "Ready to accept connections"
- [ ] `curl http://localhost:5000/api/health` works
- [ ] Browser can load http://localhost:5173
- [ ] No firewall blocking localhost

---

## Need Credentials?

### Supabase (Required for products)
1. Go to https://app.supabase.com/
2. Create free account
3. Create new project
4. Get URL and service_role key from Settings → API
5. Add to backend/.env

### PayPal (Required for payments)
1. Go to https://developer.paypal.com/
2. Create free developer account
3. Create sandbox app
4. Get Client ID and Secret
5. Add to backend/.env

---

## After Fixing

Once backend responds to curl:
1. Restart frontend: `Ctrl+C` then `npm run dev`
2. Hard refresh browser: `Ctrl+Shift+R`
3. Check browser console (F12) for any errors
4. Products should load!

---

**Most Common Fix:** Create `.env` files and start backend server!

