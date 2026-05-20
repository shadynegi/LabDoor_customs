# PayPal Testing Guide - Quick Reference

## 🚀 Quick Start

### 1. Start the Servers

```powershell
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 2. Test PayPal Connection

```powershell
cd backend
node test-paypal-connection.js
```

Expected output:
```
✅ Environment variables are set
✅ Authentication Successful
✅ Test Order Created Successfully
```

---

## 🧪 Manual Testing Steps

### Test Complete Checkout Flow

1. **Open the application:**
   - Go to http://localhost:5173

2. **Add product to cart:**
   - Click "Add to cart" on any product
   - Select size system (UK/US/EU)
   - Select a size
   - Click "Add to Cart"
   - Verify cart badge shows item count

3. **View cart:**
   - Click cart icon
   - Verify pricing:
     - Subtotal (sum of items)
     - Shipping ($50 if subtotal < $1000, else FREE)
     - Tax (18% of subtotal)
     - Total (subtotal + shipping + tax)

4. **Checkout:**
   - Click "Proceed to Checkout"
   - Fill in all required fields:
     - Full Name
     - Email
     - Phone
     - Street Address
     - City
     - State/Province
     - ZIP/Postal Code
     - Country
   - Click "Pay with PayPal"

5. **PayPal Sandbox:**
   - Should redirect to PayPal sandbox
   - URL should be: `https://www.sandbox.paypal.com/checkoutnow?token=...`
   - Verify amount matches your order total

6. **Complete Payment (Optional):**
   - Log in with PayPal sandbox test account
   - Or pay as guest with test card
   - Complete payment
   - Should redirect back to success page

---

## 🔑 PayPal Test Accounts

### Create Test Accounts

1. Go to: https://developer.paypal.com/dashboard/accounts
2. Click "Create Account"
3. Choose "Personal" (for buyer)
4. Set country and follow prompts

### Default Test Cards (for Guest Checkout)

**Visa:**
```
Card: 4032039959736871
Expiry: Any future date
CVV: Any 3 digits
```

**Mastercard:**
```
Card: 5425233430109903
Expiry: Any future date
CVV: Any 3 digits
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "PayPal credentials not configured"

**Solution:**
```powershell
# Check if .env file exists
cd backend
dir .env

# If missing, create it:
copy env.template .env

# Edit .env and add your credentials:
# PAYPAL_CLIENT_ID=your_client_id
# PAYPAL_SECRET=your_secret
# PAYPAL_MODE=sandbox
```

### Issue 2: "Authentication Failed"

**Solution:**
1. Verify credentials are correct
2. Make sure you're using SANDBOX credentials (not Live)
3. Restart backend server after changing .env

### Issue 3: Backend not responding

**Solution:**
```powershell
# Check if backend is running
curl http://localhost:5000/api/products

# Expected: 200 OK with products list
```

### Issue 4: Frontend not loading

**Solution:**
```powershell
# Check if frontend is running
curl http://localhost:5173

# Expected: 200 OK with HTML
```

### Issue 5: "order.total.toFixed is not a function"

**Status:** ✅ FIXED (December 12, 2025)

This issue has been resolved. Numeric parsing added to:
- `MyOrders.tsx`
- `PaymentSuccess.tsx`

---

## 📋 Pre-Deployment Checklist

### Before Testing
- [ ] Backend server running (`npm run dev`)
- [ ] Frontend server running (`npm run dev`)
- [ ] PayPal credentials configured in `backend/.env`
- [ ] `test-paypal-connection.js` passes
- [ ] Database connection working (if applicable)

### During Testing
- [ ] Can add products to cart
- [ ] Cart displays correctly
- [ ] Pricing calculates correctly
- [ ] Checkout form validates
- [ ] "Pay with PayPal" redirects to PayPal
- [ ] PayPal shows correct amount

### After Testing
- [ ] Payment completes successfully
- [ ] Redirects to success page
- [ ] Order saved to database
- [ ] Order appears in Admin Dashboard
- [ ] Order appears in My Orders (by email)
- [ ] Email notifications sent (if configured)

---

## 🔍 Testing API Endpoints

### Test Products API
```powershell
curl http://localhost:5000/api/products
```

### Test Orders API (All Orders)
```powershell
curl http://localhost:5000/api/orders
```

### Test Orders API (By Email)
```powershell
curl http://localhost:5000/api/orders/customer/test@example.com
```

### Test Stats API
```powershell
curl http://localhost:5000/api/orders/stats/summary
```

---

## 📊 Expected Pricing Calculations

### Example 1: Single Item ($98)
```
Subtotal: $98.00
Shipping: $50.00 (order < $1000)
Tax:      $17.64 (18% of $98)
─────────────────
Total:    $165.64
```

### Example 2: Free Shipping ($1100)
```
Subtotal: $1,100.00
Shipping: $0.00 (FREE - order ≥ $1000)
Tax:      $198.00 (18% of $1100)
──────────────────
Total:    $1,298.00
```

### Example 3: Multiple Items
```
Item 1: $98.00 × 2 = $196.00
Item 2: $150.00 × 1 = $150.00
─────────────────────────────
Subtotal: $346.00
Shipping: $50.00 (order < $1000)
Tax:      $62.28 (18% of $346)
─────────────────────────────
Total:    $458.28
```

---

## 🎯 Test Scenarios

### Scenario 1: Basic Purchase
- Add 1 item to cart
- Complete checkout
- Pay with PayPal
- ✅ Expected: Success

### Scenario 2: Free Shipping
- Add items totaling ≥ $1000
- Verify shipping = $0.00
- Complete checkout
- ✅ Expected: Free shipping applied

### Scenario 3: Multiple Items
- Add 3 different items
- Verify quantities
- Verify total calculation
- Complete checkout
- ✅ Expected: Correct totals

### Scenario 4: Payment Cancellation
- Start checkout
- Click "Pay with PayPal"
- Click "Cancel and return to merchant" on PayPal
- ✅ Expected: Return to checkout page

### Scenario 5: Invalid Form
- Try to checkout without filling fields
- ✅ Expected: Validation errors shown

---

## 📱 Mobile Testing

### Responsive Design
```
Desktop: ≥ 1024px
Tablet:  768px - 1023px
Mobile:  < 768px
```

### Test on Mobile Viewport
1. Open DevTools (F12)
2. Toggle device toolbar
3. Select device (iPhone, iPad, etc.)
4. Test entire flow

---

## 🛠️ Debugging Tools

### Backend Logs
Check terminal running backend server for:
- API requests
- PayPal API calls
- Errors

### Browser Console
1. Press F12
2. Go to Console tab
3. Look for errors

### Network Tab
1. Press F12
2. Go to Network tab
3. Filter by XHR/Fetch
4. Check API responses

---

## 📞 Getting Help

### PayPal Developer Resources
- Dashboard: https://developer.paypal.com/dashboard
- Documentation: https://developer.paypal.com/docs/
- API Reference: https://developer.paypal.com/api/rest/
- Test Accounts: https://developer.paypal.com/dashboard/accounts

### Local Documentation
- `PAYPAL_SETUP_GUIDE.md` - Setup instructions
- `PAYPAL_INTEGRATION_TEST_REPORT.md` - Full test results
- `documentation/` folder - Additional guides

---

## ✅ Success Criteria

Your PayPal integration is working if:

1. ✅ `test-paypal-connection.js` passes
2. ✅ Can create PayPal order from frontend
3. ✅ Redirects to PayPal sandbox
4. ✅ PayPal shows correct amount
5. ✅ Can complete payment (with test account)
6. ✅ Redirects back to your site
7. ✅ Order saved to database

---

**Last Updated:** December 12, 2025  
**Status:** All tests passing ✅

