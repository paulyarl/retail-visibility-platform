'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SmartProductCard from './SmartProductCard';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import { recommendationsService } from '@/services/RecommendationsSingletonService';

interface RecommendedProduct {
  id: string;
  name: string;
  title: string;
  price: number;
  currency: string;
  imageUrl?: string;
  brand?: string;
  relevanceScore: number;
  tenantId: string;
  has_active_payment_gateway?: boolean;
  payment_gateway_type?: string | null;
  tenantSlug?: string;
}

interface ProductRecommendationsProps {
  productId: string;
  tenantId: string;
  tenantSlug?: string;
}

export function ProductRecommendations({ productId, tenantId, tenantSlug }: ProductRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abortController = new AbortController();
    let isMounted = true;

    const fetchRecommendations = async () => {
      try {
        const data = await recommendationsService.getProductPageRecommendations(productId, 6);
        
        if (data && isMounted) {
          setRecommendations(data.recommendations || []);
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
        You Might Also Like
      </h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((product) => { 
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
                priceCents: Math.round(product.price * 100),
                stock: 999,
                imageUrl: product.imageUrl,
                tenantId: product.tenantId,
                availability: 'in_stock',
                has_active_payment_gateway: product.has_active_payment_gateway,
                payment_gateway_type: product.payment_gateway_type,
              }}
              tenantName=""
              hasActivePaymentGateway={product.has_active_payment_gateway}
              defaultGatewayType={product.payment_gateway_type || undefined}
              variant="compact"
              showCategory={false}
              showDescription={false}
              className="h-full"
              tenantSlug={product.tenantSlug || ''}
            />
          );
        })}
      </div>

      {/* Browse More Link */}
      {recommendations.length >= 6 && (
        <div className="mt-8 text-center">
          <Link
            href={tenantSlug ? `/shops/${tenantSlug}` : `/tenant/${tenantId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse All Our Products →
          </Link>
        </div>
      )}
    </div>
  );
}
