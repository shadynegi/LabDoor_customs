# PayPal Sandbox Setup Guide

This guide will help you set up PayPal Sandbox for testing payments in your Lab Door Customs application.

## 🎯 Overview

PayPal Sandbox is a test environment that allows you to test payment flows without using real money. You'll need to:
1. Create a PayPal Developer account
2. Create a Sandbox app
3. Get your credentials
4. Configure your application

---

## 📋 Step 1: Create PayPal Developer Account

1. Go to [https://developer.paypal.com/](https://developer.paypal.com/)
2. Click **"Log In"** or **"Sign Up"** (if you don't have an account)
3. Use your personal PayPal account or create a new one
4. Complete the registration process

---

## 📋 Step 2: Create a Sandbox App

1. Once logged in, go to **"Dashboard"**
2. Click **"My Apps & Credentials"** in the left sidebar
3. Make sure you're on the **"Sandbox"** tab (NOT Live)
4. Click **"Create App"** button
5. Fill in the form:
   - **App Name:** `Lab Door Customs` (or any name you prefer)
   - **Sandbox Business Account:** Select the default account
6. Click **"Create App"**

---

## 📋 Step 3: Get Your Credentials

After creating the app, you'll see:

1. **Client ID** - A long string starting with `A...`
2. **Secret** - Click "Show" to reveal it

**IMPORTANT:** Keep these credentials secure! Never commit them to Git.

---

## 📋 Step 4: Configure Your Application

### Backend Configuration

1. Open `backend/.env` file (create it from `env.template` if it doesn't exist)
2. Add your PayPal credentials:

```env
# PayPal Configuration
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_SECRET=your_secret_here
PAYPAL_MODE=sandbox
```

### Example (with fake credentials):
```env
PAYPAL_CLIENT_ID=AZDxjDScFpQtjWTOUtWKbyN_bDt4OgqaF4eYXlewfBP4-8aqX3PiV8e1GWU6liB2CUXlkA59kJXE7M6R
PAYPAL_SECRET=EGnHDxD_qRPdaLdZz8iCr8N7_MzF-YHPTkjs6NKYQvQSBngp4PTTVWkPZUgGjgNDK4kB48VzQZfFM5VH
PAYPAL_MODE=sandbox
```

3. **Save the file**
4. **Restart your backend server** for changes to take effect

---

## 📋 Step 5: Test Your Setup

Run the test script to verify everything is configured correctly:

```bash
cd backend
node test-paypal-connection.js
```

You should see:
```
✅ Environment variables are set
✅ Authentication Successful!
✅ Test Order Created Successfully!
🎉 ALL TESTS PASSED! PayPal integration is working!
```

If you see errors, follow the troubleshooting steps in the output.

---

## 📋 Step 6: Create Sandbox Test Accounts

You need test buyer accounts to complete payments:

1. Go to **"Sandbox" → "Accounts"** in PayPal Developer Dashboard
2. You'll see default test accounts (Personal and Business)
3. Click on a **Personal** account email to view details
4. Note the **email** and **password** (or click "Set/Reset Password")
5. Use these credentials to log in as a buyer during testing

### Default Test Account Types:
- **Business Account** - Your merchant account (receives payments)
- **Personal Account** - Buyer account (makes payments)

---

## 🧪 Testing the Payment Flow

1. **Start your servers:**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

2. **Test checkout:**
   - Add items to cart
   - Go to checkout
   - Fill in shipping details
   - Click "Pay with PayPal"
   - You'll be redirected to PayPal sandbox
   - **Log in with your test Personal account credentials**
   - Complete the payment
   - You'll be redirected back to success page

3. **View transactions:**
   - Go to PayPal Developer Dashboard
   - Click "Sandbox" → "Accounts"
   - Click on your Business account
   - View recent transactions

---

## 🔧 Troubleshooting

### Error: "Sorry something went wrong"

**Possible causes:**
1. ❌ **Invalid credentials** - Double-check Client ID and Secret
2. ❌ **Wrong environment** - Make sure you're using SANDBOX credentials (not Live)
3. ❌ **Backend not running** - Ensure backend server is running on port 5000
4. ❌ **Environment variables not loaded** - Restart backend after changing .env

**Solutions:**
```bash
# 1. Test PayPal connection
cd backend
node test-paypal-connection.js

# 2. Check backend logs
# Look for errors when clicking "Pay with PayPal"

# 3. Verify environment variables
node -e "require('dotenv').config(); console.log('Client ID:', process.env.PAYPAL_CLIENT_ID ? 'Set' : 'NOT SET');"
```

### Error: "Authentication Failed"

1. Go to PayPal Dashboard → My Apps & Credentials
2. Make sure you're on **"Sandbox"** tab
3. Click on your app name
4. Copy the credentials again (Client ID and Secret)
5. Update `backend/.env`
6. Restart backend

### Error: "Order Creation Failed"

1. Check your item prices and amounts
2. Ensure total = subtotal + shipping + tax
3. Verify currency is "USD"
4. Check backend console for detailed error messages

---

## 📚 Additional Resources

- [PayPal Sandbox Guide](https://developer.paypal.com/api/rest/sandbox/)
- [PayPal Orders API](https://developer.paypal.com/docs/api/orders/v2/)
- [PayPal Testing Guide](https://developer.paypal.com/api/rest/sandbox/test-toolkit/)

---

## 🔐 Security Notes

1. **Never commit** `.env` files to Git
2. **Never share** your Client ID and Secret publicly
3. **Use Sandbox** credentials for testing only
4. **Switch to Live** credentials only when ready for production
5. **Keep credentials** in environment variables, not hardcoded

---

## ✅ Checklist

Before testing payments, ensure:
- [ ] PayPal Developer account created
- [ ] Sandbox app created
- [ ] Client ID and Secret copied
- [ ] `backend/.env` file configured
- [ ] Backend server restarted
- [ ] Test script passed (`node test-paypal-connection.js`)
- [ ] Test buyer account credentials available
- [ ] Both backend and frontend servers running

---

## 🎉 You're Ready!

Once all checks pass, your PayPal Sandbox is configured and you can test the complete payment flow in your application!

Need help? Check the backend console logs for detailed error messages.

