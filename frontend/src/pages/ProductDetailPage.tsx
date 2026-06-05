// ProductDetailPage - Individual product page with full details
import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Package, Shield, Truck, Check, RotateCcw, Image } from 'lucide-react';
import { apiFetch } from '../config';
import type { Product } from '../hooks/useProducts';
import { useCart, type SizeSystem } from './CartContext';
import StarRating from '../components/StarRating';
import ErrorMessage from '../components/ErrorMessage';
import { generatePlaceholder360Images, get360VideoPath } from '../utils/product360Images';
import { optimizeImageUrl } from '../utils/imageUrl';
import MetaTags from '../components/MetaTags';
import ProductJsonLd from '../components/ProductJsonLd';
import { logError } from '../lib/logger';
import { useResponsive } from '../hooks/useResponsive';

const Product360Viewer = lazy(() =>
  import('../components/Product360Viewer').then((m) => ({ default: m.Product360Viewer }))
);
const ProductReviews = lazy(() => import('../components/ProductReviews'));
import { ProductDetailSkeleton } from '../components/Skeletons';

// Import actual product images
import blueNikeImg from "../assets/Shoe_Design/blue nike.png";
import goldBlackNikeImg from "../assets/Shoe_Design/gold black nike.png";
import pinkNikeImg from "../assets/Shoe_Design/pink nike.png";
import blackBrownNikeImg from "../assets/Shoe_Design/black and brown nike.png";
import brownPinkNikeImg from "../assets/Shoe_Design/brown pink nike.png";
import blueBg from "../assets/Backgrounds/blue.png";
import goldBg from "../assets/Backgrounds/gold.png";
import pinkBg from "../assets/Backgrounds/pink.png";
import brownBg from "../assets/Backgrounds/brown.png";
import brownPinkBg from "../assets/Backgrounds/brown pink.png";

// Map database image references to actual imported images
const imageMap: Record<string, string> = {
  '/assets/blue-nike.png': blueNikeImg,
  '/assets/gold-black-nike.png': goldBlackNikeImg,
  '/assets/pink-nike.png': pinkNikeImg,
  '/assets/black-brown-nike.png': blackBrownNikeImg,
  '/assets/brown-pink-nike.png': brownPinkNikeImg,
};

const backgroundMap: Record<string, string> = {
  '/assets/blue-bg.png': blueBg,
  '/assets/gold-bg.png': goldBg,
  '/assets/pink-bg.png': pinkBg,
  '/assets/brown-bg.png': brownBg,
  '/assets/brown-pink-bg.png': brownPinkBg,
};

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isMobile } = useResponsive();

  const [selectedSizeSystem, setSelectedSizeSystem] = useState<SizeSystem>("US");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [show360View, setShow360View] = useState(false);

  const sizeOptions = {
    UK: ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12"],
    US: ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13"],
    EU: ["38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48"],
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiFetch(`/products/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch product');
        }

        const data = await response.json();

        if (data.success && data.data) {
          const productData = {
            ...data.data,
            price: typeof data.data.price === 'string' ? parseFloat(data.data.price) : data.data.price,
            rating: typeof data.data.rating === 'string' ? parseFloat(data.data.rating) : (data.data.rating || 0),
            review_count: typeof data.data.review_count === 'string' ? parseInt(data.data.review_count) : (data.data.review_count || 0),
            image: imageMap[data.data.image] || data.data.image,
            background: data.data.background ? (backgroundMap[data.data.background] || data.data.background) : undefined,
          };
          setProduct(productData);
        } else {
          throw new Error('Product not found');
        }
      } catch (err) {
        logError('Error fetching product:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to load product';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProduct();
    }
  }, [id]);

  const handleAddToCart = () => {
    if (!selectedSize) {
      setSizeError("Please select your size before adding to cart.");
      return;
    }

    if (!product) return;

    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      size: {
        system: selectedSizeSystem,
        value: selectedSize,
      },
    });
    
    setAddedToCart(true);
    setSizeError(null);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  if (loading) {
    return <ProductDetailSkeleton isMobile={isMobile} />;
  }

  const productSlug = product?.name?.toLowerCase().replace(/\s+/g, '-') ?? '';
  const hasReal360Assets = Boolean(get360VideoPath(productSlug));

  if (error || !product) {
    return (
      <div style={{ 
        minHeight: '80vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 20
      }}>
        <ErrorMessage 
          message={error || 'Product not found'} 
          onRetry={() => window.location.reload()} 
        />
      </div>
    );
  }

  const productImage = product.image
    ? optimizeImageUrl(product.image, { width: 1200 })
    : undefined;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
    }}>
      <MetaTags
        title={`${product.name} — Lab Door Customs`}
        description={
          product.description ||
          `Shop ${product.name} — premium custom footwear from Lab Door Customs.`
        }
        path={`/product/${product.id}`}
        image={productImage}
        type="product"
      />
      <ProductJsonLd
        id={product.id}
        name={product.name}
        description={product.description}
        image={productImage}
        price={product.price}
        inStock={!product.is_out_of_stock}
        rating={product.rating}
        reviewCount={product.review_count}
      />
      {/* Back Button */}
      <div style={{ 
        padding: isMobile ? '16px 20px' : '24px 60px',
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        <motion.button
          onClick={() => navigate(-1)}
          whileHover={{ x: -4 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            color: '#374151',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <ArrowLeft size={18} />
          Back
        </motion.button>
      </div>

      {/* Product Detail Content */}
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: isMobile ? '20px' : '40px 60px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? 32 : 60,
          background: 'white',
          borderRadius: 24,
          padding: isMobile ? 24 : 48,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        }}>
          {/* Product Image / 360° Viewer */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              position: 'relative',
              borderRadius: 20,
              overflow: 'hidden',
              background: product.background 
                ? `url(${product.background})` 
                : 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: isMobile ? 300 : 500,
            }}
          >
            {/* View Toggle Button */}
            <div style={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 20,
              display: 'flex',
              gap: 8,
            }}>
              <motion.button
                onClick={() => setShow360View(false)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: !show360View ? 'white' : 'rgba(255,255,255,0.3)',
                  color: !show360View ? '#374151' : 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backdropFilter: 'blur(8px)',
                  boxShadow: !show360View ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                <Image size={16} />
                Photo
              </motion.button>
              <motion.button
                onClick={() => setShow360View(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: show360View ? 'white' : 'rgba(255,255,255,0.3)',
                  color: show360View ? '#374151' : 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backdropFilter: 'blur(8px)',
                  boxShadow: show360View ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                <RotateCcw size={16} />
                {hasReal360Assets ? '360°' : 'Spin'}
              </motion.button>
            </div>

            <AnimatePresence mode="wait">
              {show360View ? (
                <motion.div
                  key="360-viewer"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 20,
                  }}
                >
                  <Suspense fallback={<div style={{ padding: 40, color: '#fff' }}>Loading spin view…</div>}>
                    <Product360Viewer
                      images={generatePlaceholder360Images(product.image, 8)}
                      productName={product.name}
                      size={isMobile ? 'md' : 'lg'}
                      autoRotate={false}
                      showControls={true}
                      enableFullscreen={true}
                    />
                  </Suspense>
                </motion.div>
              ) : (
                <motion.img
                  key="static-image"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  src={optimizeImageUrl(product.image, { width: isMobile ? 640 : 960 })}
                  alt={product.name}
                  width={isMobile ? 320 : 480}
                  height={isMobile ? 320 : 480}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: '80%',
                    height: 'auto',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.3))',
                  }}
                />
              )}
            </AnimatePresence>
          </motion.div>

          {/* Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Category Badge */}
            {product.category && (
              <div style={{
                display: 'inline-block',
                padding: '6px 12px',
                background: '#f5e0d5',
                color: '#9c6649',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 16,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {product.category}
              </div>
            )}

            {/* Product Name */}
            <h1 style={{
              fontSize: isMobile ? 28 : 42,
              fontWeight: 900,
              color: '#1f2937',
              marginBottom: 16,
              lineHeight: 1.2,
            }}>
              {product.name}
            </h1>

            {/* Rating */}
            <div style={{ marginBottom: 24 }}>
              <StarRating 
                rating={product.rating || 0} 
                reviewCount={product.review_count || 0}
                size={isMobile ? 16 : 18}
              />
            </div>

            {/* Price */}
            <div style={{
              fontSize: isMobile ? 32 : 48,
              fontWeight: 900,
              color: '#9c6649',
              marginBottom: 24,
            }}>
              ${product.price}
            </div>

            {/* Description */}
            {product.description && (
              <p style={{
                fontSize: isMobile ? 15 : 16,
                color: '#6b7280',
                lineHeight: 1.6,
                marginBottom: 32,
              }}>
                {product.description}
              </p>
            )}

            {/* Size Selection */}
            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 700,
                color: '#374151',
                marginBottom: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Select Size
              </label>

              {/* Size System Selector */}
              <div style={{
                display: 'flex',
                gap: 8,
                background: '#f3f4f6',
                padding: 4,
                borderRadius: 10,
                marginBottom: 16,
              }}>
                {(["UK", "US", "EU"] as SizeSystem[]).map((system) => (
                  <button
                    key={system}
                    onClick={() => {
                      setSelectedSizeSystem(system);
                      setSelectedSize(null);
                      setSizeError(null);
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 16px",
                      border: "none",
                      borderRadius: 8,
                      background: selectedSizeSystem === system
                        ? "linear-gradient(135deg, #361906 0%, #9c6649 100%)"
                        : "transparent",
                      color: selectedSizeSystem === system ? "white" : "#6b7280",
                      fontWeight: selectedSizeSystem === system ? 700 : 600,
                      fontSize: 15,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {system}
                  </button>
                ))}
              </div>

              {/* Size Options */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile 
                  ? 'repeat(auto-fill, minmax(52px, 1fr))' 
                  : 'repeat(auto-fill, minmax(60px, 1fr))',
                gap: isMobile ? 10 : 8,
              }}>
                {sizeOptions[selectedSizeSystem].map((size) => (
                  <button
                    key={size}
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
                      transition: "all 0.2s",
                    }}
                  >
                    {size}
                  </button>
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
                  color: "#dc2626",
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                {sizeError}
              </motion.div>
            )}

            {/* Add to Cart Button */}
            <motion.button
              onClick={handleAddToCart}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%',
                padding: isMobile ? '16px' : '20px',
                background: addedToCart 
                  ? "linear-gradient(90deg, #10b981, #059669)" 
                  : "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
                color: "white",
                border: "none",
                borderRadius: 12,
                fontSize: isMobile ? 16 : 18,
                fontWeight: 700,
                cursor: "pointer",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                marginBottom: 32,
                boxShadow: '0 4px 12px rgba(102,126,234,0.4)',
              }}
            >
              {addedToCart ? (
                <>
                  <Check size={20} />
                  Added to Cart!
                </>
              ) : (
                <>
                  <ShoppingCart size={20} />
                  Add to Cart
                </>
              )}
            </motion.button>

            {/* Features */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 16,
              paddingTop: 32,
              borderTop: '1px solid #e5e7eb',
            }}>
              <div style={{ textAlign: 'center' }}>
                <Truck size={24} color="#9c6649" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Free Shipping</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>On orders over $1000</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Shield size={24} color="#9c6649" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Secure Payment</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>100% protected</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Package size={24} color="#9c6649" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Easy Returns</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>30-day guarantee</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Customer Reviews Section */}
        <Suspense fallback={<div style={{ padding: 24 }}>Loading reviews…</div>}>
          <ProductReviews 
            productId={product.id} 
            productName={product.name}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default ProductDetailPage;

