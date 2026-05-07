'use client';

import { ReactNode } from 'react';
import { ProductSingletonProvider } from './data/ProductSingleton';
import { StoreProvider } from './StoreProviderSingleton';
import { CategoryProvider } from './data/CategorySingleton';
import { ApiSingletonProvider } from './api/ApiSingletonBase';

// ====================
// UNIVERSAL PROVIDER - NEW API SINGLETON VERSION
// ====================
interface UniversalProviderProps {
  children: ReactNode;
  initialProducts?: Record<string, any>;
  initialStores?: Record<string, any>;
  cacheTTL?: number;
}

export function UniversalProvider({ 
  children, 
  initialProducts = {}, 
  initialStores = {}, 
  cacheTTL = 5 * 60 * 1000 
}: UniversalProviderProps) {
  // Transform initial data to universal format
  const transformedProducts = Object.entries(initialProducts).reduce((acc, [id, product]) => {
    acc[id] = {
      id: product.id,
      tenantId: product.tenantId,
      sku: product.sku,
      name: product.name,
      title: product.title || product.name,
      description: product.description,
      brand: product.brand,
      priceCents: product.priceCents,
      salePriceCents: product.salePriceCents,
      stock: product.stock,
      availability: product.availability || 'in_stock',
      imageUrl: product.imageUrl,
      hasGallery: product.hasGallery || false,
      tenantCategoryId: product.tenantCategoryId,
      category: product.category ? {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug
      } : undefined,
      isFeatured: product.isFeatured || false,
      featuredType: product.featuredType,
      featuredPriority: product.featuredPriority,
      metadata: product.metadata || {},
      hasDescription: !!product.description,
      hasBrand: !!product.brand,
      hasPrice: !!product.priceCents,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      hasVariants: product.hasVariants || false,
      variantOptions: product.variantOptions || {},
      storeInfo: product.storeInfo ? {
        storeId: product.storeInfo.storeId,
        storeName: product.storeInfo.storeName,
        storeSlug: product.storeInfo.storeSlug,
        storeLogo: product.storeInfo.storeLogo,
        storeCity: product.storeInfo.storeCity,
        storeState: product.storeInfo.storeState,
        storeWebsite: product.storeInfo.storeWebsite,
        storePhone: product.storeInfo.storePhone,
      } : undefined,
      formattedPrice: (product.priceCents / 100).toFixed(2),
      formattedSalePrice: product.salePriceCents ? (product.salePriceCents / 100).toFixed(2) : undefined,
      isOnSale: !!product.salePriceCents && product.salePriceCents < product.priceCents,
      stockStatus: product.stock === 0 ? 'out_of_stock' : product.stock < 5 ? 'low_stock' : 'in_stock',
    };
    return acc;
  }, {} as Record<string, any>);

  const transformedStores = Object.entries(initialStores).reduce((acc, [id, store]) => {
    acc[id] = {
      id: store.id,
      tenantId: store.tenantId,
      name: store.name,
      slug: store.slug,
      description: store.description,
      address: store.address,
      city: store.city,
      state: store.state,
      zipCode: store.zipCode,
      country: store.country,
      latitude: store.latitude,
      longitude: store.longitude,
      logoUrl: store.logoUrl,
      bannerUrl: store.bannerUrl,
      website: store.website,
      phone: store.phone,
      email: store.email,
      businessHours: store.businessHours,
      primaryCategory: store.primaryCategory,
      categories: store.categories || [],
      ratingAvg: store.ratingAvg,
      ratingCount: store.ratingCount,
      rating1Count: store.rating1Count,
      rating2Count: store.rating2Count,
      rating3Count: store.rating3Count,
      rating4Count: store.rating4Count,
      rating5Count: store.rating5Count,
      verifiedPurchaseCount: store.verifiedPurchaseCount,
      lastReviewAt: store.lastReviewAt,
      totalProducts: store.totalProducts,
      totalInStock: store.totalInStock,
      uniqueCategories: store.uniqueCategories,
      isFeatured: store.isFeatured || false,
      featuredType: store.featuredType,
      featuredPriority: store.featuredPriority,
      subscriptionTier: store.subscriptionTier,
      subscriptionStatus: store.subscriptionStatus,
      directoryPublished: store.directoryPublished,
      organizationId: store.organizationId,
      organizationName: store.organizationName,
      metadata: store.metadata || {},
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
      formattedAddress: [store.address, store.city, store.state, store.zipCode].filter(Boolean).join(', '),
      ratingDisplay: store.ratingAvg && store.ratingCount ? `${store.ratingAvg.toFixed(1)} (${store.ratingCount})` : '',
      hasRatings: !!store.ratingAvg && store.ratingCount > 0,
      hasCategories: !!(store.categories && store.categories.length > 0),
    };
    return acc;
  }, {} as Record<string, any>);

  return (
    <ApiSingletonProvider>
      <StoreProvider initialData={transformedStores} cacheTTL={cacheTTL}>
        <CategoryProvider>
          <ProductSingletonProvider>
            {children}
          </ProductSingletonProvider>
        </CategoryProvider>
      </StoreProvider>
    </ApiSingletonProvider>
  );
}

// ====================
// UNIFIED SINGLETON ACCESS HOOK
// ====================
export function useUniversalSingleton() {
  // This provides access to all singleton instances
  const productInstance = (window as any).__productProviderInstance;
  const storeInstance = (window as any).__storeProviderInstance;
  
  return {
    // Legacy singleton access (for backward compatibility)
    product: productInstance ? {
      state: productInstance.state,
      actions: {
        fetchProducts: async (productIds: string[]) => {
          throw new Error('Global access to fetchProducts not available outside React context');
        },
        updateProduct: (productId: string, updates: any) => {
          productInstance.dispatch({ type: 'UPDATE_PRODUCT', productId, updates });
        },
        clearCache: (productIds?: string[]) => {
          productInstance.dispatch({ type: 'CLEAR_CACHE', productIds });
        },
        getProduct: (productId: string) => productInstance.state.products[productId],
        getProducts: (productIds: string[]) => {
          return productIds.map(id => productInstance.state.products[id]).filter(Boolean);
        },
        isLoading: (productId: string) => productInstance.state.loading[productId] || false,
        getError: (productId: string) => productInstance.state.errors[productId],
      }
    } : null,
    store: storeInstance ? {
      state: storeInstance.state,
      actions: {
        fetchStores: async (storeIds: string[]) => {
          throw new Error('Global access to fetchStores not available outside React context');
        },
        fetchStoreStats: async (storeIds: string[]) => {
          throw new Error('Global access to fetchStoreStats not available outside React context');
        },
        updateStore: (storeId: string, updates: any) => {
          storeInstance.dispatch({ type: 'UPDATE_STORE', storeId, updates });
        },
        clearCache: (storeIds?: string[]) => {
          storeInstance.dispatch({ type: 'CLEAR_CACHE', storeIds });
        },
        getStore: (storeId: string) => storeInstance.state.stores[storeId],
        getStores: (storeIds: string[]) => {
          return storeIds.map(id => storeInstance.state.stores[id]).filter(Boolean);
        },
        isLoading: (storeId: string) => storeInstance.state.loading[storeId] || false,
        getError: (storeId: string) => storeInstance.state.errors[storeId],
      }
    } : null,
    
    // New API singleton access
    apiSingletons: {
      productSingleton: (window as any).__productSingletonInstance,
      storeSingleton: (window as any).__storeSingletonInstance,
      tenantSingleton: (window as any).__tenantSingletonInstance,
      adminSingleton: (window as any).__adminSingletonInstance,
      inventorySingleton: (window as any).__inventorySingletonInstance,
    },
    
    // Availability status
    allAvailable: !!(productInstance && storeInstance),
    legacyAvailable: !!(productInstance && storeInstance),
    newApiAvailable: !!((window as any).__productSingletonInstance),
  };
}
