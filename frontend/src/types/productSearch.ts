export type SortOption = 'default' | 'price_asc' | 'price_desc' | 'newest' | 'oldest';

export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  sortBy?: SortOption;
}

export interface FilterOptions {
  priceRange: { min: number; max: number };
  sortOptions: { value: SortOption; label: string }[];
}
