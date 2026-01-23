"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import SmartProductCard from '@/components/products/SmartProductCard';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import { useProductSingleton, PublicProduct } from '@/providers/data/ProductSingleton';

// Enhanced Product interface that includes featured types from singleton
interface UniversalProduct extends Omit<PublicProduct, 'availability'> {
  // Override availability to match ProductData (exclude 'discontinued')
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  // Additional fields for display compatibility
  price: number; // Computed from priceCents
  salePrice?: number; // Computed from salePriceCents
  currency: string;
  tenantCategory?: {
    id: string;
    name: string;
    slug: string;
  };
  payment_gateway_type?: string | null;
  payment_gateway_id?: string | null;
  // Enhanced gallery support
  images?: ProductImage[];
}

interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  isPrimary?: boolean;
}

interface ProductDisplayProps {
  products: UniversalProduct[];
  tenantId: string;
  tenantName?: string;
  tenantLogo?: string;
  // New props for singleton integration
  useSingletonData?: boolean; // Whether to enhance with singleton data
  showFeaturedBadges?: boolean; // Whether to show featured type badges
}

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function ProductDisplay({ 
  products, 
  tenantId, 
  tenantName, 
  tenantLogo,
  useSingletonData = true,
  showFeaturedBadges = true 
}: ProductDisplayProps) {
  const { actions: productSingleton } = useProductSingleton();
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'gallery'>('grid');
  const [mounted, setMounted] = useState(false);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [enhancedProducts, setEnhancedProducts] = useState<UniversalProduct[]>(products);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize view mode on client-side only and listen for URL changes
  useEffect(() => {
    setMounted(true);
    
    const updateViewModeFromURL = () => {
      try {
        const qs = new URLSearchParams(window.location.search);
        const view = qs.get('view') as 'grid' | 'list' | 'gallery';
        if (view && ['grid', 'list', 'gallery'].includes(view)) {
          setViewMode(view);
        }
      } catch (e) {
        console.error('Error parsing view mode from URL:', e);
      }
    };

    // Initial load
    updateViewModeFromURL();

    // Listen for popstate events (browser back/forward)
    const handlePopState = () => {
      updateViewModeFromURL();
    };

    window.addEventListener('popstate', handlePopState);

    // Also listen for URL changes via pushState/replaceState
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    
    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args);
      setTimeout(updateViewModeFromURL, 0);
    };
    
    window.history.replaceState = function(...args) {
      originalReplaceState.apply(window.history, args);
      setTimeout(updateViewModeFromURL, 0);
    };

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  // Enhance products with singleton data
  useEffect(() => {
    const enhanceProductsWithSingleton = async () => {
      if (!useSingletonData) {
        setEnhancedProducts(products);
        return;
      }

      try {
        // Get products from ProductSingleton using fetchProducts
        const singletonProducts = await productSingleton.fetchProducts({ tenantId });
        
        if (singletonProducts && singletonProducts.length > 0) {
          // Create a map for quick lookup
          const productMap = new Map(singletonProducts.map(p => [p.id, p]));
          
          // Enhance products with singleton data
          const enhanced = products.map(product => {
            const singletonProduct = productMap.get(product.id);
            
            if (singletonProduct) {
              // Merge with singleton data, prioritizing singleton's featured information
              return {
                ...product,
                // Ensure featured fields from singleton are included
                featuredType: singletonProduct.featuredType,
                featuredPriority: singletonProduct.featuredPriority,
                featuredAt: singletonProduct.featuredAt,
                featuredExpiresAt: singletonProduct.featuredExpiresAt,
                // Ensure computed fields are present
                price: product.price || (singletonProduct.priceCents / 100),
                salePrice: product.salePrice || (singletonProduct.salePriceCents ? singletonProduct.salePriceCents / 100 : undefined),
                currency: product.currency || 'USD',
                // Additional singleton fields
                hasGallery: singletonProduct.hasGallery,
                hasDescription: singletonProduct.hasDescription,
                hasBrand: singletonProduct.hasBrand,
                hasPrice: singletonProduct.hasPrice,
                storeInfo: singletonProduct.storeInfo,
                distanceKm: singletonProduct.distanceKm,
                hasActivePaymentGateway: singletonProduct.hasActivePaymentGateway,
                defaultGatewayType: singletonProduct.defaultGatewayType,
              };
            }
            
            return product;
          });
          
          setEnhancedProducts(enhanced);
        } else {
          // No singleton data, use original products
          setEnhancedProducts(products);
        }
      } catch (error) {
        console.error('Error enhancing products with singleton data:', error);
        setEnhancedProducts(products);
      }
    };

    if (products && products.length > 0) {
      enhanceProductsWithSingleton();
    }
  }, [products, tenantId, useSingletonData]);

  // Helper functions for gallery management
  const getProductImages = (product: UniversalProduct): ProductImage[] => {
    // If product has multiple images, use them
    if (product.images && product.images.length > 0) {
      return product.images;
    }
    
    // Otherwise, create a single image from imageUrl
    if (product.imageUrl) {
      return [{
        id: 'main',
        url: product.imageUrl,
        alt: product.name,
        isPrimary: true
      }];
    }
    
    // No images available
    return [];
  };

  const getCurrentProductImages = (): ProductImage[] => {
    const currentProduct = enhancedProducts[currentProductIndex];
    return currentProduct ? getProductImages(currentProduct) : [];
  };

  const handlePrevImage = () => {
    const images = getCurrentProductImages();
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    } else {
      // Wrap to last image
      setCurrentPhotoIndex(images.length - 1);
    }
  };

  const handleNextImage = () => {
    const images = getCurrentProductImages();
    if (currentPhotoIndex < images.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    } else {
      // Wrap to first image
      setCurrentPhotoIndex(0);
    }
  };

  const handleImageClick = (index: number) => {
    setCurrentPhotoIndex(index);
  };

  // Reset photo index when changing products
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [currentProductIndex]);

  // Initialize view mode on client-side only
  useEffect(() => {
    setMounted(true);
    try {
      const qs = new URLSearchParams(window.location.search);
      const view = qs.get('view') as 'grid' | 'list' | 'gallery';
      if (view && ['grid', 'list', 'gallery'].includes(view)) {
        setViewMode(view);
      }
    } catch (e) {
      console.error('Error parsing view mode from URL:', e);
    }
  }, []);

  // Rest of the existing ProductDisplay logic...
  const [currentProduct, setCurrentProduct] = useState<UniversalProduct | null>(null);

  useEffect(() => {
    if (enhancedProducts.length > 0 && currentProductIndex < enhancedProducts.length) {
      setCurrentProduct(enhancedProducts[currentProductIndex]);
    }
  }, [currentProductIndex, enhancedProducts]);

  const handleProductClick = (product: UniversalProduct, index: number) => {
    setCurrentProductIndex(index);
    setCurrentPhotoIndex(0);
    setIsZoomed(false);
  };

  const handleNextProduct = () => {
    if (currentProductIndex < enhancedProducts.length - 1) {
      setCurrentProductIndex(currentProductIndex + 1);
    }
  };

  const handlePrevProduct = () => {
    if (currentProductIndex > 0) {
      setCurrentProductIndex(currentProductIndex - 1);
    }
  };

  const handleNextPhoto = () => {
    if (currentProduct && currentProductIndex < enhancedProducts.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
  };

  const handlePrevPhoto = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  if (!mounted) {
    // SSR fallback - render a simple grid
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {enhancedProducts.map((product) => (
          <div key={product.id} className="animate-pulse">
            <div className="bg-neutral-200 dark:bg-neutral-700 rounded-lg h-64"></div>
          </div>
        ))}
      </div>
    );
  }

  if (viewMode === 'gallery') {
    return (
      <TenantPaymentProvider tenantId={tenantId}>
        <div className="space-y-8">
          {/* Gallery Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Product Gallery
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className="p-2 border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                title="Grid View"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className="p-2 border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                title="List View"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Gallery Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevProduct}
              disabled={currentProductIndex === 0}
              className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              ← Previous Product
            </button>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              {currentProductIndex + 1} of {enhancedProducts.length}
            </span>
            <button
              onClick={handleNextProduct}
              disabled={currentProductIndex === enhancedProducts.length - 1}
              className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              Next Product →
            </button>
          </div>

          {/* Current Product Display */}
          {currentProduct && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                {/* Main Image Gallery */}
                <div className="lg:col-span-2 bg-neutral-50 dark:bg-neutral-900">
                  <div className="relative aspect-square bg-neutral-100 dark:bg-neutral-800">
                    {getCurrentProductImages().length > 0 ? (
                      <>
                        {/* Main Image */}
                        <div 
                          className="relative w-full h-full cursor-pointer group"
                          onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                          <Image
                            src={getCurrentProductImages()[currentPhotoIndex]?.url || ''}
                            alt={getCurrentProductImages()[currentPhotoIndex]?.alt || currentProduct.name}
                            fill
                            className="object-contain transition-transform duration-300 group-hover:scale-105"
                          />
                          
                          {/* Image Navigation Overlay */}
                          {getCurrentProductImages().length > 1 && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrevImage();
                                }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/70"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNextImage();
                                }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/70"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </>
                          )}
                          
                          {/* Zoom Indicator */}
                          <div className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                          
                          {/* Image Counter */}
                          {getCurrentProductImages().length > 1 && (
                            <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/50 text-white rounded-full text-sm">
                              {currentPhotoIndex + 1} / {getCurrentProductImages().length}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-400 dark:text-neutral-500">
                        <div className="text-center">
                          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p>No images available</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Thumbnail Strip */}
                  {getCurrentProductImages().length > 1 && (
                    <div className="p-4 bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {getCurrentProductImages().map((image, index) => (
                          <button
                            key={image.id}
                            onClick={() => handleImageClick(index)}
                            className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                              index === currentPhotoIndex
                                ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                                : 'border-neutral-200 dark:border-neutral-600 hover:border-primary-300 dark:hover:border-primary-600'
                            }`}
                          >
                            <div className="relative w-full h-full">
                              <Image
                                src={image.url}
                                alt={image.alt || `Thumbnail ${index + 1}`}
                                fill
                                className="object-cover"
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Product Details Sidebar */}
                <div className="p-6 space-y-6 bg-white dark:bg-neutral-800">
                  {/* Product Info */}
                  <div>
                    <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                      {currentProduct.name}
                    </h3>
                    {currentProduct.brand && (
                      <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                        {currentProduct.brand}
                      </p>
                    )}
                    
                    {/* Featured Badge */}
                    {showFeaturedBadges && currentProduct.featuredType && (
                      <div className="mb-4">
                        <FeaturedBadge featuredType={currentProduct.featuredType} />
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-neutral-900 dark:text-white">
                      ${currentProduct.price}
                    </span>
                    {currentProduct.salePrice && currentProduct.salePrice < currentProduct.price && (
                      <>
                        <span className="text-lg text-neutral-500 dark:text-neutral-400 line-through">
                          ${currentProduct.price}
                        </span>
                        <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                          ${currentProduct.salePrice}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Stock Status */}
                  <div className="flex items-center gap-2 text-sm">
                    {currentProduct.stock > 0 ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        In Stock ({currentProduct.stock})
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        Out of Stock
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {currentProduct.description && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p>{currentProduct.description}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                    <SmartProductCard
                      product={currentProduct}
                      tenantName={tenantName}
                      tenantLogo={tenantLogo}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </TenantPaymentProvider>
    );
  }

  return (
    <TenantPaymentProvider tenantId={tenantId}>
      <div className="space-y-6">
        {/* View Mode Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              {enhancedProducts.length} products
            </span>
            {enhancedProducts.some(p => p.featuredType) && showFeaturedBadges && (
              <span className="text-sm text-primary-600 dark:text-primary-400">
                • {enhancedProducts.filter(p => p.featuredType).length} featured
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 text-sm border rounded ${
                viewMode === 'grid'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
              title="Grid View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 text-sm border rounded ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
              title="List View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('gallery' as const)}
              className={`p-2 text-sm border rounded ${
                (viewMode as 'grid' | 'list' | 'gallery') === 'gallery'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
              title="Gallery View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Product Grid/List */}
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-4'
        }>
          {enhancedProducts.map((product) => (
            <SmartProductCard
              key={product.id}
              product={product}
              tenantName={tenantName}
              tenantLogo={tenantLogo}
              variant={viewMode === 'grid' ? 'grid' : 'list'}
            />
          ))}
        </div>

        {/* Empty State */}
        {enhancedProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-neutral-600 dark:text-neutral-400">
              No products available at this time.
            </p>
          </div>
        )}
      </div>
    </TenantPaymentProvider>
  );
}

/**
 * Featured Badge Component
 * Displays the featured type badge on product cards
 */
function FeaturedBadge({ featuredType }: { featuredType: string }) {
  const getBadgeInfo = (type: string) => {
    switch (type) {
      case 'staff_pick':
        return { label: 'Staff Pick', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: '⭐' };
      case 'seasonal':
        return { label: 'Seasonal', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: '🍂' };
      case 'sale':
        return { label: 'Sale', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: '💰' };
      case 'new_arrival':
        return { label: 'New', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: '✨' };
      case 'store_selection':
        return { label: 'Featured', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: '🏪' };
      default:
        return { label: 'Featured', color: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200', icon: '⭐' };
    }
  };

  const badgeInfo = getBadgeInfo(featuredType);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${badgeInfo.color}`}>
      <span>{badgeInfo.icon}</span>
      {badgeInfo.label}
    </span>
  );
}
