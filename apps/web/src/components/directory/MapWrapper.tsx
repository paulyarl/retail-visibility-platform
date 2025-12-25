"use client";

import DirectoryMap from '@/components/directory/DirectoryMap';

interface MapWrapperProps {
  listings: Array<{
    id: string;
    businessName: string;
    slug: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    logoUrl?: string;
    ratingAvg: number;
    productCount: number;
  }>;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function MapWrapper({ listings }: MapWrapperProps) {
  return <DirectoryMap listings={listings} />;
}
