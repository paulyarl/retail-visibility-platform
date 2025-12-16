'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
          <Link
            key={`${rec.tenantId}-${index}`}
            href={`/directory/${rec.slug}`}
            className="block p-6 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-green-500 dark:hover:border-green-400 transition-all hover:shadow-lg"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white text-lg">
                  {rec.businessName}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {rec.address}
                </p>
                <p className="text-sm text-neutral-500">
                  {rec.city}, {rec.state}
                  {rec.distance && ` • ${rec.distance} mi`}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-green-600 font-medium bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                {rec.reason}
              </p>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
