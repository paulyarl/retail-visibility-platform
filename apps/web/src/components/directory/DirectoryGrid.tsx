"use client";

import { StoreList, StoreData } from '@/components/stores';
import { LinkType } from '../stores/StoreCard';


interface DirectoryListing {
  id: string;
  tenantId: string;
  businessName: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  primaryCategory?: string;
  gbpPrimaryCategoryName?: string;
  category?: {
    name: string;
    slug: string;
    icon?: string;
  };
  logoUrl?: string;
  bannerUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
  productCount?: number | string; // API may return string
  isFeatured?: boolean;
  subscriptionTier?: string;
  directoryPublished?: boolean;
  businessHours?: any;
}

interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

interface DirectoryGridProps {
  listings: DirectoryListing[];
  loading?: boolean;
  isLoading?: boolean;
  viewMode?: 'grid' | 'list';
  pagination?: Pagination;
  baseUrl?: string;
  categorySlug?: string;
}


// Transform directory listing to store data format
function transformListing(listing: DirectoryListing): StoreData {
  // console.log(`transformListing: ${listing.businessName}`, listing);
  return {
    id: listing.id,
    tenantId: listing.tenantId,
    name: listing.businessName,
    slug: listing.slug,
    address: listing.address,
    city: listing.city,
    state: listing.state,
    zipCode: listing.zipCode,
    latitude: listing.latitude,
    longitude: listing.longitude,
    logoUrl: listing.logoUrl,
    bannerUrl: listing.bannerUrl,
    primaryCategory: listing.category?.name || listing.primaryCategory || listing.gbpPrimaryCategoryName,
    ratingAvg: listing.ratingAvg,
    ratingCount: listing.ratingCount,
    productCount: Number(listing.productCount) || 0,
    isFeatured: listing.isFeatured,
    subscriptionTier: listing.subscriptionTier,
    businessHours: listing.businessHours,
  };
}

export default function DirectoryGrid({ 
  listings, 
  loading,
  isLoading = false, 
  viewMode = 'grid', 
  pagination,
  baseUrl = '', 
  categorySlug = '' 
}: DirectoryGridProps) {
  // Transform listings to store data format
  const stores = listings.map(transformListing);
  // console.log(`DirectoryGrid: ${stores.length} stores`, stores);
  
  // Use either loading prop
  const showLoading = loading || isLoading;

  return (
    <>
      <StoreList
        stores={stores}
        viewMode={viewMode}
        linkType={LinkType.Directory}
        showLogo={true}
        showCategories={true}
        maxCategories={3}
        loading={showLoading}
      />

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {/* Previous Button */}
          {pagination.page > 1 && (
            <a
              href={`${baseUrl}${categorySlug ? `/${categorySlug}` : ''}?page=${pagination.page - 1}`}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Previous
            </a>
          )}

          {/* Page Numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              
              return (
                <a
                  key={pageNum}
                  href={`${baseUrl}${categorySlug ? `/${categorySlug}` : ''}?page=${pageNum}`}
                  className={`px-4 py-2 text-sm font-medium rounded-lg ${
                    pageNum === pagination.page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </a>
              );
            })}
          </div>

          {/* Next Button */}
          {pagination.page < pagination.totalPages && (
            <a
              href={`${baseUrl}${categorySlug ? `/${categorySlug}` : ''}?page=${pagination.page + 1}`}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Next
            </a>
          )}
        </div>
      )}
    </>
  );
}


export { DirectoryGrid };
