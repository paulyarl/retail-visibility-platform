'use client';

// Re-export from new ProductSingleton for backward compatibility
export { 
  ProductSingletonProvider as ProductProvider, 
  useProductSingleton as useProduct,
  useRandomFeaturedProducts as useProductsData
} from './data/ProductSingleton';

export type { PublicProduct as UniversalProduct } from './data/ProductSingleton';
