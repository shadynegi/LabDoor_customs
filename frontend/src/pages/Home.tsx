//Home.tsx  
import React, { useState, useRef, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ChevronLeft, ChevronRight, ShoppingCart, Check, X, HelpCircle, AlertTriangle } from "lucide-react";
import { useCart, type SizeSystem } from "./CartContext";
import { useNavigate } from "react-router-dom";
import { useProducts, type Product } from "../hooks/useProducts";
import ErrorMessage from "../components/ErrorMessage";
import LiquidButton from "../components/LiquidButton";
import LiquidModal from "../components/LiquidModal";
import { trackProductView, trackAddToCart } from "../utils/activityTracker";
import { HomePageSkeleton } from "../components/Skeletons";
import { optimizeImageUrl } from "../utils/imageUrl";
import MetaTags from "../components/MetaTags";
import { DEFAULT_META } from "../lib/site";

const ProductCarousel = lazy(() => import("../components/ProductCarousel"));

import logoHomePageText from "../assets/Logo/LogoHomePageText.png";
import logoHomePage from "../assets/Logo/LogoAllPages.png";

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

export default function Home() {
  const { products: apiProducts, loading, error, refetch } = useProducts();
  const products = apiProducts;  
  const [[index, direction], setIndex] = useState<[number, number]>([0, 0]);
  const [isMobile, setIsMobile] = useState(false);
  const productsCount = products.length;
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkLayout = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

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

  const heroImageSrc =
    products[index]?.image
      ? optimizeImageUrl(products[index].image, { width: isMobile ? 560 : 900 })
      : '';

  useEffect(() => {
    if (!heroImageSrc || loading) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = heroImageSrc;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [heroImageSrc, loading]);

  // Show loading state with skeleton
  if (loading) {
    return <HomePageSkeleton isMobile={isMobile} />;
  }

  // Show error state with retry
  if (error && products.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)" }}>
        <ErrorMessage message={error} onRetry={refetch} />
      </div>
    );
  }

  // Show empty state
  if (products.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)" }}>
        <div style={{ textAlign: "center", maxWidth: 500 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: "#1f2937", marginBottom: 16 }}>No Products Available</h2>
          <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 24 }}>Check back soon for our latest collection!</p>
          <button
            onClick={() => navigate('/contact')}
            style={{ padding: "12px 24px", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >
            Contact Us
          </button>
        </div>
      </div>
    );
  }

  const current = products[index];

  // Size options for each system
  const sizeOptions = {
    UK: ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12"],
    US: ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13"],
    EU: ["38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48"],
  };

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
    
    // Track add to cart event
    trackAddToCart(p.id, p.name, 1, selectedSize);
    
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
        minHeight: "100vh",
        width: "100%",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
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
            backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${current.background})`,
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
          minHeight: isMobile ? 100 : 120,
        }}
      >
        {/* Top Left Logo */}
        <a href="/" style={{ 
          display: "flex", 
          alignItems: "center",
          position: "absolute",
          left: isMobile ? 16 : 24
        }}>
          <img 
            src={logoHomePage} 
            alt="Lab Door Customs"
            width={135}
            height={68}
            loading="lazy"
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
        </a>

        {/* Centered Logo */}
        <a href="/" style={{ display: "flex", alignItems: "center" }}>
          <img 
            src={logoHomePageText} 
            alt="Lab Door Customs"
            width={200}
            height={68}
            loading="lazy"
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
        </a>

        {/* Desktop: Cart & About Us on Right */}
        {!isMobile && (
          <nav style={{ 
            display: "flex", 
            gap: 24, 
            alignItems: "center", 
            position: "absolute",
            right: isMobile ? 16 : 24
          }}>
            <a href="/about" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none", transition: "color 0.2s", whiteSpace: "nowrap" }}>
              About Us
            </a>
            <a href="/cart" style={{ position: "relative", display: "inline-block" }}>
              <ShoppingCart size={40} color="rgba(255,255,255,0.85)" style={{ transition: "color 0.2s" }} />
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
            </a>
          </nav>
        )}

        {/* Mobile: Cart on Right */}
        {isMobile && (
          <a href="/cart" style={{ 
            position: "absolute",
            right: 16,
            display: "inline-block"
          }}>
            <ShoppingCart size={40} color="rgba(255,255,255,0.85)" />
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
          </a>
        )}
      </header>

      {/* Main Content */}
      <main
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: isMobile ? "20px 0 max(80px, calc(80px + env(safe-area-inset-bottom))) 0" : "40px 0",
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
                  src={heroImageSrc}
                  alt={current.name}
                  width={isMobile ? 350 : 562}
                  height={isMobile ? 350 : 562}
                  loading="eager"
                  decoding="async"
                  style={{
                    width: isMobile ? "350px" : "562px",
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
            {products.map((p, i) => (
              <motion.div
                key={p.id}
                onClick={() => setIndex([i, i > index ? 1 : -1])}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  // Larger touch target with smaller visible dot
                  width: isMobile ? 36 : 28,
                  height: isMobile ? 36 : 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <div style={{
                  width: i === index ? 12 : 8,
                  height: i === index ? 12 : 8,
                  borderRadius: "50%",
                  background: i === index ? "white" : "rgba(255,255,255,0.4)",
                  transition: "all 0.3s ease",
                  border: i === index ? "2px solid rgba(255,255,255,0.5)" : "none",
                  boxShadow: i === index ? "0 0 8px rgba(255,255,255,0.5)" : "none",
                }} />
              </motion.div>
            ))}
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
      </main>

      {/* Product Carousel */}
      <Suspense fallback={null}>
        <ProductCarousel products={products} />
      </Suspense>

      {/* Size Selection Modal */}
      <LiquidModal
        isOpen={showSizeModal}
        onClose={handleCloseSizeModal}
        maxWidth={500}
        contentStyle={{
          padding: isMobile ? 24 : 32,
        }}
      >
              {/* Close Button */}
              <LiquidButton
                onClick={handleCloseSizeModal}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  padding: 8,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Close modal"
              >
                <X size={24} color="#6b7280" />
              </LiquidButton>

              {/* Title */}
              <h2 style={{
                fontSize: isMobile ? 24 : 28,
                fontWeight: 800,
                color: "#1f2937",
                marginBottom: 8,
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

              {/* Size System Selector */}
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
                  background: "rgba(243, 244, 246, 0.3)",
                  backdropFilter: "blur(10px)",
                  padding: 4,
                  borderRadius: 10,
                }}>
                  {(["UK", "US", "EU"] as SizeSystem[]).map((system) => (
                    <LiquidButton
                      key={system}
                      onClick={() => {
                        setSelectedSizeSystem(system);
                        setSelectedSize(null);
                        setSizeError(null);
                      }}
                      style={{
                        flex: 1,
                        padding: "10px 16px",
                        border: `1px solid ${selectedSizeSystem === system ? "rgba(102, 126, 234, 0.4)" : "transparent"}`,
                        borderRadius: 8,
                        background: selectedSizeSystem === system
                          ? "rgba(102, 126, 234, 0.2)"
                          : "transparent",
                        backdropFilter: "blur(10px)",
                        color: selectedSizeSystem === system ? "#667eea" : "#6b7280",
                        fontWeight: selectedSizeSystem === system ? 700 : 600,
                        fontSize: 15,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {system}
                    </LiquidButton>
                  ))}
                </div>
              </div>

              {/* Size Options */}
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
                  gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
                  gap: 8,
                }}>
                  {sizeOptions[selectedSizeSystem].map((size) => (
                    <LiquidButton
                      key={size}
                      onClick={() => {
                        setSelectedSize(size);
                        setSizeError(null);
                      }}
                      style={{
                        padding: "12px 8px",
                        border: selectedSize === size
                          ? "2px solid rgba(102, 126, 234, 0.6)"
                          : "1px solid rgba(209, 213, 219, 0.4)",
                        borderRadius: 8,
                        background: selectedSize === size 
                          ? "rgba(237, 233, 254, 0.4)" 
                          : "rgba(255, 255, 255, 0.2)",
                        backdropFilter: "blur(10px)",
                        color: selectedSize === size ? "#667eea" : "#374151",
                        fontWeight: selectedSize === size ? 700 : 500,
                        fontSize: 14,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {size}
                    </LiquidButton>
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {sizeError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: "12px 16px",
                    background: "#fee2e2",
                    borderRadius: 8,
                    marginBottom: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "#dc2626", fontSize: 14, fontWeight: 500 }}>
                    {sizeError}
                  </span>
                </motion.div>
              )}

              {/* Add to Cart Button */}
              <LiquidButton
                onClick={handleConfirmAddToCart}
                liquidOptions={{
                  scale: 25,
                  blur: 4,
                  saturation: 180,
                  aberration: 60,
                  mode: 'prominent',
                }}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "rgba(102, 126, 234, 0.2)",
                  backdropFilter: "blur(10px)",
                  color: "#667eea",
                  border: "1px solid rgba(102, 126, 234, 0.4)",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Add to Cart
              </LiquidButton>
      </LiquidModal>

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
            padding: "12px 20px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            zIndex: 20,
          }}
        >
          <a 
            href="/contact" 
            style={{ color: "#ffffff", fontSize: 14, textDecoration: "none" }}
          >
            Contact Us
          </a>
          <a href="/about" style={{ color: "#ffffff", fontSize: 14, textDecoration: "none" }}>About Us</a>
          <button
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
              padding: 0
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