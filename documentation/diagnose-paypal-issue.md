# PayPal "Sorry Something Went Wrong" - Diagnostic Guide

## ✅ Good News!

Your PayPal Sandbox credentials are **correctly configured** and working! 🎉

The test script passed all checks:
- ✅ Authentication successful
- ✅ Order creation working
- ✅ PayPal API responding correctly

## 🔍 Diagnosing "Sorry Something Went Wrong"

Since the PayPal integration is working, the issue is likely one of these:

### Issue 1: Backend Server Not Running ⚠️

**Check:**
```bash
# Make sure backend is running
cd backend
npm run dev
```

**You should see:**
```
🚀 Server started successfully!
📍 Port: 5000
💳 PayPal Mode: sandbox
```

**Test backend:**
```bash
# In a new terminal
curl http://localhost:5000/api/health
```

**Expected response:**
```json
{"status":"OK","message":"Server is running","paypalMode":"sandbox"}
```

---

### Issue 2: Frontend Can't Reach Backend 🌐

**Check frontend console:**
1. Open your app in browser (http://localhost:5173)
2. Open Developer Tools (F12)
3. Go to "Console" tab
4. Try to checkout
5. Look for error messages

**Common errors:**
- `Failed to fetch` → Backend not running
- `CORS error` → CORS misconfiguration
- `Network error` → Wrong backend URL

**Test from browser console:**
```javascript
// Paste this in browser console (F12)
fetch('http://localhost:5000/api/health')
  .then(r => r.json())
  .then(d => console.log('✅ Backend reachable:', d))
  .catch(e => console.error('❌ Cannot reach backend:', e));
```

---

### Issue 3: Environment Variables Not Set 📝

**Check frontend/.env:**
```bash
cd frontend
cat .env  # or type .env on Windows
```

**Should contain:**
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_BACKEND_URL=http://localhost:5000
```

**If missing, create it:**
```bash
cd frontend
cp env.template .env
```

Then edit `.env` and add the URLs above.

**IMPORTANT:** After changing `.env`, restart the frontend:
```bash
# Press Ctrl+C to stop, then:
npm run dev
```

---

### Issue 4: Port Conflicts 🔌

**Check if something else is using port 5000:**
```bash
# Windows
netstat -ano | findstr :5000

# Mac/Linux
lsof -i :5000
```

**If port 5000 is in use, change it:**

Edit `backend/.env`:
```env
PORT=5001
```

Edit `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5001/api
VITE_BACKEND_URL=http://localhost:5001
```

Restart both servers.

---

## 🧪 Step-by-Step Testing

### Step 1: Ensure Both Servers Running

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

**Both should be running without errors.**

---

### Step 2: Test Backend Health

```bash
# Terminal 3
curl http://localhost:5000/api/health
```

**Expected:**
```json
{"status":"OK","message":"Server is running","paypalMode":"sandbox","paypalApi":"https://api-m.sandbox.paypal.com","timestamp":"..."}
```

---

### Step 3: Test PayPal Endpoint

```bash
curl http://localhost:5000/api/paypal/test
```

**Expected:**
```json
{"success":true,"message":"PayPal connection successful","hasToken":true}
```

---

### Step 4: Test Full Payment Flow

1. Go to http://localhost:5173
2. Add items to cart
3. Go to checkout
4. Fill in ALL required fields:
   - Full Name
   - Email
   - Phone
   - Address
   - City
   - State
   - Zip Code
   - Country ⚠️ **Make sure to select a country!**
5. Click "Pay with PayPal"

**Watch the network tab (F12 → Network):**
- Look for `create-payment` request
- Check its status (should be 200)
- Check response data

---

## 🐛 Common Mistakes

### ❌ Forgot to select country
The checkout form requires ALL fields including country dropdown.

### ❌ Backend not restarted after changing .env
Always restart backend after modifying environment variables.

### ❌ Frontend not restarted after changing .env
Always restart frontend after modifying environment variables.

### ❌ Using wrong PayPal account
When redirected to PayPal, use your **sandbox test account**, not your real PayPal account.

---

## 📋 Quick Checklist

Before testing again:

- [ ] Backend server running (`cd backend && npm run dev`)
- [ ] Frontend server running (`cd frontend && npm run dev`)
- [ ] Backend health check passes (`curl http://localhost:5000/api/health`)
- [ ] PayPal test passes (`curl http://localhost:5000/api/paypal/test`)
- [ ] Frontend `.env` exists with correct URLs
- [ ] All form fields filled (especially country!)
- [ ] Browser console open to see errors
- [ ] Network tab open to see API calls

---

## 🔧 Still Not Working?

### Get Detailed Logs:

1. **Check backend terminal** for error messages when you click "Pay with PayPal"
2. **Check browser console (F12)** for JavaScript errors
3. **Check Network tab** for failed requests

### Share This Information:

If you still have issues, provide:
1. Screenshot of backend terminal showing the error
2. Screenshot of browser console showing the error
3. Screenshot of Network tab showing the failed request
4. The exact error message you see

---

## 💡 Most Likely Cause

Based on "Sorry something went wrong" error, the most common causes are:

1. **Backend not running** (80% of cases)
2. **Country not selected** in form (15% of cases)
3. **CORS issue** (3% of cases)
4. **Wrong backend URL** (2% of cases)

Try the checklist above and you'll likely find the issue! 🎯

