// ProductsPage - Main listing page with infinite scroll pagination and filters
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePaginatedProducts } from '../hooks/usePaginatedProducts';
import { useProductSearch } from '../hooks/useProductSearch';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import ProductFilters from '../components/ProductFilters';
import { ProductGridSkeleton, SkeletonStyles } from '../components/Skeletons';
import { buildResponsiveProductImg, PRODUCT_IMAGE_SIZES } from '../lib/responsiveImage';
import { resolveProductBackgroundForViewport } from '../lib/productImageMaps';
import MetaTags from '../components/MetaTags';
import { getProductDetailPath } from '../lib/productPaths';
import { useResponsive } from '../hooks/useResponsive';

const ProductsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { products, loading, error, hasMore, loadMore, refetch } = usePaginatedProducts(10);
  const { 
    searchQuery, 
    setSearchQuery, 
    results: searchResults,
    loading: searchLoading, 
    isSearching,
    isFiltering,
    clearAll,
    filters,
    updateFilter,
    clearFilters,
    filterOptions,
    activeFilterCount,
    ensureCatalogLoaded,
    ensureFilterOptionsLoaded,
    error: searchError,
  } = useProductSearch(300);
  const { isMobile } = useResponsive();
  const observerRef = useRef<HTMLDivElement>(null);
  const initialQueryApplied = useRef(false);

  useEffect(() => {
    if (initialQueryApplied.current) return;
    const q = searchParams.get('q')?.trim();
    if (q) {
      setSearchQuery(q);
      void ensureCatalogLoaded();
      initialQueryApplied.current = true;
    }
  }, [searchParams, setSearchQuery, ensureCatalogLoaded]);

  // Determine which products to display - search/filter results or all products
  const isUsingSearchOrFilters = isSearching || isFiltering;
  const displayProducts = isUsingSearchOrFilters ? searchResults : products;

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !isUsingSearchOrFilters) {
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
  }, [hasMore, loading, loadMore, isUsingSearchOrFilters]);

  // Initial loading state (only for paginated products, not search/filter)
  if (loading && products.length === 0 && !isUsingSearchOrFilters) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
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
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #f5e0d5 0%, #9c6649 55%, #361906 100%)',
      padding: isMobile ? '20px' : '40px 60px',
    }}>
      <MetaTags
        title="Shop Custom Shoes — Lab Door Customs"
        description="Browse our collection of premium custom footwear. Filter by color and price."
        path="/products"
      />
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
            background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
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

      {searchError && (
        <div style={{ maxWidth: 600, margin: '0 auto 24px', padding: '0 20px' }}>
          <ErrorMessage
            message={searchError}
            onRetry={() => { void ensureCatalogLoaded(); }}
          />
        </div>
      )}

      {/* Advanced Filters */}
      <ProductFilters
        filters={filters}
        filterOptions={filterOptions}
        onPanelOpen={() => { void ensureFilterOptionsLoaded(); void ensureCatalogLoaded(); }}
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
                  color: '#9c6649',
                  background: 'transparent',
                  border: '1px solid #9c6649',
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
        <div className="responsive-product-grid" style={{ marginBottom: 40 }}>
          {displayProducts.map((product, index) => {
            const cardBackgroundUrl = product.background
              ? resolveProductBackgroundForViewport(product.background, isMobile ? 1280 : 1920)
              : undefined;

            return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(getProductDetailPath(product))}
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
                aspectRatio: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? 10 : 14,
                overflow: 'hidden',
                background: cardBackgroundUrl
                  ? undefined
                  : 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
                backgroundImage: cardBackgroundUrl
                  ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${cardBackgroundUrl})`
                  : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}>
                {(product.is_out_of_stock || product.stock === 0) && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      zIndex: 2,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'rgba(239, 68, 68, 0.95)',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Out of Stock
                  </span>
                )}
                <img
                  {...buildResponsiveProductImg(product.image, {
                    alt: product.name,
                    sizes: PRODUCT_IMAGE_SIZES.grid,
                    width: 480,
                    height: 480,
                  })}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))',
                    transition: 'transform 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                />
              </div>

              {/* Product Info */}
              <div style={{ padding: isMobile ? 12 : 16 }}>
                <h3
                  className={isMobile ? 'product-card__title' : undefined}
                  style={{
                  fontSize: isMobile ? 14 : 16,
                  fontWeight: 700,
                  color: '#1f2937',
                  marginBottom: 8,
                  ...(isMobile
                    ? {}
                    : {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }),
                }}>
                  {product.name}
                </h3>

                {/* Price */}
                <div style={{
                  fontSize: isMobile ? 18 : 22,
                  fontWeight: 800,
                  color: '#9c6649',
                }}>
                  ${product.price}
                </div>
              </div>
            </motion.div>
            );
          })}
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
                background: 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
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
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(156, 102, 73, 0.4)';
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

