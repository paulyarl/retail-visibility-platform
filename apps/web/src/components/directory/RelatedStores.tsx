"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UnifiedStoreCard } from './UnifiedStoreCard';
import { Skeleton } from '@/components/ui';
import { directoryService } from '@/services/DirectorySingletonService';

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
        const data = await directoryService.getRelatedStores(currentSlug, limit);
        
        // Ensure data is always an array
        const dataArray = Array.isArray(data) ? data : [];
        
        // Map API response to expected format (snake_case to camelCase)
        const mappedStores = dataArray.map((store: any) => ({
          id: store.id,
          tenantId: store.tenantId,
          businessName: store.business_name || store.businessName,
          slug: store.slug,
          address: store.address,
          city: store.city,
          state: store.state,
          phone: store.phone,
          logoUrl: store.logo_url || store.logoUrl,
          primaryCategory: store.primary_category || store.primaryCategory,
          ratingAvg: store.rating_avg || store.ratingAvg || 0,
          ratingCount: store.rating_count || store.ratingCount || 0,
          distance: store.distance,
          isVerified: store.is_verified || store.isVerified,
          isFeatured: store.is_featured || store.isFeatured,
          productCount: store.product_count || store.productCount || 0,
          subscriptionTier: store.subscription_tier || store.subscriptionTier || 'basic',
          useCustomWebsite: store.use_custom_website || store.useCustomWebsite || false
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {title}
          </h2>
          <Link
            href="/directory"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Browse All Stores →
          </Link>
        </div>

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
