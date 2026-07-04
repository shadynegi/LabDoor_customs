// ProductDetailPage - Individual product page with full details
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Package, Shield, Truck, Check, RotateCcw, Image, AlertTriangle } from 'lucide-react';
import { catalogFetch } from '../config';
import type { Product } from '../hooks/useProducts';
import { useCart, type SizeSystem } from './CartContext';
import ErrorMessage from '../components/ErrorMessage';
import { generatePlaceholder360Images } from '../utils/product360Images';
import { resolveProductImage } from '../lib/productImageMaps';
import { buildResponsiveProductImg, PRODUCT_IMAGE_SIZES } from '../lib/responsiveImage';
import MetaTags from '../components/MetaTags';
import ProductJsonLd from '../components/ProductJsonLd';
import { SHOE_SIZE_OPTIONS } from '../constants/shoeSizes';
import { logError } from '../lib/logger';
import { useResponsive } from '../hooks/useResponsive';
import MobileStickyCta from '../components/MobileStickyCta';
import { trackProductView, trackSizeSelect } from '../utils/activityTracker';
import { REPLACEMENT_POLICY_PATH } from '../constants/returnPolicy';
import { getProductDetailPath } from '../lib/productPaths';
import { normalizeProduct } from '../lib/productCatalogCache';
import { FREE_SHIPPING_MESSAGE } from '../utils/pricing';

const Product360Viewer = lazy(() =>
  import('../components/Product360Viewer').then((m) => ({ default: m.Product360Viewer }))
);
import { ProductDetailSkeleton } from '../components/Skeletons';

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
  const addedToCartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sizeOptions = SHOE_SIZE_OPTIONS;

  useEffect(() => {
    return () => {
      if (addedToCartTimerRef.current) {
        clearTimeout(addedToCartTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await catalogFetch(`/products/${id}`, { signal: controller.signal });
        
        if (!response.ok) {
          throw new Error('Failed to fetch product');
        }

        const data = await response.json();

        if (controller.signal.aborted) return;

        if (data.success && data.data) {
          setProduct(normalizeProduct(data.data));
          trackProductView(data.data.id, data.data.name);

          const canonicalPath = getProductDetailPath(data.data);
          if (id && canonicalPath !== `/product/${id}`) {
            navigate(canonicalPath, { replace: true });
          }
        } else {
          throw new Error('Product not found');
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        logError('Error fetching product:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to load product';
        setError(errorMsg);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchProduct();
    return () => controller.abort();
  }, [id, navigate]);

  const isOutOfStock = Boolean(product?.is_out_of_stock || product?.stock === 0);
  const sizeSelected = Boolean(selectedSize);
  const addToCartDisabled = isOutOfStock || !sizeSelected || addedToCart;

  const handleAddToCart = () => {
    if (!selectedSize) {
      setSizeError("Please select your size before adding to cart.");
      return;
    }

    if (!product) return;

    if (isOutOfStock) {
      setSizeError('This product is currently out of stock.');
      return;
    }

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
    if (addedToCartTimerRef.current) {
      clearTimeout(addedToCartTimerRef.current);
    }
    addedToCartTimerRef.current = setTimeout(() => setAddedToCart(false), 2000);
  };

  if (loading) {
    return <ProductDetailSkeleton isMobile={isMobile} />;
  }

  const video360Url = product?.video_360?.trim() || null;
  const has360Video = Boolean(video360Url);

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

  const productImage = product.image ? resolveProductImage(product.image) : undefined;
  const detailImgProps = product.image
    ? buildResponsiveProductImg(product.image, {
        alt: product.name,
        sizes: PRODUCT_IMAGE_SIZES.detail,
        loading: 'eager',
        fetchPriority: 'high',
        width: isMobile ? 320 : 480,
        height: isMobile ? 320 : 480,
      })
    : null;

  return (
    <div
      className={isMobile && !isOutOfStock ? 'has-mobile-sticky-cta' : undefined}
      style={{
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
    }}>
      <MetaTags
        title={`${product.name} — Lab Door Customs`}
        description={
          product.description ||
          `Shop ${product.name} — premium custom footwear from Lab Door Customs.`
        }
        path={getProductDetailPath(product)}
        image={productImage}
        type="product"
      />
      <ProductJsonLd
        id={product.id}
        publicId={product.public_id}
        name={product.name}
        description={product.description}
        image={productImage}
        price={product.price}
        inStock={!isOutOfStock}
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
                  padding: '12px 16px',
                  minHeight: 44,
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
                  padding: '12px 16px',
                  minHeight: 44,
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
                {has360Video ? '360°' : 'Spin'}
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
                      videoUrl={video360Url ?? undefined}
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
                  {...(detailImgProps ?? { src: '', alt: product.name })}
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
                      if (product) {
                        trackSizeSelect(product.id, `${selectedSizeSystem} ${size}`);
                      }
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

            {/* Add to Cart — hidden on mobile when sticky CTA is shown */}
            {(!isMobile || isOutOfStock) && (
            <motion.button
              onClick={isOutOfStock || !sizeSelected ? undefined : handleAddToCart}
              disabled={addToCartDisabled}
              whileHover={addToCartDisabled ? undefined : { scale: 1.02 }}
              whileTap={addToCartDisabled ? undefined : { scale: 0.98 }}
              style={{
                width: '100%',
                padding: isMobile ? '16px' : '20px',
                background: isOutOfStock
                  ? '#fee2e2'
                  : !sizeSelected
                  ? '#e5e7eb'
                  : addedToCart
                  ? "linear-gradient(90deg, #10b981, #059669)"
                  : "linear-gradient(135deg, #361906 0%, #9c6649 100%)",
                color: isOutOfStock ? '#dc2626' : !sizeSelected ? '#9ca3af' : 'white',
                border: isOutOfStock ? '2px solid #fca5a5' : 'none',
                borderRadius: 12,
                fontSize: isMobile ? 16 : 18,
                fontWeight: 700,
                cursor: addToCartDisabled ? 'not-allowed' : 'pointer',
                opacity: isOutOfStock ? 0.9 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                marginBottom: 32,
                boxShadow: addToCartDisabled ? 'none' : '0 4px 12px rgba(102,126,234,0.4)',
              }}
            >
              {isOutOfStock ? (
                <>
                  <AlertTriangle size={20} />
                  Out of Stock
                </>
              ) : !sizeSelected ? (
                <>
                  <ShoppingCart size={20} />
                  Select a Size
                </>
              ) : addedToCart ? (
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
            )}

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
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{FREE_SHIPPING_MESSAGE}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Shield size={24} color="#9c6649" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Secure Payment</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>100% protected</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Package size={24} color="#9c6649" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>All Sales Final</div>
                <Link
                  to={REPLACEMENT_POLICY_PATH}
                  style={{ fontSize: 11, color: '#9c6649', textDecoration: 'underline' }}
                >
                  Manufacturing-defect replacements
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      {isMobile && !isOutOfStock && (
        <MobileStickyCta
          amount={`$${Number(product.price).toFixed(2)}`}
          label={addedToCart ? 'Added to Cart' : sizeSelected ? 'Add to Cart' : 'Select a Size'}
          onClick={handleAddToCart}
          disabled={!sizeSelected || addedToCart}
          hint={!sizeSelected ? 'Choose your size above to add this item' : undefined}
          ariaLabel="Product purchase actions"
        />
      )}
    </div>
  );
};

export default ProductDetailPage;

