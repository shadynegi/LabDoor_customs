// ProductFilters - Advanced filter panel for products
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SearchFilters, FilterOptions, SortOption } from '../types/productSearch';
import { useResponsive } from '../hooks/useResponsive';

const COMPACT_SORT_LABELS: Record<string, string> = {
  Default: 'Default',
  'Price: Low to High': 'Lowest price',
  'Price: High to Low': 'Highest price',
  'Newest First': 'Newest',
  'Oldest First': 'Oldest',
};

function sortOptionLabel(label: string, compact: boolean): string {
  if (!compact) return label;
  return COMPACT_SORT_LABELS[label] ?? label;
}

interface ProductFiltersProps {
  filters: SearchFilters;
  filterOptions: FilterOptions | null;
  onFilterChange: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  isMobile?: boolean;
  onPanelOpen?: () => void;
}

const ProductFilters: React.FC<ProductFiltersProps> = ({
  filters,
  filterOptions,
  onFilterChange,
  onClearFilters,
  activeFilterCount,
  isMobile = false,
  onPanelOpen,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isSmallMobile } = useResponsive();
  const compactSortLabels = isMobile && isSmallMobile;

  // Price range state for slider
  const priceMin = filterOptions?.priceRange.min || 0;
  const priceMax = filterOptions?.priceRange.max || 500;

  return (
    <div className="product-filters">
      {/* Filter Toggle Button & Sort Dropdown Row */}
      <div
        className="product-filters__toolbar"
        style={{ marginBottom: isExpanded ? 16 : 0 }}
      >
        {/* Filter Toggle Button - Touch-friendly */}
        <button
          type="button"
          className="product-filters__filters-btn"
          onClick={() => {
            if (!isExpanded) onPanelOpen?.();
            setIsExpanded(!isExpanded);
          }}
          style={{
            background: isExpanded ? 'linear-gradient(135deg, #361906 0%, #9c6649 100%)' : 'white',
            color: isExpanded ? 'white' : '#374151',
            border: isExpanded ? 'none' : '2px solid #e5e7eb',
          }}
        >
          {/* Filter Icon */}
          <svg 
            width={18} 
            height={18} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={2} 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span style={{
              background: isExpanded ? 'white' : 'linear-gradient(135deg, #361906 0%, #9c6649 100%)',
              color: isExpanded ? '#9c6649' : 'white',
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 700,
            }}>
              {activeFilterCount}
            </span>
          )}
          {/* Chevron */}
          <motion.svg 
            width={16} 
            height={16} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={2.5}
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path d="m6 9 6 6 6-6" />
          </motion.svg>
        </button>

        {/* Sort Dropdown - responsive via responsive.css */}
        <div className="product-filters__sort">
          <label className="product-filters__sort-label" htmlFor="product-sort-by">
            Sort by:
          </label>
          <select
            id="product-sort-by"
            name="sortBy"
            className="product-filters__sort-select"
            value={filters.sortBy || 'default'}
            onChange={(e) => onFilterChange('sortBy', e.target.value as SortOption)}
            aria-label="Sort products"
          >
            {filterOptions?.sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {sortOptionLabel(option.label, compactSortLabels)}
              </option>
            )) || (
              <>
                <option value="default">Default</option>
                <option value="price_asc">
                  {sortOptionLabel('Price: Low to High', compactSortLabels)}
                </option>
                <option value="price_desc">
                  {sortOptionLabel('Price: High to Low', compactSortLabels)}
                </option>
                <option value="newest">
                  {sortOptionLabel('Newest First', compactSortLabels)}
                </option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Expanded Filter Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: isMobile ? 16 : 24,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: isMobile ? 20 : 32,
              }}>
                {/* Price Range Filter */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Price Range
                  </label>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af',
                        fontSize: 14,
                      }}>$</span>
                      <input
                        id="filter-min-price"
                        name="minPrice"
                        type="number"
                        aria-label="Minimum price"
                        placeholder={`${priceMin}`}
                        value={filters.minPrice ?? ''}
                        onChange={(e) => onFilterChange('minPrice', e.target.value ? Number(e.target.value) : undefined)}
                        min={priceMin}
                        max={filters.maxPrice || priceMax}
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 28px',
                          fontSize: 14,
                          border: '2px solid #e5e7eb',
                          borderRadius: 8,
                          outline: 'none',
                          transition: 'border-color 0.2s ease',
                        }}
                      />
                    </div>
                    <span style={{ color: '#9ca3af' }}>-</span>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af',
                        fontSize: 14,
                      }}>$</span>
                      <input
                        id="filter-max-price"
                        name="maxPrice"
                        type="number"
                        aria-label="Maximum price"
                        placeholder={`${priceMax}`}
                        value={filters.maxPrice ?? ''}
                        onChange={(e) => onFilterChange('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
                        min={filters.minPrice || priceMin}
                        max={priceMax}
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 28px',
                          fontSize: 14,
                          border: '2px solid #e5e7eb',
                          borderRadius: 8,
                          outline: 'none',
                          transition: 'border-color 0.2s ease',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Clear Filters Button */}
              {activeFilterCount > 0 && (
                <div style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}>
                  <button
                    onClick={onClearFilters}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#ef4444',
                      background: '#fef2f2',
                      border: 'none',
                      borderRadius: 8,
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
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductFilters;
