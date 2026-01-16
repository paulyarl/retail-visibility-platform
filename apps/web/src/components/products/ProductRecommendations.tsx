'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SmartProductCard from './SmartProductCard';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';

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
}

interface ProductRecommendationsProps {
  productId: string;
  tenantId: string;
}

export function ProductRecommendations({ productId, tenantId }: ProductRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/api/recommendations/for-product-page/${productId}?limit=6`);

        if (response.ok) {
          const data = await response.json();
          setRecommendations(data.recommendations || []);
        }
      } catch (error) {
        console.error('Error fetching product recommendations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
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
        {recommendations.map((product) => (
          <TenantPaymentProvider key={product.id} tenantId={product.tenantId}>
            <SmartProductCard
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
              }}
              tenantName=""
              variant="compact"
              showCategory={false}
              showDescription={false}
              className="h-full"
            />
          </TenantPaymentProvider>
        ))}
      </div>

      {/* Browse More Link */}
      {recommendations.length >= 6 && (
        <div className="mt-8 text-center">
          <Link
            href={`/tenant/${tenantId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse All Products →
          </Link>
        </div>
      )}
    </div>
  );
}
