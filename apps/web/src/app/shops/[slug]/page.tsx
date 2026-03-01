/**
 * Shop Profile Page
 * Professional public shop profile with exceptional user experience
 * Leverages existing platform assets and provides bi-directional navigation
 */

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Store, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ShopProfileClient from './ShopProfileClient';
import { ShopsAPISingleton, shopsService } from '@/services/ShopsService';

// Types
interface ShopData {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  business_name?: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  website?: string;
  rating_avg?: number;
  rating_count?: number;
  productCount: number;
  is_published: boolean;
  primary_category?: string;
  created_at: Date;
  tenantName?: string;
  tenantLogoUrl?: string;
  latitude?: number;
  longitude?: number;
}

interface Shop {
  success: boolean;
  data: ShopData;
}

interface ShopResponse {
  success: boolean;
  data: {
    success: boolean;
    data: ShopData;
  };
}

interface ShopProfilePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ 
    page?: string; 
    search?: string; 
    category?: string; 
    featured?: string;
    view?: string;
  }>;
}

// Shop data fetching function
export async function getShopBySlug(identifier: string): Promise<ShopResponse | null> {
  try {
    console.log('[getShopBySlug] Starting fetch for identifier:', identifier);
    
    // Use shopsService for consistent API communication and caching
    const response = await shopsService.getShopByIdentifier(identifier);
    
    /* console.log('[getShopBySlug] ShopsService response:', {
      hasResponse: !!response,
      responseKeys: response ? Object.keys(response) : 'null',
      hasTenantId: !!response?.tenantId,
      tenantId: response?.tenantId,
      shopName: response?.name
    }); */
    
    if (response) {
      // Wrap the shop data in the expected triple-nested ShopResponse structure
      const wrappedResponse = {
        success: true,
        data: {
          success: true,
          data: response as unknown as ShopData
        }
      };
      
     /*  console.log('[getShopBySlug] Returning wrapped response:', {
        success: wrappedResponse.success,
        hasData: !!wrappedResponse.data,
        hasInnerData: !!wrappedResponse.data?.data,
        innerDataTenantId: wrappedResponse.data?.data?.tenantId
      }); */
      
      return wrappedResponse;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching shop:', error);
    return null;
  }
}

// Loading skeleton component
function ShopProfileSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Hero Section Skeleton */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-start space-x-6">
                <div className="h-24 w-24 bg-gray-200 rounded-lg animate-pulse" />
                <div className="flex-1 space-y-3">
                  <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                  <div className="flex items-center space-x-4">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
              <div className="h-20 w-full bg-gray-200 rounded animate-pulse" />
            </div>
            <div>
              <div className="h-64 w-full bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <div className="h-12 w-full bg-gray-200 rounded animate-pulse mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 w-full bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
          <div>
            <div className="h-64 w-full bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default async function ShopProfilePage({ params, searchParams }: ShopProfilePageProps) {
  const { slug } = await params;
  
  //console.log('[ShopProfilePage] Page component called with slug:', slug);
  
  // Fetch shop data
  const shop = await getShopBySlug(slug);
  
  /* console.log('[ShopProfilePage] Shop data received:', {
    hasShop: !!shop,
    shopSuccess: shop?.success,
    hasShopData: !!shop?.data,
    shopDataSuccess: shop?.data?.success,
    hasInnerData: !!shop?.data?.data,
    innerDataTenantId: shop?.data?.data?.tenantId
  }); */
  
  // If no shop found, show not found page
  if (!shop || !shop.success || !shop.data || !shop.data.success || !shop.data.data) {
    console.log('[ShopProfilePage] Showing not found page');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Store className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Shop Not Found</h1>
          <p className="text-gray-600 mb-6">
            The shop you're looking for doesn't exist or hasn't been set up yet.
          </p>
          <Link href="/shops" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Shops
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <Suspense fallback={<ShopProfileSkeleton />}>
      <ShopProfileClient shop={shop} />
    </Suspense>
  );
}

