# 🚀 Quick Setup Guide - Lab Door Customs

## ✅ All Issues Fixed!

All critical issues have been resolved. Here's what was fixed:

### Critical Fixes ✅
1. ✅ **CartProvider Integration** - Now properly wraps the entire app
2. ✅ **Add to Cart Functionality** - Fully functional with visual feedback
3. ✅ **Payment Routes** - Added `/payment/success` and `/payment/cancel` routes
4. ✅ **Type Consistency** - Fixed all Product type mismatches
5. ✅ **Environment Variables** - Created config system with proper .env support
6. ✅ **Backend Dependencies** - Installed missing `@supabase/supabase-js`
7. ✅ **Duplicate Code** - Removed duplicate PayPal route file
8. ✅ **Asset Paths** - Fixed for production builds using Vite imports
9. ✅ **Cart Badge** - Now shows real cart count
10. ✅ **Error Boundary** - Added for better error handling
11. ✅ **Cancel Page** - Improved with proper UI
12. ✅ **Documentation** - Updated all README files

---

## 🏁 Getting Started

### Step 1: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 2: Configure Environment Variables

#### Backend Configuration
Create `backend/.env` file:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Get these from https://developer.paypal.com
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_SECRET=your_paypal_secret_here
PAYPAL_MODE=sandbox

# Optional - for future features
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

#### Frontend Configuration
Create `frontend/.env` file:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_BACKEND_URL=http://localhost:5000
```

### Step 3: Get PayPal Credentials

1. Go to https://developer.paypal.com
2. Log in or create an account
3. Go to "Dashboard" → "My Apps & Credentials"
4. Under "Sandbox", create a new app or use existing one
5. Copy the **Client ID** and **Secret**
6. Paste them in your `backend/.env` file

### Step 4: Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
✅ Backend will start at `http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
✅ Frontend will open at `http://localhost:5173`

---

## 🧪 Testing the Application

### 1. Browse Products
- Open http://localhost:5173
- Use arrow buttons or swipe to browse shoes
- View product animations and details

### 2. Add to Cart
- Click "Add to cart" button
- Notice the button turns green with checkmark
- See cart badge update in navigation (on cart/checkout pages)

### 3. View Cart
- Click "Cart" in navigation or go to `/cart`
- Adjust quantities with +/- buttons
- Remove items if needed
- View order summary with tax and shipping

### 4. Checkout Process
- Click "Proceed to Checkout"
- Fill in shipping information
- Click "Pay with PayPal"
- You'll be redirected to PayPal sandbox

### 5. Complete Payment
- Use PayPal sandbox test account:
  - **Email**: sb-buyer@personal.example.com
  - **Password**: Create test account in PayPal Developer Dashboard
- Complete the payment
- You'll be redirected back with success message

---

## 📁 What Changed

### Frontend Changes
```
✅ App.tsx - Added CartProvider wrapper & payment routes
✅ Home.tsx - Wired up cart functionality with visual feedback
✅ Navigation - Shows real cart count
✅ Checkout.tsx - Uses environment variables
✅ PaymentSuccess.tsx - Uses environment variables
✅ Cancel.tsx - Improved UI with proper navigation
✅ types.ts - Fixed Product type definition
✅ config.ts - NEW: Centralized configuration
✅ ErrorBoundary.tsx - NEW: Error handling component
✅ main.tsx - Added ErrorBoundary wrapper
```

### Backend Changes
```
✅ package.json - Added @supabase/supabase-js dependency
✅ src/routes/paypal.ts - DELETED: Duplicate code removed
✅ src/index.ts - Updated with clarifying comments
✅ README.md - Updated with accurate information
```

### Configuration Files
```
✅ backend/env.template - NEW: Environment variable template
✅ frontend/env.template - NEW: Environment variable template
✅ README.md - NEW: Comprehensive documentation
✅ SETUP_GUIDE.md - NEW: This file
```

---

## 🎯 Features Now Working

### ✅ Shopping Cart
- Add products to cart
- Update quantities
- Remove items
- Cart persists in localStorage
- Real-time total calculation
- Cart badge shows item count

### ✅ Checkout Flow
1. View cart summary
2. Enter shipping details
3. Form validation
4. PayPal payment
5. Payment confirmation
6. Order details display

### ✅ Payment Processing
- PayPal sandbox integration
- Order creation
- Payment capture
- Success/cancel handling
- Cart clearing after purchase

### ✅ User Experience
- Smooth animations
- Mobile responsive
- Touch gesture support
- Error handling
- Loading states
- Visual feedback

---

## 🔧 Available Commands

### Frontend
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run linter
```

### Backend
```bash
npm run dev      # Start dev server (hot reload)
npm run build    # Compile TypeScript
npm start        # Run production build
```

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 5000 is available
# On Windows PowerShell:
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess

# Kill the process or change PORT in .env
```

### Frontend can't connect to backend
```bash
# Check that backend is running on port 5000
# Check VITE_BACKEND_URL in frontend/.env
# Restart frontend dev server after .env changes
```

### PayPal errors
```bash
# Verify PAYPAL_CLIENT_ID and PAYPAL_SECRET in backend/.env
# Make sure PAYPAL_MODE=sandbox
# Test connection: http://localhost:5000/api/paypal/test
```

### Cart not persisting
```bash
# Check browser console for errors
# Clear localStorage and refresh
# Verify CartProvider is wrapping the app
```

---

## 📚 Next Steps

### Recommended Enhancements
1. **Set up Supabase**
   - Create product database
   - Store order history
   - Add user authentication

2. **Add Tests**
   - Unit tests for components
   - Integration tests for API
   - E2E tests for checkout flow

3. **Deploy**
   - Frontend: Vercel, Netlify, or Cloudflare Pages
   - Backend: Heroku, Railway, or DigitalOcean
   - Database: Supabase or PostgreSQL

4. **Add Features**
   - Product search and filters
   - Wishlist functionality
   - Order tracking
   - Email notifications
   - Admin dashboard

---

## 🎉 You're All Set!

Your Lab Door Customs store is now fully functional with:
- ✅ Working shopping cart
- ✅ Secure PayPal checkout
- ✅ Beautiful UI/UX
- ✅ Mobile responsive
- ✅ Type-safe code
- ✅ Error handling
- ✅ Production-ready builds

**Happy selling! 👟**

---

## 📞 Need Help?

If you encounter any issues:
1. Check the console for errors
2. Review the troubleshooting section
3. Check that all environment variables are set
4. Make sure both servers are running
5. Clear browser cache and localStorage

For questions or issues, refer to the main README.md or create an issue on GitHub.

