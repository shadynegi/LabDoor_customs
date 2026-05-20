# Lab Door Customs - Full Stack E-Commerce Application

A modern, responsive e-commerce platform for selling premium footwear with PayPal payment integration.

## 🎯 Project Overview

Lab Door Customs is a full-stack web application featuring:
- Beautiful, animated product showcase
- Shopping cart with size selection
- Secure checkout with PayPal
- Order management
- Contact form
- Admin capabilities for product/order management

## 🏗️ Architecture

```
Lab_Door_Customs/
├── frontend/          # React + TypeScript + Vite
├── backend/           # Node.js + Express + TypeScript
└── docs/             # Documentation
```

### Frontend Stack
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Routing:** React Router v6
- **Animations:** Framer Motion
- **UI Components:** Custom components + Shadcn UI
- **Styling:** CSS with inline styles
- **State Management:** React Context API
- **HTTP Client:** Axios + Fetch API

### Backend Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Payment:** PayPal REST API
- **Dev Tools:** nodemon, ts-node

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier OK)
- PayPal developer account (for payments)

### 1. Clone Repository

```bash
git clone <repository-url>
cd Lab_Door_Customs
```

### 2. Setup Backend

```bash
cd backend
npm install
cp env.template .env
```

Edit `.env` with your credentials:
```env
PORT=5000
FRONTEND_URL=http://localhost:5173

SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_key

PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_SECRET=your_paypal_secret
PAYPAL_MODE=sandbox
```

Setup database (see [backend/DATABASE_SETUP.md](backend/DATABASE_SETUP.md)):
1. Create Supabase project
2. Run `backend/src/database/schema.sql`
3. Run `backend/src/database/seed.sql` (optional)

Start backend:
```bash
npm run dev
```

### 3. Setup Frontend

```bash
cd frontend
npm install
cp env.template .env
```

Edit `.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_BACKEND_URL=http://localhost:5000
```

Start frontend:
```bash
npm run dev
```

### 4. Access Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- API Health: http://localhost:5000/api/health

## 📱 Features

### Customer Features

✅ **Product Browsing**
- Animated product carousel
- High-quality product images
- Product details and pricing
- Multiple size systems (US, UK, EU)

✅ **Shopping Cart**
- Add/remove items
- Size selection for each item
- Quantity management
- Real-time price calculation
- Persistent cart (localStorage)

✅ **Checkout**
- Form validation
- Multiple countries supported
- Shipping address collection
- Tax calculation (18% GST)
- Free shipping over $1000

✅ **Payment**
- Secure PayPal integration
- Sandbox testing mode
- Order confirmation page
- Receipt printing

✅ **Additional Pages**
- About Us
- Contact Us (with form submission)
- Help Center (Shipping, Privacy, Terms)
- Mobile-responsive design

### Admin Features (Backend API)

✅ **Product Management**
- CRUD operations
- Category management
- Stock tracking
- Search functionality

✅ **Order Management**
- View all orders
- Order status tracking
- Payment status management
- Customer order history
- Order statistics

✅ **Contact Management**
- View submissions
- Status tracking
- Message management

## 🎨 Design Features

- **Fully Responsive:** Mobile, tablet, and desktop optimized
- **Modern UI:** Gradient backgrounds, glassmorphism effects
- **Smooth Animations:** Framer Motion for page transitions
- **Loading States:** Skeleton screens and spinners
- **Error Handling:** User-friendly error messages
- **Accessibility:** ARIA labels, semantic HTML

## 📊 Database Schema

### Products
- Product information
- Pricing and stock
- Images and descriptions
- Categories

### Orders
- Customer details
- Shipping address (JSONB)
- Order items (JSONB)
- Payment information
- Order status tracking
- PayPal transaction IDs

### Contact Messages
- Customer inquiries
- Status tracking
- Response management

## 🔐 Security Features

- CORS configured for specific origins
- Environment variables for sensitive data
- Row Level Security (Supabase)
- PayPal secure payment processing
- Input validation
- SQL injection protection (Supabase ORM)

## 🧪 Testing

### Backend Testing

```bash
cd backend
npm test  # (to be implemented)
```

Test API manually:
```bash
# Health check
curl http://localhost:5000/api/health

# Get products
curl http://localhost:5000/api/products

# Test PayPal
curl http://localhost:5000/api/paypal/test
```

### Frontend Testing

Open browser and test:
1. Product browsing and navigation
2. Add items to cart
3. Cart operations
4. Checkout form
5. PayPal sandbox payment
6. Contact form submission

## 📦 Deployment

### Backend Deployment

Recommended platforms:
- **Vercel** (recommended)
- **Heroku**
- **Railway**
- **DigitalOcean App Platform**

Steps:
1. Build: `npm run build`
2. Set environment variables
3. Deploy `dist/` folder
4. Point to `dist/server.js`

### Frontend Deployment

Recommended platforms:
- **Vercel** (recommended)
- **Netlify**
- **Cloudflare Pages**

Steps:
1. Build: `npm run build`
2. Deploy `dist/` folder
3. Configure environment variables
4. Set up redirects for SPA

### Environment Variables (Production)

Update these for production:
- `FRONTEND_URL` → Your frontend domain
- `PAYPAL_MODE=live` → For real payments
- `PAYPAL_CLIENT_ID` → Live credentials
- `PAYPAL_SECRET` → Live secret
- `NODE_ENV=production`

## 📚 Documentation

- [Backend README](backend/README.md)
- [Database Setup](backend/DATABASE_SETUP.md)
- [Setup Guide](SETUP_GUIDE.md)
- [Mobile Responsive](MOBILE_RESPONSIVE.md)
- [UI Improvements](UI_IMPROVEMENTS.md)
- [Changelog](CHANGELOG.md)

## 🛠️ Development Workflow

### Adding New Features

1. **Backend First:**
   - Add route in `backend/src/routes/`
   - Update `server.ts` to use route
   - Test with curl/Postman
   - Update API documentation

2. **Frontend Second:**
   - Create/update components
   - Add API calls
   - Update types
   - Test in browser

### Code Organization

```
frontend/src/
├── assets/           # Images, logos
├── components/       # Reusable components
├── pages/           # Page components
├── ui/              # UI library components
├── api.ts           # API client
├── config.ts        # Configuration
└── types.ts         # TypeScript types

backend/src/
├── database/        # SQL schemas
├── lib/            # Utilities (Supabase)
├── routes/         # API routes
└── server.ts       # Main server
```

## 🐛 Troubleshooting

### Common Issues

**"Cannot connect to backend"**
- Check backend is running on port 5000
- Verify VITE_BACKEND_URL in frontend .env
- Check CORS settings in backend

**"Supabase error"**
- Verify credentials in .env
- Check database tables exist
- Review RLS policies
- Ensure service_role key is used

**"PayPal payment fails"**
- Check PayPal credentials
- Verify PAYPAL_MODE setting
- Check PayPal dashboard for errors
- Ensure using sandbox account for testing

**"Port already in use"**
```bash
# Kill process on port 5000
lsof -i :5000
kill -9 <PID>
```

## 📈 Future Enhancements

- [ ] User authentication & accounts
- [ ] Order tracking system
- [ ] Email notifications
- [ ] Admin dashboard UI
- [ ] Product reviews & ratings
- [ ] Wishlist functionality
- [ ] Multiple payment methods
- [ ] Discount codes/coupons
- [ ] Inventory management
- [ ] Analytics dashboard
- [ ] Search functionality
- [ ] Filter by category/price
- [ ] Related products
- [ ] Recently viewed items

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

Private project - All rights reserved

## 👥 Team

**Designed & Developed by:** Shivam Negi

**Founder's Vision:**
"Lab Door Customs was founded from a love for beautifully crafted custom footwear. We celebrate unique design, premium comfort, and bold style. Every pair is curated to help you stand out."

## 📧 Contact

- **Website:** https://gaultiershoes.com (to be deployed)
- **Email:** support@gaultiershoes.com
- **GitHub:** [Your GitHub]

---

**Built with ❤️ using React, Node.js, TypeScript, and PayPal**

Last Updated: December 2024

