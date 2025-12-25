"use client";

import dynamic from 'next/dynamic';

// Dynamically import Google Maps to avoid SSR issues
const DirectoryMapGoogle = dynamic(() => import('@/components/directory/DirectoryMapGoogle'), {
  ssr: false,
  loading: () => <div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">Loading map...</div>
});

interface StorefrontMapProps {
  tenant: {
    id: string;
    businessName: string;
    slug?: string;
    metadata?: {
      address?: string;
      city?: string;
      state?: string;
      zip_code?: string;
      zipCode?: string;
      latitude?: number;
      longitude?: number;
      logo_url?: string;
    };
  };
  primaryCategory?: string;
  productCount?: number;
}


export default function StorefrontMap({ tenant, primaryCategory, productCount }: StorefrontMapProps) {
  if (!tenant.metadata?.address || !tenant.metadata?.latitude || !tenant.metadata?.longitude) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
        Store Location
      </h3>
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <DirectoryMapGoogle
          listings={[{
            id: tenant.id,
            businessName: tenant.businessName,
            slug: tenant.slug || tenant.id,
            address: tenant.metadata.address,
            city: tenant.metadata.city,
            state: tenant.metadata.state,
            zipCode: tenant.metadata.zip_code || tenant.metadata.zipCode,
            latitude: tenant.metadata.latitude,
            longitude: tenant.metadata.longitude,
            logoUrl: tenant.metadata.logo_url,
            primaryCategory: primaryCategory,
            ratingAvg: 0,
            productCount: productCount || 0,
          }]}
          center={{
            lat: tenant.metadata.latitude,
            lng: tenant.metadata.longitude
          }}
          zoom={15}
        />
      </div>
    </div>
  );
}
