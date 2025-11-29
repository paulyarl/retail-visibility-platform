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

export default function MapWrapper({ listings }: MapWrapperProps) {
  console.log('[MapWrapper] Listings passed to map:', listings);
  return <DirectoryMap listings={listings} />;
}
