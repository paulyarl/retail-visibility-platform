'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SmartProductCard from './SmartProductCard';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import { recommendationsService } from '@/services/RecommendationsSingletonService';
import { Button } from '../ui';

interface RecommendedProduct {
  id: string;
  name: string;
  title: string;
  priceCents: number;
  salePriceCents?: number | null;
  currency: string;
  imageUrl?: string;
  brand?: string;
  relevanceScore: number;
  tenantId: string;
  has_active_payment_gateway?: boolean;
  payment_gateway_type?: string | null;
  tenantSlug?: string;
  productCategory?: string;
  productCategorySlug?: string;
  featuredType?: string;
  featuredTypes?: string[];
  productType?: string;
}

interface ProductRecommendationsProps {
  productId: string;
  tenantId: string;
  tenantSlug?: string;
  productCategory?: string;
  productCategorySlug?: string;
  priority?: 'trending' | undefined;
}

export function ProductRecommendations({ productId, tenantId, tenantSlug, productCategory, productCategorySlug, priority }: ProductRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abortController = new AbortController();
    let isMounted = true;

    const fetchRecommendations = async () => {
      try {
        const data = await recommendationsService.getProductPageRecommendations(productId, 6);
        // console.log('[ProductRecommendations] API response:', data);
        
        if (data && isMounted) {
          let recs = data.recommendations || [];
          if (priority === 'trending') {
            recs = [...recs].sort((a, b) => {
              const aTrending = (a.featuredTypes || []).includes('trending') || a.featuredType === 'trending';
              const bTrending = (b.featuredTypes || []).includes('trending') || b.featuredType === 'trending';
              if (aTrending && !bTrending) return -1;
              if (!aTrending && bTrending) return 1;
              return b.relevanceScore - a.relevanceScore;
            });
          }
          setRecommendations(recs);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError' && isMounted) {
          console.error('Error fetching product recommendations:', error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRecommendations();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [productId]);

  if (loading || recommendations.length === 0) {
    return null;
  }
 

  return (
    <div className="mt-12 border-t border-neutral-200 dark:border-neutral-800 pt-8">
      <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">
        {priority === 'trending' ? 'Trending Now' : 'You Might Also Like'}
      </h2>

      {(() => {
        const productTypeOrder = ['physical', 'digital', 'service', 'hybrid'] as const;
        const productTypeLabels: Record<string, string> = {
          physical: 'Physical Products',
          digital: 'Digital Products',
          service: 'Service Products',
          hybrid: 'Hybrid Products',
        };
        const grouped = productTypeOrder.reduce((acc, pt) => {
          acc[pt] = recommendations.filter(p => (p.productType || 'physical') === pt);
          return acc;
        }, {} as Record<string, typeof recommendations>);
        const otherProducts = recommendations.filter(p => {
          const pt = p.productType || 'physical';
          return !productTypeOrder.includes(pt as any);
        });

        return (
          <div className="space-y-8">
            {productTypeOrder.map(pt => {
              const group = grouped[pt];
              if (!group || group.length === 0) return null;
              return (
                <div key={pt}>
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">{productTypeLabels[pt]}</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {group.map((product) => {
                      return (
                        <SmartProductCard
                          key={product.id}
                          tenantId={product.tenantId}
                          product={{
                            id: product.id,
                            sku: product.id,
                            name: product.name,
                            title: product.title,
                            brand: product.brand,
                            priceCents: product.priceCents,
                            salePriceCents: product.salePriceCents ?? undefined,
                            stock: 999,
                            imageUrl: product.imageUrl,
                            tenantId: product.tenantId,
                            availability: 'in_stock',
                            has_active_payment_gateway: product.has_active_payment_gateway,
                            payment_gateway_type: product.payment_gateway_type,
                            productCategory: product.productCategory,
                            productCategorySlug: product.productCategorySlug,
                            featuredType: product.featuredType,
                            featuredTypes: product.featuredTypes || (product.featuredType ? [product.featuredType] : []),
                            productType: product.productType || 'physical',
                          }}
                          tenantName=""
                          hasActivePaymentGateway={product.has_active_payment_gateway}
                          defaultGatewayType={product.payment_gateway_type || undefined}
                          variant="compact"
                          showCategory={true}
                          showDescription={false}
                          className="h-full"
                          tenantSlug={product.tenantSlug || ''}
                          productCategory={product.productCategory}
                          productCategorySlug={product.productCategorySlug}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {otherProducts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">Other Products</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {otherProducts.map((product) => {
                    return (
                      <SmartProductCard
                        key={product.id}
                        tenantId={product.tenantId}
                        product={{
                          id: product.id,
                          sku: product.id,
                          name: product.name,
                          title: product.title,
                          brand: product.brand,
                          priceCents: product.priceCents,
                          salePriceCents: product.salePriceCents ?? undefined,
                          stock: 999,
                          imageUrl: product.imageUrl,
                          tenantId: product.tenantId,
                          availability: 'in_stock',
                          has_active_payment_gateway: product.has_active_payment_gateway,
                          payment_gateway_type: product.payment_gateway_type,
                          productCategory: product.productCategory,
                          productCategorySlug: product.productCategorySlug,
                          featuredType: product.featuredType,
                          featuredTypes: product.featuredTypes || (product.featuredType ? [product.featuredType] : []),
                          productType: product.productType || 'physical',
                        }}
                        tenantName=""
                        hasActivePaymentGateway={product.has_active_payment_gateway}
                        defaultGatewayType={product.payment_gateway_type || undefined}
                        variant="compact"
                        showCategory={true}
                        showDescription={false}
                        className="h-full"
                        tenantSlug={product.tenantSlug || ''}
                        productCategory={product.productCategory}
                        productCategorySlug={product.productCategorySlug}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Browse More Link */}
      {recommendations.length >= 6 && (
        <div className="mt-8 text-center">           
          <Button    onClick={() => window.location.href = `/tenant/${tenantSlug ? tenantSlug : tenantId}`}
                          variant="gradient" style={{ color: 'white' }} size='lg'
                          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm whitespace-nowrap"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          Browse All Our Products
          </Button>
        </div>
      )}
    </div>
  );
}
