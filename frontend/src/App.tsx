import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { ShoppingCart, Package } from "lucide-react";
import { useState, useEffect, lazy, Suspense } from "react";
import { CartProvider, useCart } from "./pages/CartContext";
import Loader from "./components/Loader";
import RouteLoader from "./components/RouteLoader";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "sonner";
import { trackPageView } from "./utils/activityTracker";
import CookieConsent, { openCookiePreferences } from "./components/CookieConsent";
import { trackGaPageView } from "./lib/analytics";
import { apiFetch } from "./config";
import logoAllPagesText from "./assets/Logo/LogoAllPagesText.png";
import logoAllPages from "./assets/Logo/LogoAllPages.png";
import { useResponsive } from "./hooks/useResponsive";

// Lazy load pages for better performance (code splitting for 1000+ users)
const Home = lazy(() => import("./pages/Home"));
const CartPage = lazy(() => import("./pages/CartPage"));
const Checkout = lazy(() => import("./pages/Checkout"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const Cancel = lazy(() => import("./pages/Cancel"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const ReturnsPolicy = lazy(() => import("./pages/ReturnsPolicy"));
const ShippingPolicy = lazy(() => import("./pages/ShippingPolicy"));

// Loading fallback component
const PageLoader = () => (
  <div style={{ 
    minHeight: '100vh', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)'
  }}>
    <div style={{ textAlign: 'center', color: 'white' }}>
      <div style={{ 
        width: 48, 
        height: 48, 
        border: '4px solid rgba(255,255,255,0.3)', 
        borderTopColor: 'white',
        borderRadius: '50%', 
        margin: '0 auto',
        animation: 'spin 1s linear infinite' 
      }} />
      <p style={{ marginTop: 16 }}>Loading...</p>
    </div>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
  </div>
);

// Protected Route Component for Admin
function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const response = await apiFetch('/admin/verify');
        setIsAuthenticated(response.ok);
      } catch {
        setIsAuthenticated(false);
      }
    };

    verifyAuth();
  }, []);

  if (isAuthenticated === null) {
    // Loading state
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)'
      }}>
        <div style={{ color: 'white', fontSize: 18 }}>Verifying authentication...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

// Page view tracker component
function PageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
    trackGaPageView(location.pathname);
  }, [location.pathname]);

  return null;
}

function Navigation() {
  const location = useLocation();
  const { isMobile, isSmallMobile } = useResponsive();
  const { state } = useCart();
  const cartCount = state.items.reduce((sum, item) => sum + item.quantity, 0);

  // Don't show navigation on home page or admin pages
  if (location.pathname === '/' || location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <div 
      style={{ 
        padding: isMobile ? "10px 12px" : "16px 24px", 
        borderBottom: "1px solid #e5e7eb", 
        display: "flex", 
        justifyContent: "space-between",
        alignItems: "center",
        background: "white",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        minHeight: isMobile ? 56 : 70,
      }}
    >
      {/* Left Logo */}
      <Link 
        to="/" 
        style={{ 
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <img 
          src={logoAllPages} 
          alt="Lab Door Customs Logo"
          width={50}
          height={50}
          loading="lazy"
          decoding="async"
          style={{ 
            height: isSmallMobile ? 36 : (isMobile ? 40 : 50),
            width: "auto",
            transition: "transform 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        />
      </Link>

      {/* Centered Logo - Hide on small mobile to prevent overlap */}
      {!isSmallMobile && (
        <Link 
          to="/" 
          style={{ 
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)"
          }}
        >
          <img 
            src={logoAllPagesText} 
            alt="Lab Door Customs"
            width={160}
            height={48}
            loading="lazy"
            decoding="async"
            style={{ 
              height: isMobile ? 36 : 48,
              width: "auto",
              transition: "transform 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          />
        </Link>
      )}
      
      {/* Right Navigation - Touch-friendly buttons */}
      <nav style={{ 
        display: "flex", 
        gap: isMobile ? 8 : 16, 
        alignItems: "center",
        flexShrink: 0,
      }}>
        <Link 
          to="/orders" 
          style={{ 
            textDecoration: "none",
            color: location.pathname === '/orders' ? "#9c6649" : "#6b7280",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontSize: isMobile ? 14 : 15,
            fontWeight: 600,
            transition: "all 0.2s",
            padding: isMobile ? "10px" : "8px 12px",
            borderRadius: 10,
            minWidth: isMobile ? 44 : "auto",
            minHeight: isMobile ? 44 : "auto",
            background: location.pathname === '/orders' ? "#f3f4f6" : "transparent",
          }}
        >
          <Package size={isMobile ? 22 : 20} />
          {!isMobile && "Orders"}
        </Link>
        <Link 
          to="/cart" 
          style={{ 
            textDecoration: "none",
            color: location.pathname === '/cart' ? "#9c6649" : "#6b7280",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontSize: isMobile ? 14 : 15,
            fontWeight: 600,
            transition: "all 0.2s",
            position: "relative",
            padding: isMobile ? "10px" : "8px 12px",
            borderRadius: 10,
            minWidth: isMobile ? 44 : "auto",
            minHeight: isMobile ? 44 : "auto",
            background: location.pathname === '/cart' ? "#f3f4f6" : "transparent",
          }}
        >
          <ShoppingCart size={isMobile ? 22 : 20} />
          {!isMobile && "Cart"}
          {cartCount > 0 && (
            <span style={{
              position: "absolute",
              top: isMobile ? 2 : -4,
              right: isMobile ? 2 : -4,
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              color: "white",
              borderRadius: "50%",
              width: isMobile ? 20 : 18,
              height: isMobile ? 20 : 18,
              fontSize: isMobile ? 11 : 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              boxShadow: "0 2px 4px rgba(239,68,68,0.3)",
            }}>
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </Link>
      </nav>
    </div>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initial page load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500); // Show loader for 1.5 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <CartProvider>
        <BrowserRouter>
          <Loader isLoading={isLoading} />
          <RouteLoader>
          <div style={{ 
            minHeight: "100vh", 
            display: "flex", 
            flexDirection: "column",
            position: "relative",
            overflow: "hidden"
          }}>
            <Navigation />
          
            <div style={{ 
              flex: 1,
              overflow: "auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain"
            }}>
              <PageViewTracker />
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/product/:id" element={<ProductDetailPage />} />
                <Route path="/about" element={<AboutUs />} />
                <Route path="/contact" element={<ContactUs />} />
                <Route path="/help" element={<HelpCenter />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/returns-policy" element={<ReturnsPolicy />} />
                <Route path="/shipping-policy" element={<ShippingPolicy />} />
                <Route path="/orders" element={<MyOrders />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/adminshivamdashboard" element={
                  <ProtectedAdminRoute>
                    <AdminDashboard />
                  </ProtectedAdminRoute>
                } />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/payment/success" element={<PaymentSuccess />} />
                <Route path="/payment/cancel" element={<Cancel />} />
                <Route path="*" element={
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  minHeight: "60vh",
                  padding: "20px",
                  textAlign: "center"
                }}>
                  <h1 style={{ fontSize: 48, marginBottom: 16 }}>404</h1>
                  <p style={{ color: "#6b7280", marginBottom: 24 }}>Page not found</p>
                  <Link 
                    to="/" 
                    style={{ 
                      padding: "12px 24px", 
                      background: "#000", 
                      color: "white", 
                      textDecoration: "none",
                      borderRadius: 8,
                      fontWeight: 600
                    }}
                  >
                    Go Home
                  </Link>
                </div>
              } />
              </Routes>
              </Suspense>
            </div>

            <footer style={{ 
              textAlign: "center", 
              padding: "24px 16px", 
              paddingBottom: "max(24px, env(safe-area-inset-bottom))",
              borderTop: "1px solid #e5e7eb",
              background: "#f9fafb",
              fontSize: 14,
              color: "#6b7280",
              flexShrink: 0
            }}>
              <p style={{ margin: 0 }}>
                © {new Date().getFullYear()} Lab Door Customs. All rights reserved.
              </p>
              <button
                type="button"
                onClick={openCookiePreferences}
                style={{
                  marginTop: 8,
                  background: 'none',
                  border: 'none',
                  color: '#9c6649',
                  fontSize: 13,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Cookie preferences
              </button>
            </footer>
          </div>
        </RouteLoader>
        <Toaster position="top-center" richColors closeButton />
        <CookieConsent />
      </BrowserRouter>
    </CartProvider>
  </ErrorBoundary>
  );
}