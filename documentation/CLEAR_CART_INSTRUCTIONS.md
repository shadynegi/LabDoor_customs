# 🛒 Clear Cart Instructions

## ⚠️ Important: Clear Old Cart Data

Your cart may still have items with **string prices** from before the fix. You need to clear them.

---

## 🔧 Quick Fix

### Option 1: Clear in Browser Console
1. **Open browser** at http://localhost:5173
2. **Press F12** (or Right-click → Inspect)
3. **Go to Console tab**
4. **Run this command:**
   ```javascript
   localStorage.clear(); window.location.reload();
   ```
5. **Done!** Cart is now empty and fixed ✅

---

### Option 2: Manual Clear
1. **Open browser** at http://localhost:5173
2. **Press F12**
3. **Go to Application tab** (Chrome) or **Storage tab** (Firefox)
4. **Click Local Storage** → **http://localhost:5173**
5. **Find `gaultier_cart`**
6. **Right-click** → **Delete**
7. **Refresh the page**

---

## 🧪 Test After Clearing

1. **Go to homepage**
2. **Add a product to cart**
3. **Go to cart page**
4. **Verify:**
   - ✅ No errors in console
   - ✅ Prices display correctly ($98.00)
   - ✅ Total calculates correctly
   - ✅ All buttons work

---

## 🎯 Why This is Needed

Old cart items stored prices as strings:
```json
{
  "items": [{
    "price": "98.00"  ← STRING (causes error)
  }]
}
```

New cart items store as numbers:
```json
{
  "items": [{
    "price": 98  ← NUMBER (works perfectly!)
  }]
}
```

Clearing localStorage removes the old data!

---

**Action Required:** Clear your localStorage now! 🧹

