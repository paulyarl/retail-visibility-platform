"use client";

import { useEffect, useState } from 'react';
import { UnifiedStoreCard } from './UnifiedStoreCard';
import { Skeleton } from '@/components/ui';
import { useLastViewedSession } from '@/hooks/useLastViewedSession';
import SmartProductCard from '@/components/products/SmartProductCard';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';

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
}

interface LastViewedProduct {
  productId: string;
  productName: string;
  productTitle?: string;
  productDescription?: string;
  productBrand?: string;
  productSku?: string;
  productPrice?: number;
  productPriceCents?: number;
  productImage?: string;
  productStock?: number;
  productAvailability?: string;
  productCurrency?: string;
  tenantId: string;
  businessName: string;
  slug: string;
  score: number;
  reason: string;
  hasActivePaymentGateway?: boolean;
  tenantLogo?: string;
  tenantCategory?: {
    id: string;
    name: string;
    slug: string;
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
}

// Force edge runtime to prevent prerendering issues
// export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
// export const dynamic = 'force-dynamic';

export default function LastViewed({
  title = "Recently Viewed",
  limit = 6,
  entityType = 'all',
  showEmptyState = true
}: LastViewedProps) {
  
  const { userId, sessionId, isAuthenticated } = useLastViewedSession();
  
  const [items, setItems] = useState<LastViewedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLastViewed = async () => {
      // Don't fetch if we don't have identification yet
      if (!userId && !sessionId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

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

        const res = await fetch(`${apiUrl}/api/recommendations/last-viewed?${params}`);

        if (!res.ok) {
          throw new Error('Failed to fetch last viewed items');
        }

        const data = await res.json();
        const recommendations = data.recommendations || [];

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
                productBrand: item.productBrand,
                productSku: item.productSku,
                productPrice: item.productPrice,
                productPriceCents: item.productPriceCents,
                productImage: item.productImage,
                productStock: item.productStock,
                productAvailability: item.productAvailability,
                productCurrency: item.productCurrency,
                tenantId: item.tenantId,
                businessName: item.businessName,
                slug: item.slug,
                score: item.score,
                reason: item.reason,
                hasActivePaymentGateway: item.hasActivePaymentGateway,
                tenantLogo: item.tenantLogo,
                tenantCategory: item.tenantCategory
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
                logoUrl: item.logoUrl,
                ratingAvg: item.ratingAvg,
                ratingCount: item.ratingCount,
                productCount: item.productCount
              }
            };
          }
        });

        setItems(transformedItems);
      } catch (err) {
        console.error('Error fetching last viewed items:', err);
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
          // Items grid
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, index) => {
              const itemId = item.type === 'store' ? (item.data as LastViewedStore).tenantId : (item.data as LastViewedProduct).productId;
              if (item.type === 'store') {
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
                      reason: storeData.reason,
                      directoryPublished: true
                    }}
                    viewMode="grid"
                    linkType="directory"
                    className="h-full"
                  />
                );
              } else {
                const productData = item.data as LastViewedProduct;
                
                return (
                  <TenantPaymentProvider key={`product-${productData.productId}-${index}`} tenantId={productData.tenantId}>
                    <SmartProductCard
                      product={{
                        id: productData.productId,
                        sku: productData.productSku || productData.productId,
                        name: productData.productName,
                        title: productData.productTitle || productData.productName,
                        brand: productData.productBrand || productData.businessName,
                        description: productData.productDescription,
                        priceCents: productData.productPriceCents || Math.round((productData.productPrice || 0) * 100),
                        stock: productData.productStock || 999,
                        imageUrl: productData.productImage,
                        tenantId: productData.tenantId,
                        availability: (productData.productAvailability as 'in_stock' | 'out_of_stock' | 'preorder') || 'in_stock',
                        has_active_payment_gateway: productData.hasActivePaymentGateway,
                        tenantCategory: productData.tenantCategory,
                      }}
                      tenantName={productData.businessName}
                      tenantLogo={productData.tenantLogo}
                      variant="grid"
                      showCategory={true}
                      showDescription={true}
                      className="h-full"
                    />
                  </TenantPaymentProvider>
                );
              }
            })}
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
