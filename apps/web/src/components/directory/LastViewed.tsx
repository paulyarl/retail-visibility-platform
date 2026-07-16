"use client";

import { useEffect, useState } from 'react';
import { UnifiedStoreCard } from './UnifiedStoreCard';
import { Skeleton } from '@/components/ui';
import { useLastViewedSession } from '@/hooks/useLastViewedSession';
import SmartProductCard from '@/components/products/SmartProductCard';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import { recommendationsService } from '@/services/RecommendationsSingletonService';
import { clientLogger } from '@/lib/client-logger';

// Types for last viewed items
interface LastViewedStore {
  tenantId: string;
  businessName: string;
  slug: string;
  score: number;
  reason: string;
  address?: string;
  city?: string;
  state?: string;
  logoUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
  productCount?: number;
  isFeatured?: boolean;
  primaryCategory?: string;
  gbpPrimaryCategoryName?: string;
  lastViewedAt?: string;
}

interface LastViewedProduct {
  productId: string;
  productName: string;
  productTitle?: string;
  productDescription?: string;
  productPrice?: number;
  productPriceCents?: number;
  productSalePrice?: number;
  productSalePriceCents?: number;
  productStock?: number;
  productImageUrl?: string;
  productBrand?: string;
  productRatingLive?: number;
  productReviewsCountLive?: number;
  productHelpfulCountLive?: number;
  productReviewsApprovedLive?: number;
  productAverageRating?: number;
  productReviewCount?: number;
  storeAverageRating?: number;
  storeReviewCount?: number;
  viewCount?: number;
  uniqueViewers?: number;
  engagementCount?: number;
  conversionCount?: number;
  revenueCents?: number;
  unitsSold?: number;
  wishlistCount?: number;
  shareCount?: number;
  trendingScore?: number;
  priceStatus?: string;
  stockStatus?: string;
  hasImage?: boolean;
  hasGallery?: boolean;
  hasDescription?: boolean;
  hasBrand?: boolean;
  hasPrice?: boolean;
  inStock?: boolean;
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string;
  tenantLogoUrl?: string;
  tenantCategory?: string;
  productCategory?: string;
  productCategorySlug?: string;
  featuredType?: string;
  featuredTypes?: string[];
  featuredPriority?: number;
  featuredAt?: string;
  isFeaturedActive?: boolean;
  productType?: string;
  storeName?: string;
  storeSlug?: string;
  storeLogo?: string;
  tenantId: string;
  productSku?: string;
  productCurrency?: string;
  productAvailability?: string;
  isFeatured?: boolean;
  lastViewedAt: string;
  pageType?: string;
  context?: string;
  productCount?: number;
  businessName?: string;
  tenantLogo?: string;
  productImage?: string;
  // Variant-aware fields
  has_variants?: boolean;
  variants?: any[];
  price_range?: {
    min: number;
    max: number;
    minCents: number;
    maxCents: number;
  };
  
}

interface LastViewedItem {
  type: 'store' | 'product';
  data: LastViewedStore | LastViewedProduct;
}

interface LastViewedProps {
  title?: string;
  limit?: number;
  entityType?: 'all' | 'store' | 'product';
  showEmptyState?: boolean;
  currentProductId?: string; // Exclude this product from the list
}


export default function LastViewed({
  title = "Recently Viewed",
  limit = 6,
  entityType = 'all',
  showEmptyState = true,
  currentProductId
}: LastViewedProps) {
  
  const { userId, sessionId, isAuthenticated } = useLastViewedSession();
  
  const [items, setItems] = useState<LastViewedItem[]>([]);
  // console.log(`Items: `,items);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLastViewed = async () => {
      // Wait for identification - don't return early, just wait
      // Session ID is set asynchronously from getUserIdentification()
      if (!userId && !sessionId) {
        // Keep loading state while waiting for session ID
        return;
      }

      setLoading(true);
      setError(null);

      try {
        

        // Determine query parameters based on authentication status
        const params = new URLSearchParams({
          entityType,
          limit: limit.toString(),
          daysBack: '30',
          _t: Date.now().toString() // Force fresh request
        });

        if (userId) {
          // Authenticated user - use userId
          params.set('userId', userId);
        } else if (sessionId) {
          // Anonymous user - use sessionId
          params.set('sessionId', sessionId);
        }

        const data = await recommendationsService.getLastViewed({
          limit: limit,
          entityType: entityType
        });
        // console.log('LastViewed data:', data);
        
        const recommendations = data?.recommendations || [];

        // Transform API response to component format
        const transformedItems: LastViewedItem[] = recommendations.map((item: any) => {
          if (item.productId) {
            // This is a product
            return {
              type: 'product' as const,
              data: {
                productId: item.productId,
                productName: item.productName,
                productTitle: item.productTitle,
                productDescription: item.productDescription,
                productPrice: item.productPrice,
                productPriceCents: item.productPriceCents,
                productSalePrice: item.productSalePrice,
                productSalePriceCents: item.productSalePriceCents,
                productStock: item.productStock,
                productImageUrl: item.productImageUrl,
                productBrand: item.productBrand,
                productRatingLive: item.productRatingLive,
                productReviewsCountLive: item.productReviewsCountLive,
                productHelpfulCountLive: item.productHelpfulCountLive,
                productReviewsApprovedLive: item.productReviewsApprovedLive,
                productAverageRating: item.productAverageRating,
                productReviewCount: item.productReviewCount,
                storeAverageRating: item.storeAverageRating,
                storeReviewCount: item.storeReviewCount,
                viewCount: item.viewCount,
                uniqueViewers: item.uniqueViewers,
                engagementCount: item.engagementCount,
                conversionCount: item.conversionCount,
                revenueCents: item.revenueCents,
                unitsSold: item.unitsSold,
                wishlistCount: item.wishlistCount,
                shareCount: item.shareCount,
                trendingScore: item.trendingScore,
                priceStatus: item.priceStatus,
                stockStatus: item.stockStatus,
                hasImage: item.hasImage,
                hasGallery: item.hasGallery,
                hasDescription: item.hasDescription,
                hasBrand: item.hasBrand,
                hasPrice: item.hasPrice,
                inStock: item.inStock,
                hasActivePaymentGateway: item.hasActivePaymentGateway,
                defaultGatewayType: item.defaultGatewayType,
                tenantLogoUrl: item.tenantLogoUrl,
                tenantCategory: item.tenantCategory,
                productCategory: item.productCategory||item.tenantCategory?.name,
                productCategorySlug: item.productCategorySlug||item.tenantCategory?.slug,
                featuredType: item.featuredType,
                featuredPriority: item.featuredPriority,
                featuredAt: item.featuredAt,
                isFeaturedActive: item.isFeaturedActive,
                productType: item.productType,
                storeName: item.businessName,
                storeSlug: item.slug,
                storeLogo: item.tenantLogoUrl,
                tenantId: item.tenantId,
                productSku: item.productSku,
                productCurrency: item.currency || "USD",
                productAvailability: item.availability,
                isFeatured: item.isFeaturedActive,
                lastViewedAt: item.lastViewedAt || new Date().toISOString(),
                pageType: item.pageType,
                context: item.context,
                score: item.score,
                reason: item.reason,
                businessName: item.businessName,
                primaryCategory: item.primaryCategory,
                tenantLogo: item.tenantLogoUrl,
                // Variant-aware fields
                has_variants: item.has_variants,
                variants: item.variants,
                price_range: item.price_range
              }
            };
          } else {
            // This is a store
            return {
              type: 'store' as const,
              data: {
                tenantId: item.tenantId,
                businessName: item.businessName,
                slug: item.slug,
                score: item.score,
                reason: item.reason,
                address: item.address,
                city: item.city,
                state: item.state,
                logoUrl: item.logoUrl || item.tenantLogoUrl,
                ratingAvg: item.storeAverageRating,
                ratingCount: item.storeReviewCount,
                productCount: item.productCount,
                isFeatured: item.isFeatured,
                primaryCategory: item.primaryCategory || item.tenantCategory,
                tenantCategory: item.primaryCategory || item.tenantCategory,
                gbpPrimaryCategoryName: item.gbpPrimaryCategoryName||item.primaryCategory,
                lastViewedAt: item.lastViewedAt || new Date().toISOString()
                
              }
            };
          }
        });

        setItems(transformedItems);
      } catch (err) {
        clientLogger.error('Error fetching last viewed items:', { detail: err });
        setError('Failed to load recently viewed items');
      } finally {
        setLoading(false);
      }
    };

    fetchLastViewed();
  }, [userId, sessionId, limit, entityType]);

  // Don't render if no items and not showing empty state
  if (!loading && items.length === 0 && !showEmptyState) {
    return null;
  }

  // Don't render if error
  if (error) {
    return null;
  }

  return (
    <div className="bg-white border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {title}
        </h2>

        {loading ? (
          // Loading skeleton
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="w-full aspect-square rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          // Empty state
          showEmptyState && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">No recently viewed items</h3>
              <p className="text-sm text-gray-500">Items you view will appear here for quick access.</p>
            </div>
          )
        ) : (
          // Group items by type for better visual balance
          <div className="space-y-8">
            {/* Products Section — grouped by product type */}
            {(() => {
              const products = items
                .filter(item => item.type === 'product')
                .filter(item => {
                  const productData = item.data as LastViewedProduct;
                  return productData.productId !== currentProductId;
                });

              const productTypeOrder = ['physical', 'digital', 'service', 'hybrid'] as const;
              const productTypeLabels: Record<string, string> = {
                physical: 'Physical Products',
                digital: 'Digital Products',
                service: 'Service Products',
                hybrid: 'Hybrid Products',
              };

              const grouped = productTypeOrder.reduce((acc, pt) => {
                acc[pt] = products.filter(item => {
                  const pd = item.data as LastViewedProduct;
                  return (pd.productType || 'physical') === pt;
                });
                return acc;
              }, {} as Record<string, typeof products>);

              const otherProducts = products.filter(item => {
                const pt = (item.data as LastViewedProduct).productType || 'physical';
                return !productTypeOrder.includes(pt as any);
              });

              return (products.length > 0) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Viewed Products</h3>
                  <div className="space-y-6">
                    {productTypeOrder.map(pt => {
                      const group = grouped[pt];
                      if (!group || group.length === 0) return null;
                      return (
                        <div key={pt}>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">{productTypeLabels[pt]}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {group.map((item, index) => {
                              const productData = item.data as LastViewedProduct;
                              return (
                                <SmartProductCard
                                  key={`product-${productData.productId}-${index}`}
                                  tenantId={productData.tenantId}
                                  product={{
                                    id: productData.productId,
                                    sku: productData.productSku || productData.productId,
                                    name: productData.productName,
                                    title: productData.productTitle || productData.productName,
                                    brand: productData.productBrand || productData.businessName,
                                    description: productData.productDescription,
                                    priceCents: productData.productPriceCents || Math.round((productData.productPrice || 0) * 100),
                                    salePriceCents: productData.productSalePriceCents,
                                    listPriceCents: productData.productPriceCents,
                                    stock: productData.productStock || 999,
                                    imageUrl: productData.productImage || productData.productImageUrl,
                                    tenantId: productData.tenantId,
                                    availability: (productData.productAvailability as 'in_stock' | 'out_of_stock' | 'preorder') || 'in_stock',
                                    has_active_payment_gateway: undefined,
                                    payment_gateway_type: undefined,
                                    tenantCategory: productData.tenantCategory ? {
                                      id: productData.tenantCategory,
                                      name: productData.tenantCategory,
                                      slug: productData.tenantCategory
                                    } : undefined,
                                    isFeatured: productData.isFeatured,
                                    averageRating: typeof productData.productAverageRating === 'string' ? parseFloat(productData.productAverageRating) : productData.productAverageRating,
                                    reviewCount: productData.productReviewCount,
                                    viewCount: productData.viewCount,
                                    wishlistCount: productData.wishlistCount,
                                    shareCount: productData.shareCount,
                                    isOnSale: productData.productSalePriceCents ? true : false,
                                    discountPercentage: productData.productPriceCents && productData.productSalePriceCents ?
                                      Math.round(((productData.productPriceCents - productData.productSalePriceCents) / productData.productPriceCents) * 100).toString() : "0",
                                    currency: productData.productCurrency || "USD",
                                    hasGallery: productData.hasGallery,
                                    videoUrl: undefined,
                                    imageUrls: undefined,
                                    galleryUrls: undefined,
                                    thumbnailUrl: undefined,
                                    featuredImageUrl: undefined,
                                    manufacturer: undefined,
                                    condition: undefined,
                                    gtin: undefined,
                                    mpn: undefined,
                                    specifications: undefined,
                                    attributes: undefined,
                                    customFields: undefined,
                                    searchKeywords: undefined,
                                    seoTitle: undefined,
                                    seoDescription: undefined,
                                    seoKeywords: undefined,
                                    tags: undefined,
                                    productRatingLive: typeof productData.productRatingLive === 'string' ? parseFloat(productData.productRatingLive) : productData.productRatingLive,
                                    productReviewsCountLive: productData.productReviewsCountLive,
                                    productHelpfulCountLive: productData.productHelpfulCountLive,
                                    productReviewsApprovedLive: productData.productReviewsApprovedLive,
                                    featuredType: productData.featuredType,
                                    featuredTypes: productData.featuredTypes || (productData.featuredType ? [productData.featuredType] : []),
                                    featuredPriority: productData.featuredPriority,
                                    featuredAt: productData.featuredAt,
                                    isFeaturedActive: productData.isFeaturedActive,
                                    productType: productData.productType || 'physical',
                                    uniqueViewers: productData.uniqueViewers,
                                    engagementCount: productData.engagementCount,
                                    conversionCount: productData.conversionCount,
                                    revenueCents: productData.revenueCents,
                                    unitsSold: productData.unitsSold,
                                    trendingScore: typeof productData.trendingScore === 'string' ? parseFloat(productData.trendingScore) : productData.trendingScore,
                                    priceStatus: productData.priceStatus,
                                    stockStatus: productData.stockStatus,
                                    hasDescription: productData.hasDescription,
                                    hasBrand: productData.hasBrand,
                                    hasPrice: productData.hasPrice,
                                    inStock: productData.inStock,
                                    hasActivePaymentGateway: productData.hasActivePaymentGateway,
                                    defaultGatewayType: productData.defaultGatewayType,
                                    productCategory: productData.productCategory,
                                    productCategorySlug: productData.productCategorySlug,
                                    has_variants: productData.has_variants,
                                    variants: productData.variants,
                                    price_range: productData.price_range ? {
                                      min_cents: productData.price_range.minCents,
                                      max_cents: productData.price_range.maxCents
                                    } : undefined
                                  }}
                                  tenantName={productData.businessName || productData.storeName}
                                  tenantLogo={productData.tenantLogo || productData.storeLogo}
                                  defaultGatewayType={productData.defaultGatewayType}
                                  variant={productData.isFeatured ? 'featured' : 'grid'}
                                  showCategory={true}
                                  showDescription={true}
                                  buttonLayout="stacked"
                                  className="h-full"
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {otherProducts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Other Products</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {otherProducts.map((item, index) => {
                            const productData = item.data as LastViewedProduct;
                            return (
                              <SmartProductCard
                                key={`product-other-${productData.productId}-${index}`}
                                tenantId={productData.tenantId}
                                product={{
                                  id: productData.productId,
                                  sku: productData.productSku || productData.productId,
                                  name: productData.productName,
                                  title: productData.productTitle || productData.productName,
                                  brand: productData.productBrand || productData.businessName,
                                  description: productData.productDescription,
                                  priceCents: productData.productPriceCents || Math.round((productData.productPrice || 0) * 100),
                                  salePriceCents: productData.productSalePriceCents,
                                  listPriceCents: productData.productPriceCents,
                                  stock: productData.productStock || 999,
                                  imageUrl: productData.productImage || productData.productImageUrl,
                                  tenantId: productData.tenantId,
                                  availability: (productData.productAvailability as 'in_stock' | 'out_of_stock' | 'preorder') || 'in_stock',
                                  has_active_payment_gateway: undefined,
                                  payment_gateway_type: undefined,
                                  tenantCategory: productData.tenantCategory ? {
                                    id: productData.tenantCategory,
                                    name: productData.tenantCategory,
                                    slug: productData.tenantCategory
                                  } : undefined,
                                  isFeatured: productData.isFeatured,
                                  averageRating: typeof productData.productAverageRating === 'string' ? parseFloat(productData.productAverageRating) : productData.productAverageRating,
                                  reviewCount: productData.productReviewCount,
                                  viewCount: productData.viewCount,
                                  wishlistCount: productData.wishlistCount,
                                  shareCount: productData.shareCount,
                                  isOnSale: productData.productSalePriceCents ? true : false,
                                  discountPercentage: productData.productPriceCents && productData.productSalePriceCents ?
                                    Math.round(((productData.productPriceCents - productData.productSalePriceCents) / productData.productPriceCents) * 100).toString() : "0",
                                  currency: productData.productCurrency || "USD",
                                  hasGallery: productData.hasGallery,
                                  productRatingLive: typeof productData.productRatingLive === 'string' ? parseFloat(productData.productRatingLive) : productData.productRatingLive,
                                  productReviewsCountLive: productData.productReviewsCountLive,
                                  productHelpfulCountLive: productData.productHelpfulCountLive,
                                  productReviewsApprovedLive: productData.productReviewsApprovedLive,
                                  featuredType: productData.featuredType,
                                  featuredTypes: productData.featuredTypes || (productData.featuredType ? [productData.featuredType] : []),
                                  featuredPriority: productData.featuredPriority,
                                  featuredAt: productData.featuredAt,
                                  isFeaturedActive: productData.isFeaturedActive,
                                  productType: productData.productType || 'physical',
                                  uniqueViewers: productData.uniqueViewers,
                                  engagementCount: productData.engagementCount,
                                  conversionCount: productData.conversionCount,
                                  revenueCents: productData.revenueCents,
                                  unitsSold: productData.unitsSold,
                                  trendingScore: typeof productData.trendingScore === 'string' ? parseFloat(productData.trendingScore) : productData.trendingScore,
                                  priceStatus: productData.priceStatus,
                                  stockStatus: productData.stockStatus,
                                  hasDescription: productData.hasDescription,
                                  hasBrand: productData.hasBrand,
                                  hasPrice: productData.hasPrice,
                                  inStock: productData.inStock,
                                  hasActivePaymentGateway: productData.hasActivePaymentGateway,
                                  defaultGatewayType: productData.defaultGatewayType,
                                  productCategory: productData.productCategory,
                                  productCategorySlug: productData.productCategorySlug,
                                  has_variants: productData.has_variants,
                                  variants: productData.variants,
                                  price_range: productData.price_range ? {
                                    min_cents: productData.price_range.minCents,
                                    max_cents: productData.price_range.maxCents
                                  } : undefined
                                }}
                                tenantName={productData.businessName || productData.storeName}
                                tenantLogo={productData.tenantLogo || productData.storeLogo}
                                defaultGatewayType={productData.defaultGatewayType}
                                variant={productData.isFeatured ? 'featured' : 'grid'}
                                showCategory={true}
                                showDescription={true}
                                buttonLayout="stacked"
                                className="h-full"
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Stores Section */}
            {(() => {
              const stores = items.filter(item => item.type === 'store');
              return stores.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Viewed Stores</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stores.map((item, index) => {
                      const storeData = item.data as LastViewedStore;
                      return (
                        <UnifiedStoreCard
                          key={`store-${storeData.tenantId}-${index}`}
                          listing={{
                            id: storeData.tenantId,
                            tenantId: storeData.tenantId,
                            businessName: storeData.businessName,
                            slug: storeData.slug,
                            address: storeData.address,
                            city: storeData.city,
                            state: storeData.state,
                            logoUrl: storeData.logoUrl,
                            ratingAvg: storeData.ratingAvg,
                            ratingCount: storeData.ratingCount,
                            productCount: storeData.productCount,
                            isFeatured: storeData.isFeatured,
                            reason: storeData.reason,
                            directoryPublished: true,
                            primaryCategory: storeData.primaryCategory,
                            gbpPrimaryCategoryName: (storeData as any).gbpPrimaryCategoryName
                          }}
                          viewMode="grid"
                          linkType="directory"
                          className="h-full"
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="mt-6 text-center">
            <a
              href="/directory"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Browse All Stores →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export { LastViewed };
