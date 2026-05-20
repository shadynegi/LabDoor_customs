# 🛍️ Lab Door Customs

A modern, full-stack e-commerce shoe store built with React, TypeScript, and Express, featuring PayPal payment integration.

![Tech Stack](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Node.js](https://img.shields.io/badge/Node.js-20-green)
![Express](https://img.shields.io/badge/Express-4.21-lightgrey)

## ✨ Features

- 🎨 **Beautiful UI/UX** - Modern, animated interface with Framer Motion
- 🛒 **Shopping Cart** - Full cart functionality with localStorage persistence
- 💳 **PayPal Integration** - Secure payment processing with PayPal Checkout
- 📱 **Responsive Design** - Optimized for desktop, tablet, and mobile
- 🎯 **TypeScript** - Type-safe code throughout the application
- 🔐 **Secure** - Environment-based configuration and secure payment handling
- ⚡ **Fast** - Built with Vite for lightning-fast development and builds

## 🏗️ Project Structure

```
Lab_Door_Customs/
├── frontend/               # React + TypeScript frontend
│   ├── src/
│   │   ├── assets/        # Images and static files
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── ui/            # UI component library (shadcn/ui)
│   │   ├── App.tsx        # Main app component
│   │   ├── config.ts      # Environment configuration
│   │   └── main.tsx       # Entry point
│   └── package.json
│
├── backend/               # Express + TypeScript backend
│   ├── src/
│   │   ├── lib/          # Integrations (Supabase)
│   │   ├── server.ts     # Main server file with routes
│   │   └── index.ts      # Alternative entry (not used)
│   └── package.json
│
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and npm
- PayPal Developer Account (for payment processing)
- Supabase Account (optional, for future database features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Lab_Door_Customs
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   
   # Copy environment template and configure
   cp env.template .env
   # Edit .env with your credentials
   ```

3. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   
   # Copy environment template and configure
   cp env.template .env
   # Edit .env with your backend URL
   ```

### Environment Configuration

#### Backend (.env)
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Supabase (optional for now)
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key

# PayPal (required)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_SECRET=your_paypal_secret
PAYPAL_MODE=sandbox  # or 'live' for production
```

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_BACKEND_URL=http://localhost:5000
```

### Running the Application

1. **Start Backend** (Terminal 1)
   ```bash
   cd backend
   npm run dev
   ```
   Server will start at http://localhost:5000

2. **Start Frontend** (Terminal 2)
   ```bash
   cd frontend
   npm run dev
   ```
   App will open at http://localhost:5173

## 🎯 Available Scripts

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production build
- `npm test` - Run tests (to be implemented)

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **Framer Motion** - Animations
- **Lucide React** - Icons
- **Axios** - HTTP client

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **PayPal SDK** - Payment processing
- **Supabase** - Database (planned)
- **CORS** - Cross-origin support
- **dotenv** - Environment variables

## 📡 API Endpoints

### Health Check
- `GET /api/health` - Server health status
- `GET /api/paypal/test` - Test PayPal connection

### PayPal Payment
- `POST /api/paypal/create-payment` - Create payment order
- `POST /api/paypal/capture-payment/:orderId` - Capture completed payment
- `GET /api/paypal/order/:orderId` - Get order details
- `POST /api/paypal/refund/:captureId` - Process refund
- `POST /api/paypal/webhook` - PayPal webhook handler

## 🎨 Features Breakdown

### Shopping Cart
- Add/remove items
- Update quantities
- Persistent cart (localStorage)
- Real-time total calculation
- Tax and shipping calculation

### Checkout Process
1. View cart and order summary
2. Enter shipping information
3. Validate form inputs
4. Redirect to PayPal for payment
5. Process payment capture
6. Display order confirmation

### Product Display
- Animated carousel
- Touch/swipe support
- Beautiful product presentations
- Responsive design

## 🔒 Security Features

- CORS protection
- Environment-based configuration
- Secure PayPal integration
- Input validation
- Error boundaries
- SSL ready

## 📱 Mobile Responsive

The application is fully responsive with:
- Mobile-first design approach
- Touch gesture support
- Optimized layouts for all screen sizes
- Mobile navigation menu

## 🐛 Known Issues & Future Improvements

### Planned Features
- [ ] Product database integration with Supabase
- [ ] User authentication system
- [ ] Order history and tracking
- [ ] Admin panel for product management
- [ ] Email notifications
- [ ] Wishlist functionality
- [ ] Product reviews and ratings
- [ ] Search and filter functionality
- [ ] Multiple payment methods
- [ ] Comprehensive testing suite

### Technical Improvements
- [ ] Add comprehensive error logging
- [ ] Implement rate limiting
- [ ] Add request validation middleware
- [ ] Set up CI/CD pipeline
- [ ] Add performance monitoring
- [ ] Implement caching strategy

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is private and proprietary.

## 🙏 Acknowledgments

- React and the React team
- PayPal Developer Platform
- Framer Motion for animations
- shadcn/ui for UI components
- All open source contributors

## 📞 Support

For issues and questions, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ for shoe enthusiasts**

