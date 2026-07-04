// Skeletons.tsx - Loading skeleton components for better UX
import React from 'react';
import { motion } from 'framer-motion';

// Base skeleton with shimmer animation
const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

// CSS keyframes for shimmer effect
export const SkeletonStyles = () => (
  <style>{`
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `}</style>
);

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
  className?: string;
}

// Base Skeleton Element
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
  className,
}) => (
  <div
    className={className}
    style={{
      width,
      height,
      borderRadius,
      ...shimmerStyle,
      ...style,
    }}
  />
);

// ============================================
// PRODUCT CARD SKELETON
// ============================================
interface ProductCardSkeletonProps {
  isMobile?: boolean;
}

export const ProductCardSkeleton: React.FC<ProductCardSkeletonProps> = ({ isMobile = false }) => (
  <div
    style={{
      background: 'white',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}
  >
    {/* Image Skeleton */}
    <div style={{ position: 'relative', paddingTop: '100%' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          ...shimmerStyle,
        }}
      />
    </div>

    {/* Content Skeleton */}
    <div style={{ padding: isMobile ? 12 : 16 }}>
      {/* Title */}
      <Skeleton height={isMobile ? 16 : 20} width="85%" style={{ marginBottom: 12 }} />
      
      {/* Rating */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} width={isMobile ? 12 : 16} height={isMobile ? 12 : 16} borderRadius="50%" />
        ))}
        <Skeleton width={40} height={14} style={{ marginLeft: 8 }} />
      </div>
      
      {/* Price */}
      <Skeleton height={isMobile ? 22 : 28} width="40%" style={{ marginBottom: 8 }} />
      
      {/* Description */}
      <Skeleton height={14} width="90%" />
    </div>
  </div>
);

// Product Grid Skeleton (multiple cards)
interface ProductGridSkeletonProps {
  count?: number;
  isMobile?: boolean;
}

export const ProductGridSkeleton: React.FC<ProductGridSkeletonProps> = ({
  count = 8,
  isMobile = false,
}) => (
  <>
    <SkeletonStyles />
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile
          ? 'repeat(auto-fill, minmax(150px, 1fr))'
          : 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: isMobile ? 16 : 24,
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <ProductCardSkeleton isMobile={isMobile} />
        </motion.div>
      ))}
    </div>
  </>
);

// ============================================
// PRODUCT DETAIL SKELETON
// ============================================
interface ProductDetailSkeletonProps {
  isMobile?: boolean;
}

export const ProductDetailSkeleton: React.FC<ProductDetailSkeletonProps> = ({ isMobile = false }) => (
  <div style={{
    minHeight: '100dvh',
    background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
  }}>
    <SkeletonStyles />
    
    {/* Back Button Skeleton */}
    <div style={{ 
      padding: isMobile ? '16px 20px' : '24px 60px',
      maxWidth: 1400,
      margin: '0 auto',
    }}>
      <Skeleton width={80} height={44} borderRadius={10} />
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
        {/* Image Skeleton */}
        <div style={{
          borderRadius: 20,
          overflow: 'hidden',
          minHeight: isMobile ? 300 : 500,
          ...shimmerStyle,
        }} />

        {/* Info Skeleton */}
        <div>
          {/* Category Badge */}
          <Skeleton width={80} height={28} borderRadius={8} style={{ marginBottom: 16 }} />
          
          {/* Title */}
          <Skeleton height={isMobile ? 32 : 48} width="90%" style={{ marginBottom: 8 }} />
          <Skeleton height={isMobile ? 32 : 48} width="60%" style={{ marginBottom: 24 }} />
          
          {/* Rating */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width={20} height={20} borderRadius="50%" />
            ))}
            <Skeleton width={80} height={18} style={{ marginLeft: 12 }} />
          </div>
          
          {/* Price */}
          <Skeleton height={isMobile ? 36 : 52} width="35%" style={{ marginBottom: 24 }} />
          
          {/* Description */}
          <Skeleton height={16} width="100%" style={{ marginBottom: 8 }} />
          <Skeleton height={16} width="95%" style={{ marginBottom: 8 }} />
          <Skeleton height={16} width="80%" style={{ marginBottom: 32 }} />
          
          {/* Size Selection Label */}
          <Skeleton width={100} height={18} style={{ marginBottom: 12 }} />
          
          {/* Size System Selector */}
          <div style={{
            display: 'flex',
            gap: 8,
            background: '#f3f4f6',
            padding: 4,
            borderRadius: 10,
            marginBottom: 16,
          }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={40} borderRadius={8} style={{ flex: 1 }} />
            ))}
          </div>
          
          {/* Size Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
            gap: 8,
            marginBottom: 24,
          }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} height={44} borderRadius={8} />
            ))}
          </div>
          
          {/* Add to Cart Button */}
          <Skeleton height={56} borderRadius={12} style={{ marginBottom: 32 }} />
          
          {/* Features */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: 16,
            paddingTop: 32,
            borderTop: '1px solid #e5e7eb',
          }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <Skeleton width={24} height={24} borderRadius="50%" style={{ margin: '0 auto 8px' }} />
                <Skeleton width={80} height={14} style={{ margin: '0 auto 4px' }} />
                <Skeleton width={100} height={12} style={{ margin: '0 auto' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// ORDER CARD SKELETON
// ============================================
interface OrderCardSkeletonProps {
  isMobile?: boolean;
}

export const OrderCardSkeleton: React.FC<OrderCardSkeletonProps> = ({ isMobile = false }) => (
  <div
    style={{
      background: 'white',
      borderRadius: 16,
      padding: isMobile ? 20 : 24,
      marginBottom: 16,
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    }}
  >
    {/* Header */}
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
      flexWrap: 'wrap',
      gap: 12,
    }}>
      <div>
        <Skeleton width={120} height={14} style={{ marginBottom: 8 }} />
        <Skeleton width={100} height={28} style={{ marginBottom: 8 }} />
        <Skeleton width={140} height={16} />
      </div>
      <Skeleton width={110} height={40} borderRadius={24} />
    </div>

    {/* Timeline Skeleton */}
    <div style={{
      background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 100%)',
      borderRadius: 12,
      padding: isMobile ? 16 : 24,
      marginBottom: 16,
    }}>
      <Skeleton width={120} height={16} style={{ marginBottom: 16 }} />
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 16 : 0,
        justifyContent: 'space-between',
      }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: isMobile ? 'row' : 'column',
            alignItems: 'center',
            gap: isMobile ? 12 : 8,
            flex: 1,
          }}>
            <Skeleton width={40} height={40} borderRadius="50%" />
            <div style={{ textAlign: isMobile ? 'left' : 'center' }}>
              <Skeleton width={70} height={14} style={{ marginBottom: 4 }} />
              <Skeleton width={90} height={12} />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Items Skeleton */}
    <div style={{ marginBottom: 12 }}>
      <Skeleton width={80} height={16} style={{ marginBottom: 12 }} />
      {[1, 2].map((i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: '1px solid #f3f4f6',
        }}>
          <Skeleton width="60%" height={16} />
          <Skeleton width={60} height={16} />
        </div>
      ))}
    </div>
  </div>
);

// Orders List Skeleton (multiple cards)
interface OrdersListSkeletonProps {
  count?: number;
  isMobile?: boolean;
}

export const OrdersListSkeleton: React.FC<OrdersListSkeletonProps> = ({
  count = 3,
  isMobile = false,
}) => (
  <>
    <SkeletonStyles />
    {Array.from({ length: count }).map((_, index) => (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <OrderCardSkeleton isMobile={isMobile} />
      </motion.div>
    ))}
  </>
);

// ============================================
// HOME PAGE SKELETON (Carousel)
// ============================================
interface HomePageSkeletonProps {
  isMobile?: boolean;
}

export const HomePageSkeleton: React.FC<HomePageSkeletonProps> = ({ isMobile = false }) => (
  <div style={{
    minHeight: '100dvh',
    background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  }}>
    <SkeletonStyles />
    
    {/* Logo Skeleton */}
    <div style={{
      width: isMobile ? 200 : 300,
      height: isMobile ? 60 : 80,
      background: 'rgba(255,255,255,0.2)',
      borderRadius: 16,
      marginBottom: 40,
      animation: 'pulse 2s infinite',
    }} />
    
    {/* Product Card Skeleton */}
    <div style={{
      width: isMobile ? '90%' : 400,
      background: 'rgba(255,255,255,0.15)',
      borderRadius: 24,
      padding: 24,
      backdropFilter: 'blur(10px)',
    }}>
      {/* Image Area */}
      <div style={{
        height: isMobile ? 250 : 350,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        marginBottom: 24,
        animation: 'pulse 2s infinite',
      }} />
      
      {/* Product Name */}
      <div style={{
        height: 28,
        background: 'rgba(255,255,255,0.2)',
        borderRadius: 8,
        marginBottom: 16,
        width: '80%',
        animation: 'pulse 2s infinite',
      }} />
      
      {/* Price */}
      <div style={{
        height: 36,
        background: 'rgba(255,255,255,0.3)',
        borderRadius: 8,
        marginBottom: 24,
        width: '40%',
        animation: 'pulse 2s infinite',
      }} />
      
      {/* Button */}
      <div style={{
        height: 50,
        background: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
        animation: 'pulse 2s infinite',
      }} />
    </div>
    
    {/* Navigation Dots Skeleton */}
    <div style={{
      display: 'flex',
      gap: 8,
      marginTop: 24,
    }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.3)',
            animation: 'pulse 2s infinite',
          }}
        />
      ))}
    </div>
  </div>
);

// ============================================
// ADMIN DASHBOARD SKELETON
// ============================================
interface DashboardSkeletonProps {
  isMobile?: boolean;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({ isMobile = false }) => (
  <div style={{
    minHeight: '100dvh',
    background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
    padding: isMobile ? 16 : 32,
  }}>
    <SkeletonStyles />
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <Skeleton width={200} height={40} borderRadius={8} />
        <div style={{ display: 'flex', gap: 12 }}>
          <Skeleton width={100} height={40} borderRadius={8} />
          <Skeleton width={100} height={40} borderRadius={8} />
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 32,
      }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            background: 'white',
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <Skeleton width={40} height={40} borderRadius={10} />
              <Skeleton width={60} height={24} borderRadius={4} />
            </div>
            <Skeleton width={80} height={32} style={{ marginBottom: 8 }} />
            <Skeleton width={100} height={14} />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
        overflowX: 'auto',
      }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} width={100} height={40} borderRadius={8} />
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
          gap: 16,
          paddingBottom: 16,
          borderBottom: '1px solid #e5e7eb',
          marginBottom: 16,
        }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={16} />
          ))}
        </div>
        
        {/* Table Rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            gap: 16,
            padding: '16px 0',
            borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none',
          }}>
            {[1, 2, 3, 4, 5].map((j) => (
              <Skeleton key={j} height={20} />
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ============================================
// CART PAGE SKELETON
// ============================================
interface CartSkeletonProps {
  isMobile?: boolean;
}

export const CartSkeleton: React.FC<CartSkeletonProps> = ({ isMobile = false }) => (
  <div style={{
    minHeight: '100dvh',
    background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
    padding: isMobile ? 20 : 40,
  }}>
    <SkeletonStyles />
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <Skeleton width={200} height={36} style={{ marginBottom: 32 }} />
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 350px',
        gap: 32,
      }}>
        {/* Cart Items */}
        <div>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              background: 'white',
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              display: 'flex',
              gap: 16,
            }}>
              <Skeleton width={100} height={100} borderRadius={12} />
              <div style={{ flex: 1 }}>
                <Skeleton width="70%" height={20} style={{ marginBottom: 8 }} />
                <Skeleton width={60} height={16} style={{ marginBottom: 12 }} />
                <Skeleton width={80} height={24} />
              </div>
              <Skeleton width={32} height={32} borderRadius="50%" />
            </div>
          ))}
        </div>
        
        {/* Summary */}
        <div style={{
          background: 'white',
          borderRadius: 16,
          padding: 24,
          height: 'fit-content',
        }}>
          <Skeleton width={120} height={24} style={{ marginBottom: 24 }} />
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <Skeleton width={80} height={16} />
              <Skeleton width={60} height={16} />
            </div>
          ))}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <Skeleton width={60} height={20} />
              <Skeleton width={80} height={24} />
            </div>
            <Skeleton height={50} borderRadius={12} />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// DEFAULT EXPORT
// ============================================
export default {
  Skeleton,
  SkeletonStyles,
  ProductCardSkeleton,
  ProductGridSkeleton,
  ProductDetailSkeleton,
  OrderCardSkeleton,
  OrdersListSkeleton,
  HomePageSkeleton,
  DashboardSkeleton,
  CartSkeleton,
};
