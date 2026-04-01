/**
 * Shop Profile Client Component
 * Handles interactive parts of the (shop.data as any)?.data?.data profile page
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LinkType } from '@/components/stores/StoreCard';

import { Button, Card, Badge, Tabs, TabsList, TabsTab, TabsPanel, Skeleton, Group, Text, Divider, Container, Stack } from '@mantine/core';
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
  Sparkles,
  LayoutGrid,
  List,
  Image as ImageIcon
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
import FeaturedBucketsShowcase from '@/components/storefront/FeaturedBucketsShowcase';
import ProductCategorySidebar from '@/components/storefront/ProductCategorySidebar';
import CategoryMobileDropdown from '@/components/storefront/CategoryMobileDropdown';
import { ShopViewTracker } from '@/components/tracking/ShopViewTracker';
import DirectoryPhotoGalleryDisplay from '@/components/directory/DirectoryPhotoGalleryDisplay';
import { directoryService } from '@/services/DirectorySingletonService';
import { directoryListingService } from '@/services/DirectoryListingSingletonService';
import { storefrontSingletonService } from '@/services/StorefrontSingletonService';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import StoreStatusIndicator from '@/components/storefront/StoreStatusIndicator';
import { featuredProductsSingleton } from '@/providers/data/FeaturedProductsSingleton';
import {  Badge as MantineBadge } from '@mantine/core';
import { useStoreStatus } from "@/hooks/useStoreStatus";

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
  id: string;
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
  category?: string;
  created_at: string;
  tenantName?: string;
  latitude?: number;
  longitude?: number;
  contact?: {
    email: string;
    phone: string;
    website: string;
  };
  businessHours?: any;
  businessDescription?: string;
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
  businessHours?: any;
}

// Shop profile header component
function ShopProfileHeader({ shop, shopData, businessHours }: { 
  shop: {
    success: boolean;
    data: {
      success: boolean;
      data: ShopData;
    };
  };
  shopData: ShopData;
  businessHours?: any;
}) {
  // Create a directory listing object from shop data for the photo gallery
  const directoryListing = shopData ? {
    id: shopData.id,
    tenantId: shopData.id,
    name: shopData.name,
    description: shopData.business_name || shopData.name,
    imageUrl: shopData.imageUrl,
    logo_url: shopData.logo_url,
    bannerUrl: shopData.bannerUrl,
    // Add any other required fields for the photo gallery
  } : null;

  // Check if shop data exists and is valid
  if (!shop || !shop.success || !shopData || !shopData.id) {
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Page Header with horizontal gradient background */}
      <div className="bg-gradient-to-r from-blue-100 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            {/* Column 1: Shop Logo and Details */}
            <div className="flex items-start space-x-6">
              {/* Shop Logo */}
              <div className="relative">
                <div className="h-24 w-24 bg-white rounded-xl shadow-lg flex items-center justify-center overflow-hidden">
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
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{shopData.name}</h1>
                  {shopData.is_published && (
                    <Badge variant="filled" color="green" size="sm">
                      Verified
                    </Badge>
                  )}
                </div>

                {shopData.business_name && shopData.business_name !== shopData.name && (
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-3">{shopData.business_name}</p>
                )}

                <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-300">
                  {shopData.rating && (
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="font-medium">{shopData.rating.toFixed(1)}</span>
                      {shopData.rating_count && (
                        <span className="text-gray-500 dark:text-gray-400">({shopData.rating_count} reviews)</span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-1">
                    <Package className="h-4 w-4" />
                    <span>{shopData.productCount} products</span>
                  </div>

                  {(shopData.primary_category || shopData.category) && (
                    <Badge variant="light" size="sm">
                      {shopData.primary_category || shopData.category}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Column 2: Action Buttons */}
            <div className="flex items-center space-x-3">
              <StorefrontActions 
                tenantId={shopData.id}
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
      </div>
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Shop Info */}
          <div className="lg:col-span-2 space-y-6">

            {/* Shop Description */}
            {shopData.tenantName && (
              <Card withBorder padding="lg" radius="md">
                <Text className="text-gray-700 leading-relaxed">
                  Welcome to {shopData.name}! We're proud to be part of the {shopData.tenantName} family,
                  offering carefully curated products and exceptional service.
                </Text>
              </Card>
            )}

            {/* Contact Information */}
            {(shopData.contact?.phone || shopData.contact?.website) && (
              <Card withBorder padding="lg" radius="md">
                <Text fw={600} size="lg" mb="md">Contact Information</Text>
                <Stack gap="sm">
                  {shopData.contact?.phone && (
                    <Group gap="xs">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <a href={`tel:${shopData.contact.phone}`} className="text-blue-600 hover:underline">
                        {shopData.contact.phone}
                      </a>
                    </Group>
                  )}
                  {shopData.contact?.website && (
                    <Group gap="xs">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <a href={shopData.contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {shopData.contact.website}
                      </a>
                    </Group>
                  )}
                </Stack>
              </Card>
            )}

            {/* Photo Gallery */}
            {directoryListing && (
              <DirectoryPhotoGalleryDisplay listing={directoryListing} isPublished={true} />
            )}

            {/* Business Hours */}
            {businessHours && (
              <BusinessHoursCollapsible businessHours={businessHours} />
            )}
          </div>

          {/* Sidebar - 1/3 width */}
          <div className="space-y-6">
            {shopData.address && (
              <Card withBorder padding="lg" radius="md">
                <Text fw={600} size="lg" mb="md">Location</Text>
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
                  <StorefrontMap
                    tenant={{
                      id: shopData.id,
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
                
                <Stack gap="xs">
                  <Group gap="xs">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <Text size="sm" className="text-gray-700">
                      {shopData.address}
                      {shopData.city && `, ${shopData.city}`}
                      {shopData.state && ` ${shopData.state}`}
                      {shopData.zip_code && ` ${shopData.zip_code}`}
                    </Text>
                  </Group>
                  
                  {shopData.contact?.phone && (
                    <Group gap="xs">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <a href={`tel:${shopData.contact.phone}`} className="text-blue-600 hover:underline">
                        {shopData.contact.phone}
                      </a>
                    </Group>
                  )}
                  
                  {shopData.contact?.website && (
                    <Group gap="xs">
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
                    </Group>
                  )}
                </Stack>
              </Card>
            )}

            {/* Quick Stats */}
            <Card withBorder padding="lg" radius="md">
              <Text fw={600} size="lg" mb="md">Shop Stats</Text>
              <Group grow>
                <div className="text-center">
                  <Text fw={700} size="xl" c="blue">{shopData.productCount}</Text>
                  <Text size="sm" c="dimmed">Products</Text>
                </div>
                <div className="text-center">
                  <Text fw={700} size="xl" c="green">
                    {shopData.rating ? shopData.rating.toFixed(1) : 'N/A'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Rating {shopData.rating_count ? `(${shopData.rating_count} reviews)` : ''}
                  </Text>
                </div>
              </Group>
            </Card>

            {/* Shop Description */}
            {shopData.business_name && (
              <Card withBorder padding="lg" radius="md">
                <Text fw={600} size="lg" mb="md">About Us</Text>
                <Text className="text-gray-700 leading-relaxed">
                  {shopData.business_name}
                </Text>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Shop Profile Client Component
export default function ShopProfileClient({ shop, businessHours }: {
  shop: {
    success: boolean;
    data: {
      success: boolean;
      data: ShopData;
    };
  };
  businessHours: any;
}) {
  // Extract shop data once at the top
  const shopData = (shop.data as any)?.data;
  
  // Featured products state
  const [featuredCounts, setFeaturedCounts] = useState({
    staff_pick: 0,
    seasonal: 0,
    sale: 0,
    new_arrival: 0,
    store_selection: 0,
  });
  const [featuredData, setFeaturedData] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  
  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      if (!shopData?.id) return;
      
      try {
        const storefrontData = await storefrontSingletonService.getStorefrontCategories(shopData.id);
        const storefrontCategories = storefrontData.categories || [];
        
        // Convert to category format
        const cats = storefrontCategories.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          count: parseInt(cat.productCount) || 0, // API returns productCount as string
          googleCategoryId: cat.googleCategoryId,
          category_type: 'platform',
        }));
        
        setCategories(cats);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
    
    fetchCategories();
  }, [shopData?.id]);
  
  // Fetch featured data on mount
  useEffect(() => {
    const loadFeaturedCounts = async () => {
      if (!shopData?.id) return;
      
      try {
        let data = await featuredProductsSingleton.getAllFeaturedProducts(shopData.id, 20);
        
        // Validate cache: if data is empty, force a fresh fetch
        if (data && data.totalCount === 0 && (!data.buckets || data.buckets.length === 0)) {
          await featuredProductsSingleton.clearCache();
          data = await featuredProductsSingleton.getAllFeaturedProducts(shopData.id, 20);
        }
        
        if (data) {
          setFeaturedData(data);
          // Derive counts from buckets array
          const counts = {
            staff_pick: 0,
            seasonal: 0,
            sale: 0,
            new_arrival: 0,
            store_selection: 0,
          };
          
          data.buckets?.forEach((bucket: { bucketType: string; totalCount?: number }) => {
            if (bucket.bucketType === 'staff_pick') counts.staff_pick = bucket.totalCount || 0;
            if (bucket.bucketType === 'seasonal') counts.seasonal = bucket.totalCount || 0;
            if (bucket.bucketType === 'sale') counts.sale = bucket.totalCount || 0;
            if (bucket.bucketType === 'new_arrival') counts.new_arrival = bucket.totalCount || 0;
            if (bucket.bucketType === 'store_selection') counts.store_selection = bucket.totalCount || 0;
          });
          
          setFeaturedCounts(counts);
        }
      } catch (error) {
        console.error('Failed to load featured products:', error);
      }
    };
    
    loadFeaturedCounts();
  }, [shopData?.id]);
  
  //console.log(shopData);
  // Check if shop data exists and is valid
  if (!shop || !shop.success || !shopData || !shopData.id) {
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

  const { status: hoursStatus } = useStoreStatus(shopData.id, true); // Public scope
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Track shop page view */}
      <ShopViewTracker 
        tenantId={shopData.id} 
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
                 <Divider orientation="vertical" h={24} />
               {/* Hours Badge - Status */}
            {(() => {
              switch (hoursStatus?.status) {
                case 'open':
                  return (
                    <MantineBadge 
                      color="green"
                      variant="light"
                      size="xs"
                      className="animate-pulse"
                      title={hoursStatus?.label || 'Open now'}
                    >
                      🟢 Open
                    </MantineBadge>
                  );
                case 'closed':
                  return (
                    <MantineBadge 
                      color="red"
                      variant="light"
                      size="xs"
                      className="animate-bounce"
                      title={hoursStatus?.label || 'Closed'}
                    >
                      🔴 Closed
                    </MantineBadge>
                  );
                case 'opening-soon':
                  return (
                    <MantineBadge 
                      color="blue"
                      variant="filled"
                      size="xs"
                      className="animate-ping"
                      title={hoursStatus?.label || 'Opening soon'}
                    >
                      🟡 Opening
                    </MantineBadge>
                  );
                case 'closing-soon':
                  return (
                    <MantineBadge 
                      color="orange"
                      variant="filled"
                      size="xs"
                      className="animate-ping"
                      title={hoursStatus?.label || 'Closing soon'}
                    >
                      🟡 Closing
                    </MantineBadge>
                  );
                default:
                  return null;
              }
            })()}
			
              </div>
             
            </div>
            
            <div className="flex items-center space-x-2">
              <Link href={`/shops/directory${shopData.primary_category||shopData.category ? `?category=${encodeURIComponent(shopData.primary_category||shopData.category)}` : ''}`}>
                <Button variant="ghost" size="sm">
                  Similar Shops
                </Button>
              </Link>
              
              <Divider orientation="vertical" h={24} />
              
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-900">{shopData.location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ShopProfileHeader shop={shop} shopData={shopData} businessHours={businessHours} />

      {/* Quick Jump Navigation - Featured Types */}
      {(featuredCounts.staff_pick > 0 || featuredCounts.new_arrival > 0 || featuredCounts.sale > 0 || featuredCounts.seasonal > 0 || featuredCounts.store_selection > 0) && (
        <div className="bg-white border-b border-gray-200 sticky top-[60px] z-30">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-600 mr-2">Quick Jump:</span>
              
              {/* Staff Picks */}
              {featuredCounts.staff_pick > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('staff_pick-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap"
                >
                  <span>⭐</span>
                  <span>Staff Picks ({featuredCounts.staff_pick})</span>
                </button>
              )}

              {/* New Arrivals */}
              {featuredCounts.new_arrival > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('new_arrival-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap"
                >
                  <span>✨</span>
                  <span>New Arrivals ({featuredCounts.new_arrival})</span>
                </button>
              )}

              {/* Sale Items */}
              {featuredCounts.sale > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('sale-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-600 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors whitespace-nowrap"
                >
                  <span>💰</span>
                  <span>Sale Items ({featuredCounts.sale})</span>
                </button>
              )}

              {/* Seasonal Specials */}
              {featuredCounts.seasonal > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('seasonal-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-600 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors whitespace-nowrap"
                >
                  <span>🍂</span>
                  <span>Seasonal ({featuredCounts.seasonal})</span>
                </button>
              )}

              {/* Store Selection */}
              {featuredCounts.store_selection > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('store_selection-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap"
                >
                  <span>🏪</span>
                  <span>Store Selection ({featuredCounts.store_selection})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Products Section */}
      <div className="bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* Search Section - Full width */}
          <div className="mb-8">
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <ProductSearch 
                tenantId={shopData.id}
              />
            </div>
          </div>

          {/* Category Navigation */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Desktop Category Sidebar */}
            <div className="hidden lg:block lg:w-64 flex-shrink-0">
              <ProductCategorySidebar
                tenantId={shopData.id}
                categories={categories}
                totalProducts={shopData.productCount || 0}
              />
            </div>

            {/* Mobile Category Dropdown */}
            <div className="lg:hidden">
              <CategoryMobileDropdown
                tenantId={shopData.id}
                categories={categories}
                totalProducts={shopData.productCount || 0}
              />
            </div>

            {/* Main Content Area */}
            <div className="flex-1">
              {/* Section Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Products</h2>
                <p className="text-gray-600">
                  Browse our selection of {shopData.productCount} products
                </p>
              </div>

              {/* Featured Buckets Showcase - with Quick Jump targets */}
              {featuredData && featuredData.totalCount > 0 && (
                <div className="mb-12">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Featured Selections</h2>
                    <p className="text-sm text-gray-600">
                      Discover our hand-picked selection of featured items
                    </p>
                  </div>
                  
                  <FeaturedBucketsShowcase 
                    featuredData={{
                      totalCount: featuredData.totalCount,
                      bucketCounts: featuredCounts,
                      // Transform buckets array to individual properties
                      staffPick: featuredData.buckets?.find((b: { bucketType: string }) => b.bucketType === 'staff_pick')?.products || [],
                      newArrival: featuredData.buckets?.find((b: { bucketType: string }) => b.bucketType === 'new_arrival')?.products || [],
                      seasonal: featuredData.buckets?.find((b: { bucketType: string }) => b.bucketType === 'seasonal')?.products || [],
                      sale: featuredData.buckets?.find((b: { bucketType: string }) => b.bucketType === 'sale')?.products || [],
                      storeSelection: featuredData.buckets?.find((b: { bucketType: string }) => b.bucketType === 'store_selection')?.products || []
                    }}
                    tenantId={shopData.id}
                    hasActivePaymentGateway={shopData.has_active_payment_gateway}
                    defaultGatewayType={shopData.default_gateway_type}
                  />
                </div>
              )}

                          </div>
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
