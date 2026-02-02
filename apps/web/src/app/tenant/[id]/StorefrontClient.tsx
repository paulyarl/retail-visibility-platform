'use client';

import { useState, useEffect } from 'react';
import { UnifiedStoreCard } from '@/components/directory/UnifiedStoreCard';
import { recommendationsService } from '@/services/RecommendationsSingletonService';


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

// Storefront Recommendations Component
export function StorefrontRecommendations({ tenantId }: { tenantId: string }) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        // Use singleton service for cached recommendations
        const allStores = await recommendationsService.getStorefrontRecommendations(tenantId);
        setRecommendations(allStores);
      } catch (error) {
        console.error('Error fetching storefront recommendations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [tenantId]);

  if (loading || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 border-t border-neutral-200 dark:border-neutral-800 pt-8">
      <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">
        You Might Also Like
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((rec, index) => (
          <UnifiedStoreCard
            key={`${rec.tenantId}-${index}`}
            listing={{
              id: rec.id || rec.tenantId,
              tenantId: rec.tenantId,
              businessName: rec.businessName,
              slug: rec.slug,
              address: rec.address,
              city: rec.city,
              state: rec.state,
              primaryCategory: rec.primaryCategory,
              logoUrl: rec.logoUrl,
              ratingAvg: rec.ratingAvg,
              ratingCount: rec.ratingCount,
              productCount: rec.productCount,
              businessHours: rec.businessHours,
              reason: rec.reason
            }}
            viewMode="grid"
            linkType="storefront"
          />
        ))}
      </div>
    </div>
  );
}
