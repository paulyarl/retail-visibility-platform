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
import { shopsService } from '@/services/ShopsService';
import { tenantPublicService } from '@/services/TenantPublicService';
import { publicDirectoryService } from '@/services/PublicDirectoryService';
import { unifiedCapabilityService } from '@/services/UnifiedCapabilityService';
import { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';
import { publicFaqService } from '@/services/PublicFaqService';
import { PublicFaqOptionsFlags } from '@/services/CapabilityResolutionService';
import { StorefrontStatusPanel } from '@/components/storefront/StorefrontStatusPanel';

// Types
interface ShopData {
  id: string;
  name: string;
  slug: string;
  business_name?: string;
  imageUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  location?: string;
  phone?: string;
  email?: string;
  website?: string;
  social_links?: any;
  default_gateway_type?: string;
  has_active_payment_gateway?: boolean;
  rating?: number;
  rating_count?: number;
  productCount: number;
  is_published: boolean;
  primary_category?: string;
  created_at: string;
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

// Shop data fetching function using singleton service
export async function getShopBySlug(identifier: string): Promise<ShopResponse | null> {
  try {
    // Use shopsService singleton for caching and optimization benefits
    // console.log('[getShopBySlug] Fetching shop for identifier:', identifier);
    const shop = await shopsService.getShopByIdentifier(identifier);
    // console.log('[getShopBySlug] Shop:', shop);
    
    if (!shop) {
      return null;
    }
    
    // Wrap the shop data in the expected triple-nested ShopResponse structure
    return {
      success: true,
      data: {
        success: true,
        data: shop as unknown as ShopData
      }
    };
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

  // First, resolve tenant ID and fetch tenant info from base tables
  // This works even when MV excludes non-active tenants
  let businessHours = null;
  let tenantInfo = null;
  let tenantId: string | null = null;

  try {
    tenantId = await publicDirectoryService.resolveBySlug(slug);
    if (tenantId) {
      businessHours = await tenantPublicService.getBusinessHours(tenantId);
      tenantInfo = await tenantPublicService.getPublicTenantInfo(tenantId);
    }
  } catch (error) {
    console.error('Error fetching tenant info:', error);
  }

  // Fetch storefront option flags server-side (prioritized — no client waterfall)
  let storefrontOptionFlags: StorefrontOptionFlags | null = null;
  try {
    if (tenantId) {
      storefrontOptionFlags = await unifiedCapabilityService.getStorefrontOptionFlags(tenantId);
    }
  } catch (error) {
    console.error('Error fetching storefront option flags:', error);
  }

  // Fetch FAQ options flags server-side (no client waterfall)
  let faqOptionsFlags: PublicFaqOptionsFlags | null = null;
  try {
    if (tenantId) {
      faqOptionsFlags = await unifiedCapabilityService.getFaqOptionsFlags(tenantId);
    }
  } catch (error) {
    console.error('Error fetching FAQ options flags:', error);
  }

  // Check if tenant has non-active status - show status panel instead of "not found"
  const showStatusPanel = tenantInfo ? (
    tenantInfo.subscriptionTier === 'google_only' || 
    tenantInfo.subscriptionTier === 'discovery' ||
    (tenantInfo.locationStatus && tenantInfo.locationStatus !== 'active') ||
    (tenantInfo.statusInfo && !tenantInfo.statusInfo.showStorefront) ||
    tenantInfo.showSubscriptionPanel === true
  ) : false;

  // For non-active tenants, construct minimal shop object from tenantInfo
  // This allows full page layout with status panel
  if (showStatusPanel && tenantInfo) {
    const profileData = tenantInfo.profileData || {};
    const minimalShopData: ShopData = {
      id: tenantInfo.id,
      name: tenantInfo.name,
      slug: tenantInfo.slug || slug,
      business_name: profileData.business_name || tenantInfo.name,
      imageUrl: profileData.logo_url,
      address: profileData.address_line1,
      city: profileData.city,
      state: profileData.state,
      zip_code: profileData.postal_code,
      location: `${profileData.city || ''}${profileData.city && profileData.state ? ', ' : ''}${profileData.state || ''}`,
      phone: profileData.phone_number,
      email: profileData.email,
      website: profileData.website,
      productCount: 0,
      is_published: tenantInfo.hasDirectory,
      primary_category: tenantInfo.directoryData?.primary_category,
      created_at: tenantInfo.createdAt,
    };

    const minimalShopResponse: ShopResponse = {
      success: true,
      data: {
        success: true,
        data: minimalShopData
      }
    };

    return (
      <Suspense fallback={<ShopProfileSkeleton />}>
        <ShopProfileClient
          shop={minimalShopResponse}
          businessHours={businessHours?.data}
          tenantInfo={tenantInfo}
          showStatusPanel={true}
          initialOptFlags={storefrontOptionFlags}
          initialFaqFlags={faqOptionsFlags}
        />
      </Suspense>
    );
  }

  // Fetch shop data from MV (only for active tenants)
  const shop = await getShopBySlug(slug);

  // If no shop found and no status panel, show not found page
  if (!shop || !shop.success || !shop.data || !shop.data.success || !shop.data.data) {
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
      <ShopProfileClient 
        shop={shop} 
        businessHours={businessHours?.data} 
        tenantInfo={tenantInfo}
        showStatusPanel={showStatusPanel}
        initialOptFlags={storefrontOptionFlags}
        initialFaqFlags={faqOptionsFlags}
      />
    </Suspense>
  );
}

