"use client";

import { useEffect, useState } from 'react';
import { UnifiedStoreCard } from './UnifiedStoreCard';
import { Skeleton } from '@/components/ui';

interface RelatedStore {
  id: string;
  tenantId: string;
  businessName: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  logoUrl?: string;
  primaryCategory?: string;
  ratingAvg: number;
  ratingCount: number;
  productCount: number;
  isFeatured: boolean;
  subscriptionTier: string;
  useCustomWebsite: boolean;
  website?: string;
  businessHours?: any;
}

interface RelatedStoresProps {
  currentSlug: string;
  title?: string;
  limit?: number;
}

export default function RelatedStores({ 
  currentSlug, 
  title = "Similar Stores You Might Like",
  limit = 6 
}: RelatedStoresProps) {
  const [stores, setStores] = useState<RelatedStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRelatedStores = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/api/directory/${currentSlug}/related?limit=${limit}`);

        if (!res.ok) {
          throw new Error('Failed to fetch related stores');
        }

        const data = await res.json();
        // Map API response to expected format (snake_case to camelCase)
        const mappedStores = (data.related || []).map((store: any) => ({
          id: store.id,
          tenantId: store.tenantId,
          businessName: store.business_name || store.businessName,
          slug: store.slug,
          address: store.address,
          city: store.city,
          state: store.state,
          phone: store.phone,
          logoUrl: store.logoUrl || store.logo_url,
          primaryCategory: store.primaryCategory || store.primary_category,
          ratingAvg: store.ratingAvg || store.rating_avg || 0,
          ratingCount: store.ratingCount || store.rating_count || 0,
          productCount: store.productCount || store.product_count || 0,
          isFeatured: store.isFeatured || store.is_featured || false,
          subscriptionTier: store.subscriptionTier || store.subscription_tier || 'trial',
          useCustomWebsite: store.useCustomWebsite || store.use_custom_website || false,
          website: store.website,
          businessHours: store.businessHours || store.business_hours,
          directoryPublished: store.isPublished !== false, // Published stores from related API are in directory
        }));
        setStores(mappedStores);
      } catch (err) {
        console.error('Error fetching related stores:', err);
        setError('Failed to load related stores');
      } finally {
        setLoading(false);
      }
    };

    fetchRelatedStores();
  }, [currentSlug, limit]);

  // Don't render if no stores
  if (!loading && stores.length === 0) {
    return null;
  }

  // Don't render if error
  if (error) {
    return null;
  }

  return (
    <div className="bg-white border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {title}
        </h2>

        {loading ? (
          // Loading skeleton
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="w-full aspect-video rounded-lg" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          // Store grid
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store, index) => (
              <UnifiedStoreCard
                key={`${store.tenantId}-${store.primaryCategory || 'general'}-${index}`}
                listing={store}
                viewMode="grid"
                linkType="directory"
              />
            ))}
          </div>
        )}

        {!loading && stores.length > 0 && (
          <div className="mt-8 text-center">
            <a
              href="/directory"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse All Stores
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export { RelatedStores };
