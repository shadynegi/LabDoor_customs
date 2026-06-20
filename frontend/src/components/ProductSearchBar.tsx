import { useState, useRef, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product } from '../hooks/useProducts';
import { buildResponsiveProductImg, PRODUCT_IMAGE_SIZES } from '../lib/responsiveImage';

export type ProductSearchBarVariant = 'light' | 'hero';

export interface ProductSearchBarProps {
  variant?: ProductSearchBarVariant;
  isMobile?: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  suggestions: Product[];
  loading?: boolean;
  clearSearch: () => void;
  placeholder?: string;
  /** Called when user presses Enter or chooses "View all results". Default: /products?q= */
  onSubmitSearch?: (query: string) => void;
  onSelectProduct?: (product: Product) => void;
  onCatalogNeeded?: () => void;
}

export default function ProductSearchBar({
  variant = 'light',
  isMobile = false,
  searchQuery,
  setSearchQuery,
  suggestions,
  loading = false,
  clearSearch,
  placeholder = 'Search products...',
  onSubmitSearch,
  onSelectProduct,
  onCatalogNeeded,
}: ProductSearchBarProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const isHero = variant === 'hero';

  const goToProducts = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (onSubmitSearch) {
      onSubmitSearch(trimmed);
    } else {
      navigate(`/products?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const selectProduct = (product: Product) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    } else {
      navigate(`/product/${product.id}`);
    }
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goToProducts(searchQuery);
      setShowSuggestions(false);
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const borderColor = isFocused
    ? isHero
      ? 'rgba(255,255,255,0.9)'
      : '#9c6649'
    : isHero
      ? 'rgba(255,255,255,0.35)'
      : '#e5e7eb';

  const inputBg = isHero ? 'rgba(255,255,255,0.12)' : 'white';
  const inputColor = isHero ? '#ffffff' : '#1f2937';
  const iconColor = isFocused
    ? isHero
      ? 'rgba(255,255,255,0.95)'
      : '#9c6649'
    : isHero
      ? 'rgba(255,255,255,0.65)'
      : '#9ca3af';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          color: iconColor,
          transition: 'color 0.2s ease',
          pointerEvents: 'none',
        }}
      >
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

      <input
        ref={inputRef}
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => {
          onCatalogNeeded?.();
          setIsFocused(true);
          setShowSuggestions(true);
        }}
        onBlur={() => {
          setIsFocused(false);
          window.setTimeout(() => setShowSuggestions(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Search products"
        aria-expanded={showSuggestions && suggestions.length > 0}
        aria-autocomplete="list"
        style={{
          width: '100%',
          padding: '14px 48px 14px 48px',
          fontSize: isMobile ? 14 : 16,
          border: `2px solid ${borderColor}`,
          borderRadius: 12,
          outline: 'none',
          background: inputBg,
          color: inputColor,
          backdropFilter: isHero ? 'blur(8px)' : undefined,
          transition: 'all 0.2s ease',
          boxShadow: isFocused
            ? isHero
              ? '0 4px 20px rgba(0,0,0,0.25)'
              : '0 4px 12px rgba(156, 102, 73, 0.15)'
            : isHero
              ? '0 2px 8px rgba(0,0,0,0.15)'
              : '0 2px 4px rgba(0, 0, 0, 0.05)',
        }}
      />

      <AnimatePresence>
        {searchQuery && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={clearSearch}
            aria-label="Clear search"
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: isHero ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
              border: 'none',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isHero ? 'rgba(255,255,255,0.9)' : '#6b7280',
            }}
          >
            ×
          </motion.button>
        )}
      </AnimatePresence>

      {loading && (
        <div
          style={{
            position: 'absolute',
            right: searchQuery ? 48 : 16,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 12,
            color: isHero ? 'rgba(255,255,255,0.7)' : '#9ca3af',
          }}
        >
          …
        </div>
      )}

      <AnimatePresence>
        {showSuggestions && isFocused && searchQuery.trim() && suggestions.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="listbox"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: 'white',
              borderRadius: 12,
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              border: '1px solid #e5e7eb',
              listStyle: 'none',
              margin: 0,
              padding: 8,
              zIndex: 50,
              maxHeight: 360,
              overflowY: 'auto',
            }}
          >
            {suggestions.map((product) => {
              const outOfStock = Boolean(product.is_out_of_stock || product.stock === 0);
              return (
              <li key={product.id} role="option">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectProduct(product)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    opacity: outOfStock ? 0.65 : 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {product.image && (
                    <img
                      {...buildResponsiveProductImg(product.image, {
                        alt: '',
                        sizes: PRODUCT_IMAGE_SIZES.thumb,
                        width: 40,
                        height: 40,
                      })}
                      style={{ borderRadius: 8, objectFit: 'cover' }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: '#1f2937',
                        fontSize: 14,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {product.name}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      ${Number(product.price).toFixed(2)}
                      {product.category ? ` · ${product.category}` : ''}
                      {outOfStock ? ' · Out of Stock' : ''}
                    </div>
                  </div>
                </button>
              </li>
            );
            })}
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goToProducts(searchQuery)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  background: '#f9fafb',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#9c6649',
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                View all results for &quot;{searchQuery.trim()}&quot;
              </button>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
