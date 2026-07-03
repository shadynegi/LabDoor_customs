import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { ShoppingCart, Package, ShoppingBag } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { CartProvider, useCart } from "./pages/CartContext";
import ErrorBoundary from "./components/ErrorBoundary";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import { AdminAuthProvider, useAdminAuth, ADMIN_DASHBOARD_PATH, ADMIN_LOGIN_PATH } from "./contexts/AdminAuthContext";
import { Toaster } from "sonner";
import { trackPageView } from "./utils/activityTracker";
import CookieConsent, { openCookiePreferences } from "./components/CookieConsent";
import { trackGaPageView } from "./lib/analytics";
import { logo_all_pages, logo_all_pages_text } from "./lib/productImageMaps";
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
  <div
    role="status"
    aria-live="polite"
    aria-label="Loading page"
    style={{ 
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

const FOOTER_HIDDEN_ROUTES = ['/', '/cart', '/checkout'];

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAdminAuth();

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
    return <Navigate to={ADMIN_LOGIN_PATH} replace />;
  }

  return <>{children}</>;
}

/** `/admin` — send to login or dashboard based on session. */
function AdminEntryRedirect() {
  const { isAuthenticated } = useAdminAuth();

  if (isAuthenticated === null) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
      }}>
        <div style={{ color: 'white', fontSize: 18 }}>Verifying authentication...</div>
      </div>
    );
  }

  return (
    <Navigate
      to={isAuthenticated ? ADMIN_DASHBOARD_PATH : ADMIN_LOGIN_PATH}
      replace
    />
  );
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
          src={logo_all_pages.default}
          srcSet={logo_all_pages.srcSet}
          sizes="50px"
          alt="Lab Door Customs Logo"
          width={50}
          height={50}
          loading="eager"
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
            src={logo_all_pages_text.default}
            srcSet={logo_all_pages_text.srcSet}
            sizes="200px"
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
          to="/products"
          style={{
            textDecoration: "none",
            color: location.pathname === '/products' || location.pathname.startsWith('/product/')
              ? "#9c6649"
              : "#6b7280",
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
            background: location.pathname === '/products' || location.pathname.startsWith('/product/')
              ? "#f3f4f6"
              : "transparent",
          }}
        >
          <ShoppingBag size={isMobile ? 22 : 20} />
          {!isMobile && "Products"}
        </Link>
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
          aria-label={cartCount > 0 ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'}
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

function AppShell() {
  const location = useLocation();
  const showFooter = !FOOTER_HIDDEN_ROUTES.includes(location.pathname);

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      position: "relative",
    }}>
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: -9999,
          top: 'auto',
          width: 1,
          height: 1,
          overflow: 'hidden',
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = '16px';
          e.currentTarget.style.top = '16px';
          e.currentTarget.style.width = 'auto';
          e.currentTarget.style.height = 'auto';
          e.currentTarget.style.overflow = 'visible';
          e.currentTarget.style.zIndex = '9999';
          e.currentTarget.style.padding = '12px 16px';
          e.currentTarget.style.background = '#fff';
          e.currentTarget.style.color = '#361906';
          e.currentTarget.style.borderRadius = '8px';
          e.currentTarget.style.fontWeight = '600';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = '-9999px';
          e.currentTarget.style.width = '1px';
          e.currentTarget.style.height = '1px';
          e.currentTarget.style.overflow = 'hidden';
        }}
      >
        Skip to main content
      </a>
      <Navigation />

      <main id="main-content" style={{
        flex: '1 0 auto',
        width: '100%',
      }}>
        <PageViewTracker />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<RouteErrorBoundary title="Home page error"><Home /></RouteErrorBoundary>} />
            <Route path="/products" element={<RouteErrorBoundary title="Products page error"><ProductsPage /></RouteErrorBoundary>} />
            <Route path="/product/:id" element={<RouteErrorBoundary title="Product page error"><ProductDetailPage /></RouteErrorBoundary>} />
            <Route path="/about" element={<RouteErrorBoundary title="About page error"><AboutUs /></RouteErrorBoundary>} />
            <Route path="/contact" element={<RouteErrorBoundary title="Contact page error"><ContactUs /></RouteErrorBoundary>} />
            <Route path="/help" element={<RouteErrorBoundary title="Help page error"><HelpCenter /></RouteErrorBoundary>} />
            <Route path="/privacy-policy" element={<RouteErrorBoundary title="Privacy policy error"><PrivacyPolicy /></RouteErrorBoundary>} />
            <Route path="/terms-of-service" element={<RouteErrorBoundary title="Terms of service error"><TermsOfService /></RouteErrorBoundary>} />
            <Route path="/returns-policy" element={<RouteErrorBoundary title="Replacement policy error"><ReturnsPolicy /></RouteErrorBoundary>} />
            <Route path="/replacement-policy" element={<RouteErrorBoundary title="Replacement policy error"><ReturnsPolicy /></RouteErrorBoundary>} />
            <Route path="/shipping-policy" element={<RouteErrorBoundary title="Shipping policy error"><ShippingPolicy /></RouteErrorBoundary>} />
            <Route path="/orders" element={<RouteErrorBoundary title="Orders page error"><MyOrders /></RouteErrorBoundary>} />
            <Route path="/admin/login" element={<RouteErrorBoundary title="Admin login error"><AdminLogin /></RouteErrorBoundary>} />
            <Route path="/admin" element={<AdminEntryRedirect />} />
            <Route path="/adminshivamdashboard" element={
              <ProtectedAdminRoute>
                <RouteErrorBoundary title="Admin dashboard error">
                  <AdminDashboard />
                </RouteErrorBoundary>
              </ProtectedAdminRoute>
            } />
            <Route path="/cart" element={<RouteErrorBoundary title="Cart error"><CartPage /></RouteErrorBoundary>} />
            <Route path="/checkout" element={<RouteErrorBoundary title="Checkout error"><Checkout /></RouteErrorBoundary>} />
            <Route path="/payment/success" element={<RouteErrorBoundary title="Payment error"><PaymentSuccess /></RouteErrorBoundary>} />
            <Route path="/payment/cancel" element={<RouteErrorBoundary title="Payment cancel error"><Cancel /></RouteErrorBoundary>} />
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
      </main>

      {showFooter && (
        <footer style={{
          textAlign: "center",
          padding: "24px 16px",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          borderTop: "1px solid #e5e7eb",
          background: "#f9fafb",
          fontSize: 14,
          color: "#6b7280",
          flexShrink: 0,
        }}>
          <p style={{ margin: 0 }}>
            © {new Date().getFullYear()} Lab Door Customs. All rights reserved.
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.6 }}>
            <strong>All sales final.</strong> No refunds — replacements for manufacturing defects only.{' '}
            <Link to="/returns-policy" style={{ color: '#9c6649' }}>Replacement Policy</Link>
            {' · '}
            <Link to="/terms-of-service" style={{ color: '#9c6649' }}>Terms</Link>
            {' · '}
            <Link to="/shipping-policy" style={{ color: '#9c6649' }}>Shipping</Link>
            {' · '}
            <Link to="/help" style={{ color: '#9c6649' }}>Help</Link>
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
              minHeight: 44,
            }}
          >
            Cookie preferences
          </button>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CartProvider>
        <BrowserRouter>
          <AdminAuthProvider>
            <AppShell />
          </AdminAuthProvider>
          <Toaster position="top-center" richColors closeButton />
          <CookieConsent />
        </BrowserRouter>
      </CartProvider>
    </ErrorBoundary>
  );
}