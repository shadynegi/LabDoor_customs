// ProductsPage - Main listing page with infinite scroll pagination, search, and filters
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePaginatedProducts } from '../hooks/usePaginatedProducts';
import { useProductSearch } from '../hooks/useProductSearch';
import StarRating from '../components/StarRating';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import ProductFilters from '../components/ProductFilters';
import { ProductGridSkeleton, SkeletonStyles } from '../components/Skeletons';
import { optimizeImageUrl } from '../utils/imageUrl';

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const { products, loading, error, hasMore, loadMore, refetch } = usePaginatedProducts(10);
  const { 
    searchQuery, 
    setSearchQuery, 
    results: searchResults, 
    loading: searchLoading, 
    isSearching,
    isFiltering,
    clearSearch,
    clearAll,
    filters,
    updateFilter,
    clearFilters,
    filterOptions,
    activeFilterCount,
  } = useProductSearch(300);
  const [isMobile, setIsMobile] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Determine which products to display - search/filter results or all products
  const isUsingSearchOrFilters = isSearching || isFiltering;
  const displayProducts = isUsingSearchOrFilters ? searchResults : products;
  const isLoadingProducts = isUsingSearchOrFilters ? searchLoading : loading;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current);
      }
    };
  }, [hasMore, loading, loadMore]);

  // Initial loading state (only for paginated products, not search/filter)
  if (loading && products.length === 0 && !isUsingSearchOrFilters) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        padding: isMobile ? '20px' : '40px 60px',
      }}>
        <SkeletonStyles />
        {/* Header Skeleton */}
        <div style={{ 
          maxWidth: 1400, 
          margin: '0 auto 40px',
          textAlign: 'center'
        }}>
          <div style={{
            width: isMobile ? 200 : 300,
            height: isMobile ? 40 : 56,
            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            borderRadius: 12,
            margin: '0 auto 16px',
          }} />
          <div style={{
            width: isMobile ? 250 : 400,
            height: 20,
            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            borderRadius: 8,
            margin: '0 auto',
          }} />
        </div>
        
        {/* Search Bar Skeleton */}
        <div style={{
          maxWidth: 600,
          margin: '0 auto 32px',
          padding: '0 20px',
        }}>
          <div style={{
            height: 52,
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          }} />
        </div>
        
        {/* Products Grid Skeleton */}
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <ProductGridSkeleton count={isMobile ? 4 : 8} isMobile={isMobile} />
        </div>
        
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  }

  // Error state (only for paginated products, not search/filter)
  if (error && products.length === 0 && !isUsingSearchOrFilters) {
    return (
      <div style={{ 
        minHeight: '80vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 20
      }}>
        <ErrorMessage message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      padding: isMobile ? '20px' : '40px 60px',
    }}>
      {/* Page Header */}
      <div style={{ 
        maxWidth: 1400, 
        margin: '0 auto 40px',
        textAlign: 'center'
      }}>
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: isMobile ? 32 : 48,
            fontWeight: 900,
            color: '#1f2937',
            marginBottom: 12,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          All Products
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            fontSize: isMobile ? 14 : 16,
            color: '#6b7280',
            maxWidth: 600,
            margin: '0 auto',
          }}
        >
          Discover our complete collection of premium footwear
        </motion.p>
      </div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{
          maxWidth: 600,
          margin: '0 auto 32px',
          padding: '0 20px',
        }}
      >
        <div style={{
          position: 'relative',
          width: '100%',
        }}>
          {/* Search Icon */}
          <div style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            color: isSearchFocused ? '#667eea' : '#9ca3af',
            transition: 'color 0.2s ease',
            pointerEvents: 'none',
          }}>
            <svg 
              width={20} 
              height={20} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth={2} 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>

          {/* Search Input */}
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search products..."
            style={{
              width: '100%',
              padding: '14px 48px 14px 48px',
              fontSize: isMobile ? 14 : 16,
              border: `2px solid ${isSearchFocused ? '#667eea' : '#e5e7eb'}`,
              borderRadius: 12,
              outline: 'none',
              background: 'white',
              color: '#1f2937',
              transition: 'all 0.2s ease',
              boxShadow: isSearchFocused 
                ? '0 4px 12px rgba(102, 126, 234, 0.15)' 
                : '0 2px 4px rgba(0, 0, 0, 0.05)',
            }}
          />

          {/* Clear Button */}
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={clearSearch}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#6b7280',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e5e7eb';
                  e.currentTarget.style.color = '#1f2937';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                <svg 
                  width={14} 
                  height={14} 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth={2.5} 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Loading Indicator */}
          <AnimatePresence>
            {searchLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  right: searchQuery ? 48 : 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                <div style={{
                  width: 20,
                  height: 20,
                  border: '2px solid #e5e7eb',
                  borderTop: '2px solid #667eea',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search Results Count */}
        <AnimatePresence>
          {isSearching && !searchLoading && !isFiltering && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              style={{
                marginTop: 12,
                fontSize: 14,
                color: '#6b7280',
                textAlign: 'center',
              }}
            >
              {searchResults.length === 0 
                ? `No products found for "${searchQuery}"` 
                : `Found ${searchResults.length} product${searchResults.length !== 1 ? 's' : ''} for "${searchQuery}"`
              }
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* CSS Animation for Loading Spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Advanced Filters */}
      <ProductFilters
        filters={filters}
        filterOptions={filterOptions}
        onFilterChange={updateFilter}
        onClearFilters={clearFilters}
        activeFilterCount={activeFilterCount}
        isMobile={isMobile}
      />

      {/* Results Summary - shown when searching or filtering */}
      <AnimatePresence>
        {isUsingSearchOrFilters && !searchLoading && searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              maxWidth: 1400,
              margin: '0 auto 20px',
              padding: '0 20px',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <p style={{
                fontSize: 14,
                color: '#6b7280',
              }}>
                Showing <strong style={{ color: '#374151' }}>{searchResults.length}</strong> product{searchResults.length !== 1 ? 's' : ''}
                {isSearching && ` for "${searchQuery}"`}
                {activeFilterCount > 0 && ` with ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} applied`}
              </p>
              <button
                onClick={clearAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#667eea',
                  background: 'transparent',
                  border: '1px solid #667eea',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <svg 
                  width={14} 
                  height={14} 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth={2} 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
                Clear All
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Products Grid */}
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile 
            ? 'repeat(auto-fill, minmax(150px, 1fr))' 
            : 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: isMobile ? 16 : 24,
          marginBottom: 40,
        }}>
          {displayProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(`/product/${product.id}`)}
              style={{
                background: 'white',
                borderRadius: 16,
                overflow: 'hidden',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
              }}
              whileHover={{ 
                y: -8,
                boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
              }}
            >
              {/* Product Image */}
              <div style={{
                position: 'relative',
                paddingTop: '100%',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }}>
                <img
                  src={optimizeImageUrl(product.image, { width: 480 })}
                  alt={product.name}
                  width={480}
                  height={480}
                  loading="lazy"
                  decoding="async"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                />
              </div>

              {/* Product Info */}
              <div style={{ padding: isMobile ? 12 : 16 }}>
                <h3 style={{
                  fontSize: isMobile ? 14 : 16,
                  fontWeight: 700,
                  color: '#1f2937',
                  marginBottom: 8,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {product.name}
                </h3>

                {/* Rating */}
                <div style={{ marginBottom: 8 }}>
                  <StarRating 
                    rating={product.rating || 0} 
                    reviewCount={product.review_count || 0}
                    size={isMobile ? 12 : 14}
                  />
                </div>

                {/* Price */}
                <div style={{
                  fontSize: isMobile ? 18 : 22,
                  fontWeight: 800,
                  color: '#667eea',
                  marginBottom: 8,
                }}>
                  ${product.price}
                </div>

                {/* Description */}
                {product.description && (
                  <p style={{
                    fontSize: isMobile ? 11 : 13,
                    color: '#6b7280',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {product.description}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Loading more indicator - only show for paginated products, not search/filter */}
        {!isUsingSearchOrFilters && (
          <div ref={observerRef} style={{ 
            minHeight: 100, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: 20,
          }}>
            {loading && (
              <LoadingSpinner message="Loading more products..." />
            )}
            {!loading && !hasMore && products.length > 0 && (
              <p style={{ color: '#6b7280', fontSize: 14 }}>
                You've reached the end!
              </p>
            )}
          </div>
        )}

        {/* Empty state for search/filter with no results */}
        {isUsingSearchOrFilters && !searchLoading && searchResults.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 60,
            textAlign: 'center',
          }}>
            <div style={{
              width: 80,
              height: 80,
              marginBottom: 24,
              color: '#9ca3af',
            }}>
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth={1.5} 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
                <path d="M8 8h6" />
              </svg>
            </div>
            <h3 style={{
              fontSize: 20,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 8,
            }}>
              No products found
            </h3>
            <p style={{
              fontSize: 14,
              color: '#6b7280',
              maxWidth: 300,
            }}>
              {isSearching && isFiltering 
                ? 'Try adjusting your search terms or filters'
                : isSearching 
                  ? 'Try adjusting your search terms'
                  : 'Try adjusting your filters'
              }
            </p>
            <button
              onClick={clearAll}
              style={{
                marginTop: 20,
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;

