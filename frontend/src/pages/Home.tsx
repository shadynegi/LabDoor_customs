import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ChevronLeft, ChevronRight, ShoppingCart, Check, X, HelpCircle, AlertTriangle } from "lucide-react";
import { useCart, type SizeSystem } from "../contexts/CartContext";
import { useNavigate, Link } from "react-router-dom";
import { useProducts } from "../hooks/useProducts";
import ErrorMessage from "../components/ErrorMessage";
import LiquidButton from "../components/LiquidButton";
import LiquidModal from "../components/LiquidModal";
import { trackProductView } from "../utils/activityTracker";
import { HomePageSkeleton } from "../components/Skeletons";
import { buildResponsiveProductImg, PRODUCT_IMAGE_SIZES } from "../lib/responsiveImage";
import { resolveProductBackgroundForViewport } from "../lib/productImageMaps";
import MetaTags from "../components/MetaTags";
import { DEFAULT_META } from "../lib/site";
import { SHOE_SIZE_OPTIONS } from "../constants/shoeSizes";
import { useResponsive } from "../hooks/useResponsive";

const ProductCarousel = lazy(() => import("../components/ProductCarousel"));

import { logo_all_pages, logo_home_text } from "../lib/productImageMaps";

const imageVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.8,
    rotateY: direction > 0 ? 45 : -45,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    rotateY: 0,
    transition: { 
      type: "spring" as const, 
      stiffness: 200, 
      damping: 25,
      mass: 0.8
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
    scale: 0.8,
    rotateY: direction > 0 ? -45 : 45,
    transition: { duration: 0.3 },
  }),
};

const priceVariants: Variants = {
  enter: { opacity: 0, y: 20 },
  center: { 
    opacity: 1, 
    y: 0,
    transition: { delay: 0.2, duration: 0.4 }
  },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } }
};

const HERO_MAX_DOTS = 5;

/** At most 5 dots; when there are more products, show a window centered on the active slide. */
function getHeroDotIndices(productCount: number, currentIndex: number): number[] {
  if (productCount <= HERO_MAX_DOTS) {
    return Array.from({ length: productCount }, (_, i) => i);
  }
  const half = Math.floor(HERO_MAX_DOTS / 2);
  let start = currentIndex - half;
  if (start < 0) start = 0;
  let end = start + HERO_MAX_DOTS - 1;
  if (end >= productCount) {
    end = productCount - 1;
    start = end - HERO_MAX_DOTS + 1;
  }
  return Array.from({ length: HERO_MAX_DOTS }, (_, i) => start + i);
}

export default function Home() {
  const { products: apiProducts, loading, error, refetch } = useProducts();
  const products = apiProducts;  
  const [[index, direction], setIndex] = useState<[number, number]>([0, 0]);
  const { isMobile, isSmallMobile } = useResponsive();
  const productsCount = products.length;
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const navigate = useNavigate();

  const go = (dir: number) => {
    setIndex(([i]) => {
      const next = (i + dir + productsCount) % productsCount;
      return [next, dir];
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = Math.abs(e.clientY - startY.current);
    const threshold = 50;
    
    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(dx) > dy) {
      if (dx > threshold) go(-1);
      else if (dx < -threshold) go(1);
    }
    
    startX.current = null;
    startY.current = null;
  };

  const { addToCart: addToCartContext, state } = useCart();
  const [addedToCart, setAddedToCart] = useState<number | null>(null);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [selectedSizeSystem, setSelectedSizeSystem] = useState<SizeSystem>("US");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  // Track product view when product changes
  useEffect(() => {
    if (products.length > 0 && products[index]) {
      trackProductView(products[index].id, products[index].name);
    }
  }, [index, products]);

  const current = products[index];
  const heroImg = current
    ? buildResponsiveProductImg(current.image, {
        alt: current.name,
        sizes: PRODUCT_IMAGE_SIZES.hero,
        loading: 'eager',
        fetchPriority: 'high',
        width: 562,
        height: 562,
      })
    : null;

  const backgroundUrl = current?.background
    ? resolveProductBackgroundForViewport(current.background, isMobile ? 1280 : 1920)
    : undefined;

  useEffect(() => {
    if (!products.length || loading) return;
    const preload = (bg?: string) => {
      if (!bg) return;
      const img = new Image();
      img.src = bg;
    };
    const cur = products[index];
    const next = products[(index + 1) % productsCount];
    preload(cur?.background ? resolveProductBackgroundForViewport(cur.background, isMobile ? 1280 : 1920) : undefined);
    preload(next?.background ? resolveProductBackgroundForViewport(next.background, isMobile ? 1280 : 1920) : undefined);
    if (heroImg?.src) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = heroImg.src;
      if (heroImg.srcSet) link.setAttribute('imagesrcset', heroImg.srcSet);
      if (heroImg.sizes) link.setAttribute('imagesizes', heroImg.sizes);
      document.head.appendChild(link);
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [index, products, productsCount, loading, isMobile, heroImg?.src, heroImg?.srcSet, heroImg?.sizes]);

  // Show loading state with skeleton
  if (loading) {
    return <HomePageSkeleton isMobile={isMobile} />;
  }

  // Show error state with retry
  if (error && products.length === 0) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)" }}>
        <ErrorMessage message={error} onRetry={refetch} />
      </div>
    );
  }

  // Show empty state
  if (products.length === 0) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)" }}>
        <div style={{ textAlign: "center", maxWidth: 500 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: "#1f2937", marginBottom: 16 }}>No Products Available</h2>
          <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 24 }}>Check back soon for our latest collection!</p>
          <button
            onClick={() => navigate('/contact')}
            style={{ padding: "12px 24px", background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >
            Contact Us
          </button>
        </div>
      </div>
    );
  }

  // Size options for each system
  const sizeOptions = SHOE_SIZE_OPTIONS;

  const handleAddToCartClick = () => {
    setShowSizeModal(true);
    setSizeError(null);
    setSelectedSize(null);
  };

  const handleConfirmAddToCart = () => {
    if (!selectedSize) {
      setSizeError("Please select your size before adding to cart.");
      return;
    }

    const p = current;
    addToCartContext({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image,
      size: {
        system: selectedSizeSystem,
        value: selectedSize,
      },
    });

    setAddedToCart(p.id);
    setShowSizeModal(false);
    setSizeError(null);
    setSelectedSize(null);
    setTimeout(() => setAddedToCart(null), 2000);
  };

  const handleCloseSizeModal = () => {
    setShowSizeModal(false);
    setSizeError(null);
    setSelectedSize(null);
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        width: "100%",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      <MetaTags
        title={DEFAULT_META.title}
        description={DEFAULT_META.description}
        path="/"
      />
      {/* Animated Background Layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${current.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${backgroundUrl ?? ''})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 0,
          }}
        />
      </AnimatePresence>
      
      {/* Content Layer */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: isMobile ? "16px" : "24px",
          fontWeight: 600,
          letterSpacing: 1,
          position: "relative",
          zIndex: 10,
          minHeight: isSmallMobile ? 72 : (isMobile ? 100 : 120),
        }}
      >
        {/* Top Left Logo */}
        <Link to="/" style={{ 
          display: "flex", 
          alignItems: "center",
          position: "absolute",
          left: isMobile ? 16 : 24,
          textDecoration: "none",
        }}>
          <img 
            src={logo_all_pages.default}
            srcSet={logo_all_pages.srcSet}
            sizes="135px"
            alt="Lab Door Customs"
            width={135}
            height={68}
            loading="eager"
            decoding="async"
            style={{ 
              height: isSmallMobile ? 36 : (isMobile ? 50.625 : 67.5),
              width: "auto",
              filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))",
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

        {/* Centered Logo — hidden on very small screens to avoid overlap */}
        {!isSmallMobile && (
        <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <img 
            src={logo_home_text.default}
            srcSet={logo_home_text.srcSet}
            sizes="200px"
            alt="Lab Door Customs"
            width={200}
            height={68}
            loading="eager"
            decoding="async"
            style={{ 
              height: isMobile ? 50.625 : 67.5,
              width: "auto",
              filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))",
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

        {/* Desktop: Cart & About Us on Right */}
        {!isMobile && (
          <nav style={{ 
            display: "flex", 
            gap: 24, 
            alignItems: "center", 
            position: "absolute",
            right: isMobile ? 16 : 24
          }}>
            <Link to="/about" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none", transition: "color 0.2s", whiteSpace: "nowrap" }}>
              About Us
            </Link>
            <Link to="/cart" aria-label={state.items.length > 0 ? `Cart, ${state.items.reduce((sum, item) => sum + item.quantity, 0)} items` : 'Cart'} style={{ position: "relative", display: "inline-block" }}>
              <ShoppingCart size={40} color="rgba(255,255,255,0.85)" style={{ transition: "color 0.2s" }} aria-hidden="true" />
              {state.items.length > 0 && (
                <span style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  background: "#ef4444",
                  color: "white",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  border: "2px solid rgba(255,255,255,0.2)"
                }}>
                  {state.items.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </Link>
          </nav>
        )}

        {/* Mobile: Cart on Right */}
        {isMobile && (
          <Link to="/cart" aria-label={state.items.length > 0 ? `Cart, ${state.items.reduce((sum, item) => sum + item.quantity, 0)} items` : 'Cart'} style={{
            position: "absolute",
            right: 16,
            display: "inline-block"
          }}>
            <ShoppingCart size={40} color="rgba(255,255,255,0.85)" aria-hidden="true" />
            {state.items.length > 0 && (
              <span style={{
                position: "absolute",
                top: -8,
                right: -8,
                background: "#ef4444",
                color: "white",
                borderRadius: "50%",
                width: 22,
                height: 22,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                border: "2px solid rgba(255,255,255,0.2)"
              }}>
                {state.items.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </Link>
        )}
      </header>

      {/* Main Content */}
      <div
        role="region"
        aria-label="Hero product showcase"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: isMobile ? "20px 0 max(96px, calc(96px + env(safe-area-inset-bottom))) 0" : "40px 0",
          touchAction: "pan-y",
        }}
      >
        {/* Navigation Buttons - larger touch targets on mobile */}
        <div style={{
          position: "absolute",
          left: isMobile ? 4 : 20,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 10,
        }}>
          <LiquidButton
            onClick={() => go(-1)}
            style={{
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "50%",
              cursor: "pointer",
              padding: isMobile ? 10 : 12,
              minWidth: isMobile ? 48 : 56,
              minHeight: isMobile ? 48 : 56,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.25)";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.15)";
              e.currentTarget.style.transform = "scale(1)";
            }}
            aria-label="Previous"
          >
            <ChevronLeft size={isMobile ? 24 : 36} strokeWidth={2.5} color="white" />
          </LiquidButton>
        </div>

        <div style={{
          position: "absolute",
          right: isMobile ? 4 : 20,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 10,
        }}>
          <LiquidButton
            onClick={() => go(1)}
            style={{
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "50%",
              cursor: "pointer",
              padding: isMobile ? 10 : 12,
              minWidth: isMobile ? 48 : 56,
              minHeight: isMobile ? 48 : 56,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.25)";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.15)";
              e.currentTarget.style.transform = "scale(1)";
            }}
            aria-label="Next"
          >
            <ChevronRight size={isMobile ? 24 : 36} strokeWidth={2.5} color="white" />
          </LiquidButton>
        </div>

        {/* Product Display Area */}
        <div
          style={{
            width: "100%",
            maxWidth: 1200,
            margin: "0 auto",
            padding: isMobile ? "0 52px" : "0 100px", // Reduced mobile padding to prevent overflow
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: isMobile ? 380 : 500,
          }}
        >
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={current.id}
              custom={direction}
              style={{
                position: "relative",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Product Image */}
              <motion.div
                custom={direction}
                variants={imageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{
                  perspective: 1000,
                  position: "relative",
                  marginBottom: isMobile ? 20 : 40,
                }}
              >
                <motion.img
                  {...(heroImg ?? { src: '', alt: current.name })}
                  className="hero-product-img"
                  style={{
                    height: "auto",
                    filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.6))",
                    userSelect: "none",
                  }}
                  draggable={false}
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    y: {
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }}
                />
              </motion.div>

              {/* Product Name - Overlay on desktop, below on mobile */}
              <motion.h1
                variants={priceVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{
                  fontSize: isMobile ? "clamp(24px, 8vw, 36px)" : "clamp(48px, 8vw, 80px)",
                  letterSpacing: isMobile ? "4px" : "8px",
                  textTransform: "uppercase",
                  textAlign: "center",
                  fontWeight: 900,
                  background: "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  textShadow: "0 2px 20px rgba(0,0,0,0.3)",
                  marginBottom: isMobile ? 16 : 24,
                  padding: "0 20px",
                }}
              >
                {current.name}
              </motion.h1>

              {/* Description - Mobile only */}
              {isMobile && current.description && (
                <motion.p
                  variants={priceVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  style={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.8)",
                    textAlign: "center",
                    marginBottom: 20,
                  }}
                >
                  {current.description}
                </motion.p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Dots - Center Below Image */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: isMobile ? 4 : 8,
              marginTop: isMobile ? 16 : 30,
              zIndex: 10,
            }}
          >
            {getHeroDotIndices(products.length, index).map((i) => {
              const p = products[i];
              return (
              <button
                key={p.id}
                type="button"
                aria-label={`Show product ${i + 1}: ${p.name}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => setIndex([i, i > index ? 1 : -1])}
                style={{
                  width: isMobile ? 36 : 28,
                  height: isMobile ? 36 : 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                }}
              >
                <span style={{
                  width: i === index ? 12 : 8,
                  height: i === index ? 12 : 8,
                  borderRadius: "50%",
                  background: i === index ? "white" : "rgba(255,255,255,0.4)",
                  transition: "all 0.3s ease",
                  border: i === index ? "2px solid rgba(255,255,255,0.5)" : "none",
                  boxShadow: i === index ? "0 0 8px rgba(255,255,255,0.5)" : "none",
                  display: 'block',
                }} />
              </button>
              );
            })}
          </div>

          {/* Price and Add to Cart - Center Below Dots */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`price-${current.id}`}
              variants={priceVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                marginTop: isMobile ? 20 : 30,
                zIndex: 10,
              }}
            >
            <div
              style={{
                fontFamily: "'Orbitron', 'Courier New', monospace",
                fontSize: isMobile ? 28 : 42,
                letterSpacing: 2,
                fontWeight: 700,
                color: "#fff",
                textShadow: "0 2px 20px rgba(0,0,0,0.5)",
              }}
            >
              ${current.price}
            </div>
            <LiquidButton
              onClick={current.is_out_of_stock || current.stock === 0 ? undefined : handleAddToCartClick}
              disabled={current.is_out_of_stock || current.stock === 0}
              liquidOptions={{
                scale: 30,
                blur: 5,
                saturation: 200,
                aberration: 80,
                mode: 'prominent',
              }}
              style={{
                background: current.is_out_of_stock || current.stock === 0
                  ? "rgba(239, 68, 68, 0.5)"
                  : addedToCart === current.id 
                    ? "linear-gradient(90deg, #10b981, #059669)" 
                    : "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(10px)",
                border: current.is_out_of_stock || current.stock === 0 
                  ? "1px solid rgba(239, 68, 68, 0.5)" 
                  : "1px solid rgba(255, 255, 255, 0.3)",
                padding: isMobile ? "12px 32px" : "16px 40px",
                borderRadius: 12,
                color: "#fff",
                fontWeight: 700,
                fontSize: isMobile ? 16 : 18,
                cursor: current.is_out_of_stock || current.stock === 0 ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                boxShadow: "0 4px 20px rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: current.is_out_of_stock || current.stock === 0 ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (addedToCart !== current.id && !current.is_out_of_stock && current.stock !== 0) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 30px rgba(255,255,255,0.3)";
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)";
                }
              }}
              onMouseLeave={(e) => {
                if (addedToCart !== current.id && !current.is_out_of_stock && current.stock !== 0) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(255,255,255,0.2)";
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                }
              }}
            >
              {current.is_out_of_stock || current.stock === 0 ? (
                <>
                  <AlertTriangle size={20} />
                  Out of Stock
                </>
              ) : addedToCart === current.id ? (
                <>
                  <Check size={20} />
                  Added!
                </>
              ) : (
                "Add to cart"
              )}
            </LiquidButton>
          </motion.div>
        </AnimatePresence>
        </div>
      </div>

      {/* Product Carousel */}
      <Suspense fallback={null}>
        <ProductCarousel products={products} />
      </Suspense>

      {/* Size Selection Modal — plain (no LiquidWeb) for smooth FPS on hero page */}
      {showSizeModal && (
      <LiquidModal
        isOpen={showSizeModal}
        onClose={handleCloseSizeModal}
        maxWidth={500}
        plain
        ariaLabel="Select Size"
      >
              <button
                type="button"
                onClick={handleCloseSizeModal}
                aria-label="Close modal"
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  background: "#f3f4f6",
                  border: "none",
                  padding: 8,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  minWidth: 44,
                  minHeight: 44,
                }}
              >
                <X size={24} color="#6b7280" />
              </button>

              <h2 style={{
                fontSize: isMobile ? 24 : 28,
                fontWeight: 800,
                color: "#1f2937",
                marginBottom: 8,
                paddingRight: 40,
              }}>
                Select Size
              </h2>
              <p style={{
                fontSize: 14,
                color: "#6b7280",
                marginBottom: 24,
              }}>
                Choose your size system and size
              </p>

              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 12,
                }}>
                  Size System
                </label>
                <div style={{
                  display: "flex",
                  gap: 8,
                  background: "#f3f4f6",
                  padding: 4,
                  borderRadius: 10,
                }}>
                  {(["UK", "US", "EU"] as SizeSystem[]).map((system) => (
                    <button
                      key={system}
                      type="button"
                      aria-pressed={selectedSizeSystem === system}
                      onClick={() => {
                        setSelectedSizeSystem(system);
                        setSelectedSize(null);
                        setSizeError(null);
                      }}
                      style={{
                        flex: 1,
                        padding: "10px 16px",
                        minHeight: 44,
                        border: "none",
                        borderRadius: 8,
                        background: selectedSizeSystem === system
                          ? "linear-gradient(135deg, #361906 0%, #9c6649 100%)"
                          : "transparent",
                        color: selectedSizeSystem === system ? "white" : "#6b7280",
                        fontWeight: selectedSizeSystem === system ? 700 : 600,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      {system}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 12,
                }}>
                  Select Size
                </label>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "repeat(auto-fill, minmax(52px, 1fr))"
                    : "repeat(auto-fill, minmax(60px, 1fr))",
                  gap: 8,
                }}>
                  {sizeOptions[selectedSizeSystem].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setSelectedSize(size);
                        setSizeError(null);
                      }}
                      style={{
                        padding: isMobile ? "14px 8px" : "12px 8px",
                        minHeight: isMobile ? 48 : 44,
                        border: selectedSize === size
                          ? "2px solid #9c6649"
                          : "1px solid #d1d5db",
                        borderRadius: 10,
                        background: selectedSize === size ? "#f5e0d5" : "white",
                        color: selectedSize === size ? "#9c6649" : "#374151",
                        fontWeight: selectedSize === size ? 700 : 500,
                        fontSize: isMobile ? 15 : 14,
                        cursor: "pointer",
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {sizeError && (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#fee2e2",
                    borderRadius: 8,
                    marginBottom: 20,
                  }}
                >
                  <span style={{ color: "#dc2626", fontSize: 14, fontWeight: 500 }}>
                    {sizeError}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleConfirmAddToCart}
                style={{
                  width: "100%",
                  padding: "16px",
                  minHeight: 48,
                  background: "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Add to Cart
              </button>
      </LiquidModal>
      )}

      {/* Mobile Navigation Bar */}
      {isMobile && (
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#000000",
            backdropFilter: "blur(10px)",
            padding: "12px max(20px, env(safe-area-inset-right, 0px))",
            paddingLeft: "max(20px, env(safe-area-inset-left, 0px))",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            zIndex: 20,
          }}
        >
          <Link
            to="/contact"
            style={{
              color: "#ffffff",
              fontSize: 14,
              textDecoration: "none",
              minHeight: 44,
              minWidth: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 12px",
            }}
          >
            Contact Us
          </Link>
          <Link
            to="/about"
            style={{
              color: "#ffffff",
              fontSize: 14,
              textDecoration: "none",
              minHeight: 44,
              minWidth: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 12px",
            }}
          >
            About Us
          </Link>
          <button
            type="button"
            onClick={() => navigate('/help')}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
              minWidth: 44,
              padding: "10px 12px",
            }}
          >
            <HelpCircle size={16} />
            Help
          </button>
        </nav>
      )}
      </div>
    </div>
  );
}