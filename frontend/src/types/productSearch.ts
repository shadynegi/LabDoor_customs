export type SortOption = 'default' | 'price_asc' | 'price_desc' | 'newest' | 'oldest';

export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  color?: string;
  sortBy?: SortOption;
}

export interface FilterOptions {
  sizes: string[];
  colors: string[];
  priceRange: { min: number; max: number };
  sortOptions: { value: SortOption; label: string }[];
}
