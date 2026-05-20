# Quick Start Guide - Lab Door Customs

Get up and running in under 10 minutes!

## Prerequisites

- ✅ Node.js 18+ installed
- ✅ npm or yarn
- ✅ Code editor (VS Code recommended)

## Step 1: Clone or Download Project

```bash
cd Lab_Door_Customs
```

## Step 2: Backend Setup (5 minutes)

### Install Dependencies
```bash
cd backend
npm install
```

### Setup Environment
```bash
cp env.template .env
```

Edit `.env` file:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Supabase (get from https://app.supabase.com/)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key-here

# PayPal (get from https://developer.paypal.com/)
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_SECRET=your-sandbox-secret
PAYPAL_MODE=sandbox
```

### Setup Database

1. **Create Supabase Account**
   - Go to https://app.supabase.com/
   - Click "New Project"
   - Copy URL and service_role key

2. **Run Database Schema**
   - Open Supabase Dashboard
   - Go to SQL Editor
   - Copy contents of `backend/src/database/schema.sql`
   - Click "Run"

3. **Add Sample Data (Optional)**
   - In SQL Editor, copy `backend/src/database/seed.sql`
   - Click "Run"

### Get PayPal Credentials

1. Go to https://developer.paypal.com/dashboard/
2. Create account (free)
3. Create new app
4. Copy Sandbox Client ID and Secret

### Start Backend
```bash
npm run dev
```

✅ Backend should start on http://localhost:5000

Test: http://localhost:5000/api/health

## Step 3: Frontend Setup (2 minutes)

### Install Dependencies
```bash
cd frontend
npm install
```

### Setup Environment
```bash
cp env.template .env
```

Edit `.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_BACKEND_URL=http://localhost:5000
```

### Start Frontend
```bash
npm run dev
```

✅ Frontend should start on http://localhost:5173

## Step 4: Test Everything! (3 minutes)

### Test Frontend
1. Open http://localhost:5173
2. Browse products (use arrows)
3. Click "Add to cart"
4. Select size
5. View cart
6. Go to checkout

### Test Backend
```bash
# Health check
curl http://localhost:5000/api/health

# Get products
curl http://localhost:5000/api/products
```

### Test PayPal (Sandbox)
1. Complete checkout form
2. Click "Pay with PayPal"
3. Use PayPal sandbox test account:
   - Email: any sandbox account
   - Password: from PayPal dashboard
4. Complete payment
5. Verify success page

### Test Contact Form
1. Click "Contact Us" (mobile) or footer
2. Fill form
3. Submit
4. Check backend terminal for logs

## Common Issues

### "Cannot connect to backend"
- Is backend running? Check terminal
- Correct port? Should be 5000
- Check `.env` file in frontend

### "Supabase error"
- Verify SUPABASE_URL in backend `.env`
- Check SUPABASE_KEY is the service_role key
- Run schema.sql in Supabase

### "PayPal error"
- Check PAYPAL_CLIENT_ID and PAYPAL_SECRET
- Ensure PAYPAL_MODE=sandbox
- Test connection: http://localhost:5000/api/paypal/test

### "Port already in use"
```bash
# Kill process on port 5000
lsof -i :5000
kill -9 <PID>
```

## What's Next?

### Explore Features
- ✅ Product carousel
- ✅ Shopping cart
- ✅ Size selection
- ✅ Checkout
- ✅ PayPal payments
- ✅ Contact form
- ✅ About/Help pages

### API Testing
```bash
# Get all products
curl http://localhost:5000/api/products

# Submit contact form
curl -X POST http://localhost:5000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","subject":"Test","message":"Hello"}'

# Get order stats
curl http://localhost:5000/api/orders/stats/summary
```

### Admin Features (via API)
```bash
# Get all orders
curl http://localhost:5000/api/orders

# Get contact messages
curl http://localhost:5000/api/contact

# Update order status
curl -X PATCH http://localhost:5000/api/orders/:id/status \
  -H "Content-Type: application/json" \
  -d '{"status":"shipped"}'
```

## Development Workflow

### Running Both Servers
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### Making Changes

**Backend:**
- Edit files in `backend/src/`
- Server auto-restarts (nodemon)
- Check terminal for errors

**Frontend:**
- Edit files in `frontend/src/`
- Hot reload in browser
- Check browser console for errors

### Database Changes
- Edit `backend/src/database/schema.sql`
- Run in Supabase SQL Editor
- Restart backend if needed

## File Structure

```
Lab_Door_Customs/
├── backend/
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── database/      # SQL schemas
│   │   └── server.ts      # Main server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/         # React pages
│   │   ├── components/    # React components
│   │   └── assets/        # Images
│   └── package.json
└── Documentation files
```

## Useful Commands

### Backend
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
```

### Frontend
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Documentation

- **README.md** - Project overview
- **backend/README.md** - Backend guide
- **backend/DATABASE_SETUP.md** - Database setup
- **backend/API_DOCUMENTATION.md** - API reference
- **DEPLOYMENT_GUIDE.md** - Production deployment
- **PROJECT_OVERVIEW.md** - Architecture

## Need Help?

### Check Logs
- Backend: Terminal running `npm run dev`
- Frontend: Browser Developer Console
- Database: Supabase Dashboard → Logs

### Common Solutions
1. Restart servers
2. Check .env files
3. Verify all dependencies installed
4. Check port numbers
5. Review error messages

### Resources
- Supabase Docs: https://supabase.com/docs
- PayPal Developer: https://developer.paypal.com/docs
- React Docs: https://react.dev/

## Success Checklist

✅ Backend running on port 5000
✅ Frontend running on port 5173
✅ Database connected (Supabase)
✅ Products visible on homepage
✅ Cart operations working
✅ Checkout form loads
✅ PayPal sandbox payment works
✅ Contact form submits
✅ No errors in terminal/console

## You're All Set! 🎉

Your Lab Door Customs store is now running locally!

### Next Steps:
1. Customize products
2. Test all features
3. Read full documentation
4. Deploy to production (see DEPLOYMENT_GUIDE.md)
5. Add authentication (optional)
6. Build admin dashboard (optional)

### Support
- Email: support@gaultiershoes.com
- Check documentation files
- Review error logs

---

**Happy Coding! Built with ❤️**

Last Updated: December 2024

