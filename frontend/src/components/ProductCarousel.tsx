// ProductCarousel component for displaying scrolling product images
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../hooks/useProducts';
import { optimizeImageUrl } from '../utils/imageUrl';

interface ProductCarouselProps {
  products: Product[];
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({ products }) => {
  const navigate = useNavigate();
  const [duplicatedProducts, setDuplicatedProducts] = useState<Product[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Duplicate products array 3 times for seamless infinite scroll
    if (products.length > 0) {
      setDuplicatedProducts([...products, ...products, ...products]);
    }
  }, [products]);

  if (products.length === 0) return null;

  const cardWidth = isMobile ? 180 : 230;
  const cardHeight = isMobile ? 140 : 180;

  return (
    <div style={{
      width: '100%',
      overflow: 'hidden',
      position: 'relative',
      padding: isMobile ? '24px 0' : '40px 0',
      background: 'rgba(0,0,0,0.3)',
      backdropFilter: 'blur(10px)',
    }}>
      {/* View All Products Button */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
      }}>
        <motion.button
          onClick={() => navigate('/products')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
            color: 'white',
            border: 'none',
            padding: isMobile ? '12px 20px' : '16px 32px',
            borderRadius: 12,
            fontSize: isMobile ? 14 : 18,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(102,126,234,0.5)',
            letterSpacing: '0.5px',
            minHeight: 48, // Touch-friendly
          }}
        >
          View All Products
        </motion.button>
      </div>

      {/* Scrolling carousel */}
      <motion.div
        animate={{
          x: [0, -(duplicatedProducts.length / 3) * (cardWidth + 16)]
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: isMobile ? 15 : 20,
            ease: "linear"
          }
        }}
        style={{
          display: 'flex',
          gap: isMobile ? 12 : 20,
          paddingLeft: isMobile ? 12 : 20,
        }}
      >
        {duplicatedProducts.map((product, index) => (
          <div
            key={`${product.id}-${index}`}
            style={{
              minWidth: cardWidth,
              height: cardHeight,
              borderRadius: isMobile ? 12 : 16,
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              opacity: 0.6,
              filter: 'blur(1px)',
              transition: 'all 0.3s ease',
            }}
          >
            <img
              src={optimizeImageUrl(product.image, { width: 320 })}
              alt={product.name}
              width={320}
              height={320}
              loading="lazy"
              decoding="async"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              draggable={false}
            />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
              padding: '12px',
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
            }}>
              {product.name}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default ProductCarousel;

