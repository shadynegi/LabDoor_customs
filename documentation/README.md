# Lab Door Customs - Backend API

Modern Node.js/Express backend with TypeScript, PayPal integration, and Supabase database.

## Features

- ✅ RESTful API with Express.js
- ✅ TypeScript for type safety
- ✅ PayPal payment integration (Sandbox & Live)
- ✅ Supabase PostgreSQL database
- ✅ Product management
- ✅ Order management
- ✅ Contact form submissions
- ✅ CORS enabled for frontend
- ✅ Request logging
- ✅ Error handling middleware
- ✅ Environment-based configuration

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Payment:** PayPal REST API
- **Dev Tools:** nodemon, ts-node

## 📚 Documentation

Comprehensive guides are available in the [`documentation/`](./documentation) folder:

- **[API Documentation](./documentation/API_DOCUMENTATION.md)** - Complete API reference with examples
- **[Database Setup](./documentation/DATABASE_SETUP.md)** - Supabase database configuration guide
- **[PayPal Setup Guide](./documentation/PAYPAL_SETUP_GUIDE.md)** - Step-by-step PayPal integration
- **[Order Management Guide](./documentation/ORDER_MANAGEMENT_GUIDE.md)** - Order tracking and fulfillment
- **[Get Database URL](./documentation/GET_DATABASE_URL.md)** - How to retrieve database connection string
- **[Diagnose PayPal Issues](./documentation/diagnose-paypal-issue.md)** - Troubleshooting PayPal payments
- **[Project Cleanup Report](./documentation/PROJECT_CLEANUP_REPORT.md)** - Code optimization history

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- PayPal developer account

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the environment template:

```bash
cp env.template .env
```

Edit `.env` with your credentials:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_SECRET=your_paypal_secret
PAYPAL_MODE=sandbox
```

### 3. Database Setup

See [DATABASE_SETUP.md](./documentation/DATABASE_SETUP.md) for detailed Supabase setup instructions.

Quick steps:
1. Create Supabase project
2. Run `src/database/schema.sql` in SQL Editor
3. Get sample data from documentation if needed

### 4. Get PayPal Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Create a new app (or use existing)
3. Copy Client ID and Secret
4. Use sandbox credentials for development

### 5. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:5000`

### 6. Test the API

```bash
# Health check
curl http://localhost:5000/api/health

# Get products
curl http://localhost:5000/api/products

# PayPal test
curl http://localhost:5000/api/paypal/test
```

## API Endpoints

### General

- `GET /api/health` - Health check

### Products

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/category/:category` - Get products by category
- `POST /api/products/search` - Search products

### Orders

- `GET /api/orders` - Get all orders (with pagination)
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order by ID
- `GET /api/orders/number/:orderNumber` - Get order by order number
- `GET /api/orders/customer/:email` - Get customer's orders
- `PUT /api/orders/:id` - Update order
- `PATCH /api/orders/:id/status` - Update order status
- `PATCH /api/orders/:id/payment-status` - Update payment status
- `GET /api/orders/stats/summary` - Get order statistics

### Contact

- `POST /api/contact` - Submit contact form
- `GET /api/contact` - Get all messages (admin)
- `GET /api/contact/:id` - Get message by ID
- `PATCH /api/contact/:id/status` - Update message status
- `DELETE /api/contact/:id` - Delete message
- `GET /api/contact/stats/summary` - Get contact statistics

### PayPal

- `GET /api/paypal/test` - Test PayPal connection
- `POST /api/paypal/create-payment` - Create payment
- `POST /api/paypal/capture-payment/:orderId` - Capture payment
- `GET /api/paypal/order/:orderId` - Get order details
- `POST /api/paypal/refund/:captureId` - Process refund
- `POST /api/paypal/webhook` - PayPal webhook handler

## Project Structure

```
backend/
├── src/
│   ├── database/
│   │   └── schema.sql          # Database schema
│   ├── lib/
│   │   └── db.ts               # Direct PostgreSQL client
│   ├── routes/
│   │   ├── products.ts         # Product routes
│   │   ├── orders.ts           # Order routes
│   │   └── contact.ts          # Contact routes
│   └── server.ts               # Main server file + PayPal
├── documentation/              # All documentation files
│   ├── API_DOCUMENTATION.md
│   ├── DATABASE_SETUP.md
│   ├── PAYPAL_SETUP_GUIDE.md
│   ├── ORDER_MANAGEMENT_GUIDE.md
│   ├── GET_DATABASE_URL.md
│   ├── diagnose-paypal-issue.md
│   └── PROJECT_CLEANUP_REPORT.md
├── .env                        # Environment variables
├── env.template                # Environment template
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── test-paypal-connection.js   # PayPal setup test
└── README.md                   # This file
```

## Development

### Build for Production

```bash
npm run build
```

Compiled files will be in `dist/` directory.

### Start Production Server

```bash
npm start
```

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests (not implemented yet)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment | development |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:5173 |
| `SUPABASE_URL` | Supabase project URL | - |
| `SUPABASE_KEY` | Supabase service role key | - |
| `PAYPAL_CLIENT_ID` | PayPal client ID | - |
| `PAYPAL_SECRET` | PayPal secret | - |
| `PAYPAL_MODE` | PayPal mode (sandbox/live) | sandbox |

## PayPal Integration

### Sandbox Testing

1. Use PayPal sandbox credentials
2. Create sandbox test accounts at [PayPal Developer](https://developer.paypal.com/developer/accounts/)
3. Use test accounts for buyer/seller
4. Test cards available in PayPal sandbox docs

### Going Live

1. Get live PayPal credentials
2. Update `.env`:
   ```env
   PAYPAL_MODE=live
   PAYPAL_CLIENT_ID=your_live_client_id
   PAYPAL_SECRET=your_live_secret
   ```
3. Test thoroughly before accepting real payments!

## Database

### Supabase Features Used

- PostgreSQL database
- Row Level Security (RLS)
- Auto-updating timestamps
- UUID primary keys
- JSONB fields for flexible data

### Migrations

Run migrations in order:
1. `schema.sql` - Creates tables and indexes
2. `seed.sql` - (Optional) Adds sample data

## Security

### Best Practices

- ✅ CORS configured for specific origin
- ✅ Environment variables for secrets
- ✅ Row Level Security on database
- ✅ Input validation on all endpoints
- ✅ Service role key never exposed to frontend
- ⚠️ Add authentication for admin routes
- ⚠️ Add rate limiting for production
- ⚠️ Add request validation middleware

### TODO for Production

- [ ] Add authentication (JWT, OAuth)
- [ ] Add authorization middleware
- [ ] Add rate limiting
- [ ] Add request validation (Joi, Zod)
- [ ] Add API documentation (Swagger)
- [ ] Add logging (Winston, Morgan)
- [ ] Add monitoring (Sentry)
- [ ] Add tests (Jest, Supertest)
- [ ] Add CI/CD pipeline
- [ ] Add Docker support

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000
# Kill process
kill -9 <PID>
```

### Supabase Connection Issues

- Verify `SUPABASE_URL` is correct
- Check `SUPABASE_KEY` is the service_role key
- Ensure RLS policies are set up
- Check network connection

### PayPal API Errors

- Verify credentials are correct
- Check `PAYPAL_MODE` matches your credentials
- Review PayPal API logs in developer dashboard
- Ensure webhooks are configured (if using)

### TypeScript Errors

```bash
# Clean and rebuild
rm -rf dist
npm run build
```

## API Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message"
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [...],
  "count": 100,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 100
  }
}
```

## Contributing

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## License

Private project - All rights reserved

## Support

For issues or questions:
- Check logs: `console.log` statements in development
- Review error responses
- Check Supabase logs
- Check PayPal developer dashboard
- Contact: support@gaultiershoes.com

## Changelog

### Version 1.0.0 (Current)

- Initial backend implementation
- PayPal integration
- Supabase database
- Products, Orders, Contact APIs
- Complete CRUD operations
- Error handling and logging

---

**Built with ❤️ by Lab Door Customs Team**
