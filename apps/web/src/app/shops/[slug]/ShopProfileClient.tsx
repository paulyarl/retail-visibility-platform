/**
 * Shop Profile Client Component
 * Handles interactive parts of the (shop.data as any)?.data?.data profile page
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Separator } from '@/components/ui/Separator';
import { Skeleton } from '@/components/ui/Skeleton';
import { 
  MapPin, 
  Phone, 
  Globe, 
  Clock, 
  Star, 
  Package,
  ShoppingBag,
  ArrowLeft,
  Share2,
  Heart,
  ExternalLink,
  CheckCircle,
  Store,
  TrendingUp,
  ArrowRight,
  Grid,
  Sparkles
} from 'lucide-react';

// Import existing components from tenant page
import ProductSearch from '@/components/storefront/ProductSearch';
import StorefrontMap from '@/components/storefront/StorefrontMap';
import StorefrontActions from '@/components/products/StorefrontActions';
import { StoreRatingDisplay } from '@/components/reviews/StoreRatingDisplay';
import ContactInformationCollapsible from '@/components/storefront/ContactInformationCollapsible';
import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';
import LastViewed from '@/components/directory/LastViewed';
import StorefrontFeaturedProducts from '@/components/storefront/StorefrontFeaturedProducts';
import { ShopViewTracker } from '@/components/tracking/ShopViewTracker';
import DirectoryPhotoGalleryDisplay from '@/components/directory/DirectoryPhotoGalleryDisplay';
import { directoryService } from '@/services/DirectorySingletonService';
import { directoryListingService } from '@/services/DirectoryListingSingletonService';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import StoreStatusIndicator from '@/components/storefront/StoreStatusIndicator';

// Types
interface DirectoryConsolidated {
  listing: {
    id: string;
    tenantId: string;
    businessName: string;
    business_name?: string;
    slug: string;
    description?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    email?: string;
    phone?: string;
    website?: string;
    logoUrl?: string;
    isFeatured?: boolean;
    isPublished?: boolean;
    subscriptionTier?: string; // Add missing property
    productCount?: number;
    ratingAvg?: number;
    ratingCount?: number;
    categories?: any[];
    keywords?: string[];
    isVerified?: boolean;
    coordinates?: {
      lat: number;
      lng: number;
    };
    businessHours?: any;
  };
  storeTypes: any[];
  categoryCounts: any[];
  recommendations: any[];
  featuredProducts: any[];
  randomFeaturedProducts?: any[]; // Add missing property
  paymentGatewayStatus: {
    hasActiveGateway: boolean;
    defaultGatewayType?: string;
  };
}

interface ShopData {
  tenantId: string;
  name: string;
  slug: string;
  business_name?: string;
  imageUrl?: string;
  logo_url?: string;
  bannerUrl?: string;
  tenantLogoUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  website?: string;
  rating?: number;
  rating_count?: number;
  productCount: number;
  is_published: boolean;
  primary_category?: string;
  category?: string;
  created_at: Date;
  tenantName?: string;
  latitude?: number;
  longitude?: number;
  contact?: {
    email: string;
    phone: string;
    website: string;
  };
  hours?: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  description?: string;
}

interface Shop {
  success: boolean;
  data: ShopData;
}

interface ShopResponse {
  success: boolean;
  data: Shop;
}

interface ShopProfileClientProps {
  shop: {
    success: boolean;
    data: {
      success: boolean;
      data: ShopData;
    };
  };
}

// Shop profile header component
function ShopProfileHeader({ shop, shopData }: { 
  shop: {
    success: boolean;
    data: {
      success: boolean;
      data: ShopData;
    };
  };
  shopData: ShopData;
}) {
  // Create a directory listing object from shop data for the photo gallery
  const directoryListing = shopData ? {
    id: shopData.tenantId,
    tenantId: shopData.tenantId,
    name: shopData.name,
    description: shopData.description,
    imageUrl: shopData.imageUrl,
    logo_url: shopData.logo_url,
    bannerUrl: shopData.bannerUrl,
    // Add any other required fields for the photo gallery
  } : null;

  // Check if shop data exists and is valid
  if (!shop || !shop.success || !shopData || !shopData.tenantId) {
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
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Shop Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-start space-x-6">
              {/* Shop Logo */}
              <div className="relative">
                <div className="h-24 w-24 bg-white rounded-lg shadow-md flex items-center justify-center overflow-hidden">
                  {(directoryListing?.logo_url || shopData?.logo_url || shopData?.bannerUrl || shopData?.tenantLogoUrl || shopData?.imageUrl) ? (
                    <img
                      src={directoryListing?.logo_url || shopData?.logo_url || shopData?.bannerUrl || shopData?.tenantLogoUrl || shopData?.imageUrl}
                      alt={shopData?.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      <Store className="h-12 w-12" />
                    </div>
                  )}
                </div>
                {shopData?.is_published && (
                  <div className="absolute -top-2 -right-2">
                    <CheckCircle className="h-6 w-6 text-green-500 bg-white rounded-full" />
                  </div>
                )}
              </div>

              {/* Shop Details */}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">{shopData.name}</h1>
                  {shopData.is_published && (
                    <Badge variant="success" className="text-xs">
                      Verified
                    </Badge>
                  )}
                </div>

                {shopData.business_name && shopData.business_name !== shopData.name && (
                  <p className="text-lg text-gray-600 mb-3">{shopData.business_name}</p>
                )}

                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  {shopData.rating && (
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="font-medium">{shopData.rating.toFixed(1)}</span>
                      {shopData.rating_count && (
                        <span className="text-gray-500">({shopData.rating_count} reviews)</span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-1">
                    <Package className="h-4 w-4" />
                    <span>{shopData.productCount} products</span>
                  </div>

                  {shopData.primary_category||shopData.category && (
                    <Badge variant="default" className="text-xs">
                      {shopData.primary_category||shopData.category}
                    </Badge>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 mt-4">
                  <StorefrontActions 
                    tenantId={shopData.tenantId}
                    businessName={shopData.name}
                  />
                  
                  <Button variant="outline" size="sm">
                    <Heart className="h-4 w-4 mr-2" />
                    Save Shop
                  </Button>
                  
                  <Button variant="outline" size="sm">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            </div>

            {/* Shop Description */}
            {shopData.tenantName && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-gray-700 leading-relaxed">
                    Welcome to {shopData.name}! We're proud to be part of the {shopData.tenantName} family,
                    offering carefully curated products and exceptional service.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Contact Information */}
            {(shopData.contact?.phone || shopData.contact?.website) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {shopData.contact?.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <a href={`tel:${shopData.contact.phone}`} className="text-blue-600 hover:underline">
                          {shopData.contact.phone}
                        </a>
                      </div>
                    )}
                    
                    {shopData.contact?.email && (
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <a href={`mailto:${shopData.contact.email}`} className="text-blue-600 hover:underline">
                          {shopData.contact.email}
                        </a>
                      </div>
                    )}
                    
                    {shopData.contact?.website && (
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <a 
                          href={shopData.contact.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {shopData.contact.website}
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Photo Gallery */}
            {directoryListing && (
              <DirectoryPhotoGalleryDisplay listing={directoryListing} />
            )}

            {/* Business Hours */}
            {shopData.hours && typeof shopData.hours === 'object' && 
             !('timezone' in shopData.hours) && Object.keys(shopData.hours).some(key => 
               ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(key.toLowerCase())
             ) && (
              <BusinessHoursCollapsible businessHours={{
                periods: Object.entries(shopData.hours as Record<string, string>).map(([day, hours]) => {
                  // Skip if hours is not a string or doesn't contain expected format
                  if (typeof hours !== 'string' || !hours.includes(' - ')) {
                    return null;
                  }
                  
                  const [open, close] = hours.split(' - ');
                  const convertTo24Hour = (time12: string): string => {
                    if (!time12 || time12 === 'Closed') return '00:00';
                    
                    // Handle different time formats
                    const timeParts = time12.trim().split(' ');
                    if (timeParts.length !== 2) return '00:00';
                    
                    const [time, period] = timeParts;
                    const timeComponents = time.split(':');
                    
                    // Validate time components
                    if (timeComponents.length !== 2) return '00:00';
                    
                    const [h, m] = timeComponents.map(Number);
                    if (isNaN(h) || isNaN(m)) return '00:00';
                    if (!period || (period !== 'AM' && period !== 'PM')) return '00:00';
                    
                    const hour24 = period === 'PM' && h !== 12 ? h + 12 : period === 'AM' && h === 12 ? 0 : h;
                    return `${hour24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                  };
                  
                  return {
                    open_day: day.charAt(0).toUpperCase() + day.slice(1),
                    close_day: day.charAt(0).toUpperCase() + day.slice(1),
                    open_time: convertTo24Hour(open),
                    close_time: convertTo24Hour(close)
                  };
                }).filter(Boolean) // Filter out null entries
              }} />
            )}
          </div>

          {/* Sidebar - 1/3 width */}
          <div className="space-y-6">
            {shopData.address && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <StorefrontMap
                      tenant={{
                        id: shopData.tenantId,
                        businessName: shopData.name,
                        slug: shopData.slug,
                        metadata: {
                          address: shopData.address,
                          city: shopData.city,
                          state: shopData.state,
                          zip_code: shopData.zip_code,
                          zipCode: shopData.zip_code,
                          logo_url: shopData.imageUrl,
                          latitude: shopData.latitude,
                          longitude: shopData.longitude
                        }
                      }}
                      primaryCategory={shopData.primary_category||shopData.category}
                      productCount={shopData.productCount}
                    />
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <span className="text-gray-700">
                        {shopData.address}
                        {shopData.city && `, ${shopData.city}`}
                        {shopData.state && ` ${shopData.state}`}
                        {shopData.zip_code && ` ${shopData.zip_code}`}
                      </span>
                    </div>
                    
                    {shopData.contact?.phone && (
                      <div className="flex items-center space-x-2 mt-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <a href={`tel:${shopData.contact.phone}`} className="text-blue-600 hover:underline">
                          {shopData.contact.phone}
                        </a>
                      </div>
                    )}
                    
                    {shopData.contact?.website && (
                      <div className="flex items-center space-x-2 mt-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <a 
                          href={shopData.contact.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {shopData.contact.website}
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Shop Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{shopData.productCount}</div>
                    <div className="text-sm text-gray-600">Products</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {shopData.rating ? shopData.rating.toFixed(1) : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">
                      Rating {shopData.rating_count ? `(${shopData.rating_count} reviews)` : ''}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shop Description */}
            {shopData.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About Us</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 leading-relaxed">
                    {shopData.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Shop Profile Client Component
export default function ShopProfileClient({ shop }: {
  shop: {
    success: boolean;
    data: {
      success: boolean;
      data: ShopData;
    };
  };
}) {
  // Extract shop data once at the top
  const shopData = (shop.data as any)?.data;
  //console.log(shopData);
  // Check if shop data exists and is valid
  if (!shop || !shop.success || !shopData || !shopData.tenantId) {
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
    <div className="min-h-screen bg-gray-50">
      {/* Track shop page view */}
      <ShopViewTracker 
        tenantId={shopData.tenantId} 
        shopName={shopData.name}
        category={shopData.category || null}
        pageType="shop_detail"
      />
      {/* Navigation Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Navigation Links */}
              <div className="flex items-center gap-2">
                <Link 
                  href="/shops"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Store className="h-4 w-4" />
                  Shops
                </Link>
                <span className="text-gray-400">•</span>
                <Link 
                  href="/shops/directory"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Grid className="h-4 w-4" />
                  Directory
                </Link>
                <span className="text-gray-400">•</span>
                <Link 
                  href="/shops/featured"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Featured
                </Link>
                <span className="text-gray-400">•</span>
                <Link 
                  href="/shops/trending"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <TrendingUp className="h-4 w-4" />
                  Trending
                </Link>
                <span className="text-gray-400">•</span>
                <span className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 font-medium truncate max-w-[150px]">
                  {shopData.name}
                </span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <StoreStatusIndicator tenantId={shopData.tenantId} />
            </div>
            
            <div className="flex items-center space-x-2">
              <Link href={`/shops/directory${shopData.primary_category||shopData.category ? `?category=${encodeURIComponent(shopData.primary_category||shopData.category)}` : ''}`}>
                <Button variant="ghost" size="sm">
                  Similar Shops
                </Button>
              </Link>
              
              <Separator orientation="vertical" className="h-6" />
              
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-900">{shopData.location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ShopProfileHeader shop={shop} shopData={shopData} />

      {/* Products Section */}
      <div className="bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* Search Section - Full width */}
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Products</h2>
              <p className="text-gray-600">
                Browse our selection of {shopData.productCount} products
              </p>
            </div>

            {/* Product Search */}
            <div className="bg-white rounded-lg border shadow-sm">
              <ProductSearch 
                tenantId={shopData.tenantId}
              />
            </div>
          </div>

          {/* Featured Products - Centered with page margins */}
          <div className="mb-12">
            <StorefrontFeaturedProducts tenantId={shopData.tenantId} />
          </div>

          {/* Recently Viewed - Centered with page margins */}
          <div className="mb-12">
            <LastViewed />
          </div>
        </div>
      </div>
  {/* Platform Branding Footer */}
            <PoweredByFooter />
     
    </div>
  );
}
