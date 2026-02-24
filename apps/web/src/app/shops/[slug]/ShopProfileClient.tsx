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
  TrendingUp
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
function ShopProfileHeader({ shop }: { shop: {
    success: boolean;
    data: {
      success: boolean;
      data: ShopData;
    };
  };
}) {
  const [directoryListing, setDirectoryListing] = useState<any>(null);
  
  // Get the URL slug from the window location
  const urlSlug = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';

  // Debug: Log the shop data structure
  console.log('[ShopProfile] Shop data:', shop);
  console.log('[ShopProfile] Shop keys:', Object.keys(shop));
  console.log('[ShopProfile] Shop data keys:', Object.keys(shop.data || {}));
  console.log('[ShopProfile] Shop data.data keys:', Object.keys((shop.data as any)?.data || {}));
  console.log('[ShopProfile] URL slug:', urlSlug);
  console.log('[ShopProfile] Shop data slug:', (shop.data as any)?.data?.data?.slug);
  console.log('[ShopProfile] Available logo fields:', {
    logo_url: (shop.data as any)?.data?.data?.logo_url,
    bannerUrl: (shop.data as any)?.data?.data?.bannerUrl,
    tenantLogoUrl: (shop.data as any)?.data?.data?.tenantLogoUrl,
    imageUrl: (shop.data as any)?.data?.data?.imageUrl
  });
  console.log('[ShopProfile] Contact data:', (shop.data as any)?.data?.data?.contact);
  console.log('[ShopProfile] Hours data:', (shop.data as any)?.data?.data?.hours);
  console.log('[ShopProfile] Description:', (shop.data as any)?.data?.data?.description);

  // Fetch directory listing data to get the listing ID for photos
  useEffect(() => {
    const fetchDirectoryListing = async () => {
      try {
        // Safety check: ensure URL slug exists
        if (!urlSlug) {
          console.log('[ShopProfile] No URL slug available, skipping directory listing fetch');
          return;
        }

        console.log('[ShopProfile] Fetching directory data for URL slug:', urlSlug);

        // Use the URL slug directly to get directory data
        const consolidatedData = await directoryService.getDirectoryConsolidated(urlSlug);
        console.log('[ShopProfile] Directory consolidated data:', consolidatedData);
        console.log('[ShopProfile] Directory listing keys:', consolidatedData?.listing ? Object.keys(consolidatedData.listing) : 'no listing');
        console.log('[ShopProfile] Directory listing logoUrl:', consolidatedData?.listing?.logoUrl);
        console.log('[ShopProfile] Directory listing isFeatured:', consolidatedData?.listing?.isFeatured);
        console.log('[ShopProfile] Directory listing phone:', consolidatedData?.listing?.phone);
        console.log('[ShopProfile] Directory listing subscriptionTier:', (consolidatedData?.listing as any)?.subscriptionTier);
        console.log('[ShopProfile] Featured products count:', consolidatedData?.featuredProducts?.length);
        console.log('[ShopProfile] Random featured products count:', (consolidatedData as any)?.randomFeaturedProducts?.length || consolidatedData?.featuredProducts?.length);
        console.log('[ShopProfile] Payment gateway status:', consolidatedData?.paymentGatewayStatus);
        console.log('[ShopProfile] Store types:', consolidatedData?.storeTypes);
        
        if (consolidatedData?.listing) {
          console.log('[ShopProfile] Found directory listing:', consolidatedData.listing.id);
          setDirectoryListing(consolidatedData.listing);
        } else {
          console.log('[ShopProfile] No directory listing found for URL slug:', urlSlug);
        }
      } catch (error) {
        console.error('[ShopProfile] Error fetching directory listing:', error);
      }
    };

    fetchDirectoryListing();
  }, [urlSlug]);

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
                  {(directoryListing?.logoUrl || (shop.data as any)?.data?.data?.logo_url || (shop.data as any)?.data?.data?.bannerUrl || (shop.data as any)?.data?.data?.tenantLogoUrl || (shop.data as any)?.data?.data?.imageUrl) ? (
                    <img
                      src={directoryListing?.logoUrl || (shop.data as any)?.data?.data?.logo_url || (shop.data as any)?.data?.data?.bannerUrl || (shop.data as any)?.data?.data?.tenantLogoUrl || (shop.data as any)?.data?.data?.imageUrl}
                      alt={(shop.data as any)?.data?.data?.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      <Store className="h-12 w-12" />
                    </div>
                  )}
                </div>
                {(shop.data as any)?.data?.data?.is_published && (
                  <div className="absolute -top-2 -right-2">
                    <CheckCircle className="h-6 w-6 text-green-500 bg-white rounded-full" />
                  </div>
                )}
              </div>

              {/* Shop Details */}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">{(shop.data as any)?.data?.data.name}</h1>
                  {(shop.data as any)?.data?.data.is_published && (
                    <Badge variant="success" className="text-xs">
                      Verified
                    </Badge>
                  )}
                </div>

                {(shop.data as any)?.data?.data.business_name && (shop.data as any)?.data?.data.business_name !== (shop.data as any)?.data?.data.name && (
                  <p className="text-lg text-gray-600 mb-3">{(shop.data as any)?.data?.data.business_name}</p>
                )}

                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  {(shop.data as any)?.data?.data.rating && (
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="font-medium">{(shop.data as any)?.data?.data.rating.toFixed(1)}</span>
                      {(shop.data as any)?.data?.data.rating_count && (
                        <span className="text-gray-500">({(shop.data as any)?.data?.data.rating_count} reviews)</span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-1">
                    <Package className="h-4 w-4" />
                    <span>{(shop.data as any)?.data?.data.productCount} products</span>
                  </div>

                  {(shop.data as any)?.data?.data.primary_category && (
                    <Badge variant="default" className="text-xs">
                      {(shop.data as any)?.data?.data.primary_category}
                    </Badge>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 mt-4">
                  <StorefrontActions 
                    tenantId={(shop.data as any)?.data?.data.tenantId}
                    businessName={(shop.data as any)?.data?.data.name}
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
            {(shop.data as any)?.data?.data.tenantName && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-gray-700 leading-relaxed">
                    Welcome to {(shop.data as any)?.data?.data.name}! We're proud to be part of the {(shop.data as any)?.data?.data.tenantName} family,
                    offering carefully curated products and exceptional service.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Photo Gallery */}
            {directoryListing && (
              <DirectoryPhotoGalleryDisplay listing={directoryListing} />
            )}

            {/* Contact Information */}
            {((shop.data as any)?.data?.data.contact?.phone || (shop.data as any)?.data?.data.contact?.website) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(shop.data as any)?.data?.data.contact?.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <a href={`tel:${(shop.data as any)?.data?.data.contact.phone}`} className="text-blue-600 hover:underline">
                          {(shop.data as any)?.data?.data.contact.phone}
                        </a>
                      </div>
                    )}
                    
                    {(shop.data as any)?.data?.data.contact?.email && (
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <a href={`mailto:${(shop.data as any)?.data?.data.contact.email}`} className="text-blue-600 hover:underline">
                          {(shop.data as any)?.data?.data.contact.email}
                        </a>
                      </div>
                    )}
                    
                    {(shop.data as any)?.data?.data.contact?.website && (
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <a 
                          href={(shop.data as any)?.data?.data.contact.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center"
                        >
                          Visit Website
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Business Hours */}
            {(shop.data as any)?.data?.data.hours && (
              (() => {
                console.log('[ShopProfile] Raw hours data:', (shop.data as any)?.data?.data.hours);
                const hoursData = (shop.data as any)?.data?.data.hours as Record<string, string>;
                const convertedHours = {
                  periods: Object.entries(hoursData).map(([day, hours]) => {
                    console.log(`[ShopProfile] Converting ${day}: ${hours}`);
                    const [open, close] = hours.split(' - ');
                    const convertTo24Hour = (time12: string): string => {
                      if (time12 === 'Closed') return '00:00';
                      const [time, period] = time12.split(' ');
                      const [h, m] = time.split(':').map(Number);
                      const hour24 = period === 'PM' && h !== 12 ? h + 12 : period === 'AM' && h === 12 ? 0 : h;
                      return `${hour24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    };
                    return {
                      open: convertTo24Hour(open || 'Closed'),
                      close: convertTo24Hour(close || 'Closed')
                    };
                  }),
                  timezone: 'America/New_York'
                };
                console.log('[ShopProfile] Converted hours:', convertedHours);
                return convertedHours;
              })() && (
                <BusinessHoursCollapsible businessHours={(() => {
                  const hoursData = (shop.data as any)?.data?.data.hours as Record<string, string>;
                  const periods = Object.entries(hoursData).map(([day, hours]) => {
                    const [open, close] = hours.split(' - ');
                    const convertTo24Hour = (time12: string): string => {
                      if (time12 === 'Closed') return '00:00';
                      const [time, period] = time12.split(' ');
                      const [h, m] = time.split(':').map(Number);
                      const hour24 = period === 'PM' && h !== 12 ? h + 12 : period === 'AM' && h === 12 ? 0 : h;
                      return `${hour24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    };
                    return {
                      day: day.toUpperCase(), // Uppercase as expected by component
                      open: convertTo24Hour(open || 'Closed'),
                      close: convertTo24Hour(close || 'Closed')
                    };
                  });
                  return {
                    periods,
                    timezone: 'America/New_York'
                  };
                })()} />
              )
            )}
          </div>

          {/* Map & Contact */}
          <div className="space-y-6">
            {(shop.data as any)?.data?.data.address && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <StorefrontMap
                        tenant={{
                          id: (shop.data as any)?.data?.data.tenantId,
                          businessName: (shop.data as any)?.data?.data.name,
                          slug: (shop.data as any)?.data?.data.slug,
                          metadata: {
                            address: (shop.data as any)?.data?.data.address,
                            city: (shop.data as any)?.data?.data.city,
                            state: (shop.data as any)?.data?.data.state,
                            zip_code: (shop.data as any)?.data?.data.zip_code,
                            zipCode: (shop.data as any)?.data?.data.zip_code,
                            logo_url: (shop.data as any)?.data?.data.imageUrl,
                            latitude: (shop.data as any)?.data?.data.latitude,
                            longitude: (shop.data as any)?.data?.data.longitude
                          }
                        }}
                        primaryCategory={(shop.data as any)?.data?.data.primary_category}
                        productCount={(shop.data as any)?.data?.data.productCount}
                      />
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <span className="text-gray-700">
                          {(shop.data as any)?.data?.data.address}
                          {(shop.data as any)?.data?.data.city && `, ${(shop.data as any)?.data?.data.city}`}
                          {(shop.data as any)?.data?.data.state && ` ${(shop.data as any)?.data?.data.state}`}
                          {(shop.data as any)?.data?.data.zip_code && ` ${(shop.data as any)?.data?.data.zip_code}`}
                        </span>
                      </div>
                      
                      {(shop.data as any)?.data?.data.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <a href={`tel:${(shop.data as any)?.data?.data.phone}`} className="text-blue-600 hover:underline">
                            {(shop.data as any)?.data?.data.phone}
                          </a>
                        </div>
                      )}
                      
                      {(shop.data as any)?.data?.data.website && (
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4 text-gray-400" />
                          <a 
                            href={(shop.data as any)?.data?.data.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center"
                          >
                            Visit Website
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </div>
                      )}
                    </div>
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
                    <div className="text-2xl font-bold text-blue-600">{(shop.data as any)?.data?.data.productCount}</div>
                    <div className="text-sm text-gray-600">Products</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {(shop.data as any)?.data?.data.rating ? (shop.data as any)?.data?.data.rating.toFixed(1) : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">
                      Rating {(shop.data as any)?.data?.data.rating_count ? `(${(shop.data as any)?.data?.data.rating_count} reviews)` : ''}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shop Description */}
            {(shop.data as any)?.data?.data.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About Us</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 leading-relaxed">
                    {(shop.data as any)?.data?.data.description}
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
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Track shop page view */}
      <ShopViewTracker 
        tenantId={(shop.data as any)?.data?.data.tenantId} 
        shopName={(shop.data as any)?.data?.data.name}
        category={(shop.data as any)?.data?.data.primary_category || null}
        pageType="shop_detail"
      />
      {/* Navigation Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/shops/directory">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Shops
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-2">
                <Store className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-900">{(shop.data as any)?.data?.data.name}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Link href={`/shops/directory${(shop.data as any)?.data?.data.primary_category ? `?category=${encodeURIComponent((shop.data as any)?.data?.data.primary_category)}` : ''}`}>
                <Button variant="ghost" size="sm">
                  Similar Shops
                </Button>
              </Link>
              <Link href="/shops/trending">
                <Button variant="ghost" size="sm">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Trending
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <ShopProfileHeader shop={shop} />

      {/* Products Section */}
      <div className="bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* Search Section - Full width */}
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Products</h2>
              <p className="text-gray-600">
                Browse our selection of {(shop.data as any)?.data?.data.productCount} products
              </p>
            </div>

            {/* Product Search */}
            <div className="bg-white rounded-lg border shadow-sm">
              <ProductSearch 
                tenantId={(shop.data as any)?.data?.data.tenantId}
              />
            </div>
          </div>

          {/* Featured Products - Centered with page margins */}
          <div className="mb-12">
            <StorefrontFeaturedProducts tenantId={(shop.data as any)?.data?.data.tenantId} />
          </div>

          {/* Recently Viewed - Centered with page margins */}
          <div className="mb-12">
            <LastViewed />
          </div>
        </div>
      </div>

      {/* Sidebar - Contact info only, positioned separately */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3"></div>
          <div className="space-y-6">
            {/* Contact Info */}
            {((shop.data as any)?.data?.data.contact?.phone || (shop.data as any)?.data?.data.contact?.website) && (
              <ContactInformationCollapsible
                tenant={{
                  metadata: {
                    phone: (shop.data as any)?.data?.data.contact?.phone,
                    email: (shop.data as any)?.data?.data.contact?.email,
                    address: (shop.data as any)?.data?.data.address
                  }
                }}
              />
            )}

            {/* Business Hours */}
            {(shop.data as any)?.data?.data.hours && (
              <BusinessHoursCollapsible businessHours={(shop.data as any)?.data?.data.hours} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
