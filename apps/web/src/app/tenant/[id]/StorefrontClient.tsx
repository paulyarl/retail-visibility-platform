'use client';

import { useState, useEffect } from 'react';
import { UnifiedStoreCard } from '@/components/directory/UnifiedStoreCard';

// Storefront Recommendations Component
export function StorefrontRecommendations({ tenantId }: { tenantId: string }) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/api/recommendations/for-storefront/${tenantId}`);
        const data = await response.json();
        // API returns nested structure: { recommendations: [{ type, title, recommendations: [...stores] }] }
        // Flatten to get the actual store recommendations
        const allStores = (data.recommendations || []).flatMap(
          (group: any) => group.recommendations || []
        );
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
