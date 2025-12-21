'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="group block bg-white dark:bg-neutral-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
          >
            {/* Product Image */}
            <div className="relative aspect-square bg-gray-100 dark:bg-gray-700">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="p-4">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-white line-clamp-2 mb-1">
                {product.title}
              </h3>

              {product.brand && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  {product.brand}
                </p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-neutral-900 dark:text-white">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: product.currency,
                  }).format(product.price)}
                </span>

                {product.relevanceScore >= 4 && (
                  <span className="text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                    Great Match
                  </span>
                )}
              </div>
            </div>
          </Link>
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
