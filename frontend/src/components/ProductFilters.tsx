// ProductFilters - Advanced filter panel for products
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SearchFilters, FilterOptions, SortOption } from '../hooks/useProductSearch';

interface ProductFiltersProps {
  filters: SearchFilters;
  filterOptions: FilterOptions | null;
  onFilterChange: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  isMobile?: boolean;
}

const ProductFilters: React.FC<ProductFiltersProps> = ({
  filters,
  filterOptions,
  onFilterChange,
  onClearFilters,
  activeFilterCount,
  isMobile = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Price range state for slider
  const priceMin = filterOptions?.priceRange.min || 0;
  const priceMax = filterOptions?.priceRange.max || 500;

  const ratingOptions = [
    { value: undefined, label: 'All Ratings' },
    { value: 4, label: '4+ Stars' },
    { value: 3, label: '3+ Stars' },
    { value: 2, label: '2+ Stars' },
    { value: 1, label: '1+ Star' },
  ];

  return (
    <div style={{
      maxWidth: 1400,
      margin: '0 auto 24px',
      padding: '0 20px',
    }}>
      {/* Filter Toggle Button & Sort Dropdown Row */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 12,
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        marginBottom: isExpanded ? 16 : 0,
      }}>
        {/* Filter Toggle Button - Touch-friendly */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: isMobile ? '12px 18px' : '10px 16px',
            minHeight: isMobile ? 48 : 44,
            background: isExpanded ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
            color: isExpanded ? 'white' : '#374151',
            border: isExpanded ? 'none' : '2px solid #e5e7eb',
            borderRadius: 10,
            fontSize: isMobile ? 15 : 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
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
              background: isExpanded ? 'white' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: isExpanded ? '#667eea' : 'white',
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

        {/* Sort Dropdown - Touch-friendly */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: isMobile ? '100%' : 'auto',
        }}>
          <span style={{ 
            fontSize: isMobile ? 15 : 14, 
            color: '#6b7280',
            whiteSpace: 'nowrap',
          }}>
            Sort by:
          </span>
          <select
            value={filters.sortBy || 'default'}
            onChange={(e) => onFilterChange('sortBy', e.target.value as SortOption)}
            style={{
              padding: isMobile ? '12px 40px 12px 16px' : '10px 36px 10px 14px',
              fontSize: isMobile ? 15 : 14,
              fontWeight: 500,
              color: '#374151',
              background: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: 10,
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              minWidth: isMobile ? 'auto' : 160,
              flex: isMobile ? 1 : 'none',
              minHeight: isMobile ? 48 : 44,
            }}
          >
            {filterOptions?.sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            )) || (
              <>
                <option value="default">Default</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating_desc">Highest Rated</option>
                <option value="newest">Newest First</option>
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
                {/* Category Filter */}
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
                    Category
                  </label>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: isMobile ? 10 : 8,
                  }}>
                    <button
                      onClick={() => onFilterChange('category', undefined)}
                      style={{
                        padding: isMobile ? '10px 16px' : '8px 14px',
                        minHeight: isMobile ? 44 : 36,
                        fontSize: isMobile ? 14 : 13,
                        fontWeight: 500,
                        border: 'none',
                        borderRadius: 20,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        background: !filters.category 
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                          : '#f3f4f6',
                        color: !filters.category ? 'white' : '#6b7280',
                      }}
                    >
                      All
                    </button>
                    {filterOptions?.categories.map(category => (
                      <button
                        key={category}
                        onClick={() => onFilterChange('category', category)}
                        style={{
                          padding: isMobile ? '10px 16px' : '8px 14px',
                          minHeight: isMobile ? 44 : 36,
                          fontSize: isMobile ? 14 : 13,
                          fontWeight: 500,
                          border: 'none',
                          borderRadius: 20,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          background: filters.category === category 
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                            : '#f3f4f6',
                          color: filters.category === category ? 'white' : '#6b7280',
                        }}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size Filter */}
                {filterOptions?.sizes && filterOptions.sizes.length > 0 && (
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
                      Size
                    </label>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}>
                      <button
                        onClick={() => onFilterChange('size', undefined)}
                        style={{
                          padding: '8px 14px',
                          fontSize: 13,
                          fontWeight: 500,
                          border: 'none',
                          borderRadius: 20,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          background: !filters.size 
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                            : '#f3f4f6',
                          color: !filters.size ? 'white' : '#6b7280',
                        }}
                      >
                        All
                      </button>
                      {filterOptions.sizes.map(size => (
                        <button
                          key={size}
                          onClick={() => onFilterChange('size', size)}
                          style={{
                            padding: '8px 14px',
                            fontSize: 13,
                            fontWeight: 500,
                            border: 'none',
                            borderRadius: 20,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: filters.size === size 
                              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                              : '#f3f4f6',
                            color: filters.size === size ? 'white' : '#6b7280',
                          }}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Color Filter */}
                {filterOptions?.colors && filterOptions.colors.length > 0 && (
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
                      Color
                    </label>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}>
                      <button
                        onClick={() => onFilterChange('color', undefined)}
                        style={{
                          padding: '8px 14px',
                          fontSize: 13,
                          fontWeight: 500,
                          border: 'none',
                          borderRadius: 20,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          background: !filters.color 
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                            : '#f3f4f6',
                          color: !filters.color ? 'white' : '#6b7280',
                        }}
                      >
                        All
                      </button>
                      {filterOptions.colors.map(color => (
                        <button
                          key={color}
                          onClick={() => onFilterChange('color', color)}
                          style={{
                            padding: '8px 14px',
                            fontSize: 13,
                            fontWeight: 500,
                            border: 'none',
                            borderRadius: 20,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: filters.color === color 
                              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                              : '#f3f4f6',
                            color: filters.color === color ? 'white' : '#6b7280',
                          }}
                        >
                          {/* Color swatch indicator */}
                          <span style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            backgroundColor: color.toLowerCase(),
                            border: '2px solid rgba(0,0,0,0.1)',
                            flexShrink: 0,
                          }} />
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                        type="number"
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
                        type="number"
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

                {/* Rating Filter */}
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
                    Minimum Rating
                  </label>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}>
                    {ratingOptions.map(option => (
                      <button
                        key={option.label}
                        onClick={() => onFilterChange('minRating', option.value)}
                        style={{
                          padding: '8px 14px',
                          fontSize: 13,
                          fontWeight: 500,
                          border: 'none',
                          borderRadius: 20,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: filters.minRating === option.value 
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                            : '#f3f4f6',
                          color: filters.minRating === option.value ? 'white' : '#6b7280',
                        }}
                      >
                        {option.value && (
                          <svg 
                            width={14} 
                            height={14} 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                          >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        )}
                        {option.label}
                      </button>
                    ))}
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
