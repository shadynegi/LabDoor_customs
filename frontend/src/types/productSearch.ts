export type SortOption = 'default' | 'price_asc' | 'price_desc' | 'rating_desc' | 'newest' | 'oldest';

export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  size?: string;
  color?: string;
  minRating?: number;
  sortBy?: SortOption;
}

export interface FilterOptions {
  categories: string[];
  sizes: string[];
  colors: string[];
  priceRange: { min: number; max: number };
  ratingRange: { min: number; max: number; avg: number };
  sortOptions: { value: SortOption; label: string }[];
}
