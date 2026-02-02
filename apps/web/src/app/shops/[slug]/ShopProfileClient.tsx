/**
 * Shop Profile Client Component
 * Handles interactive parts of the shop profile page
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import LastViewed from '@/components/directory/LastViewed';
import StorefrontFeaturedProducts from '@/components/storefront/StorefrontFeaturedProducts';
import { ShopViewTracker } from '@/components/tracking/ShopViewTracker';

// Types
interface Shop {
  id: string;
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
  product_count: number;
  is_published: boolean;
  primary_category?: string;
  created_at: Date;
  tenantName?: string;
  tenantLogoUrl?: string;
}

interface ShopProfileClientProps {
  shop: Shop;
}

// Shop profile header component
function ShopProfileHeader({ shop }: { shop: Shop }) {
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
                  {shop.logo_url ? (
                    <img
                      src={shop.logo_url}
                      alt={shop.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="h-12 w-12 text-gray-400" />
                  )}
                </div>
                {shop.is_published && (
                  <div className="absolute -top-2 -right-2">
                    <CheckCircle className="h-6 w-6 text-green-500 bg-white rounded-full" />
                  </div>
                )}
              </div>

              {/* Shop Details */}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">{shop.name}</h1>
                  {shop.is_published && (
                    <Badge variant="success" className="text-xs">
                      Verified
                    </Badge>
                  )}
                </div>

                {shop.business_name && shop.business_name !== shop.name && (
                  <p className="text-lg text-gray-600 mb-3">{shop.business_name}</p>
                )}

                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  {shop.rating_avg && (
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="font-medium">{shop.rating_avg.toFixed(1)}</span>
                      {shop.rating_count && (
                        <span className="text-gray-500">({shop.rating_count} reviews)</span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-1">
                    <Package className="h-4 w-4" />
                    <span>{shop.product_count} products</span>
                  </div>

                  {shop.primary_category && (
                    <Badge variant="default" className="text-xs">
                      {shop.primary_category}
                    </Badge>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 mt-4">
                  <StorefrontActions 
                    tenantId={shop.id}
                    businessName={shop.name}
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
            {shop.tenantName && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-gray-700 leading-relaxed">
                    Welcome to {shop.name}! We're proud to be part of the {shop.tenantName} family,
                    offering carefully curated products and exceptional service.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Map & Contact */}
          <div className="space-y-6">
            {shop.address && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <StorefrontMap
                        tenant={{
                          id: shop.id,
                          businessName: shop.name,
                          slug: shop.slug,
                          metadata: {
                            address: shop.address,
                            city: shop.city,
                            state: shop.state,
                            zip_code: shop.zip_code,
                            zipCode: shop.zip_code,
                            logo_url: shop.logo_url
                          }
                        }}
                        primaryCategory={shop.primary_category}
                        productCount={shop.product_count}
                      />
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <span className="text-gray-700">
                          {shop.address}
                          {shop.city && `, ${shop.city}`}
                          {shop.state && ` ${shop.state}`}
                          {shop.zip_code && ` ${shop.zip_code}`}
                        </span>
                      </div>
                      
                      {shop.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <a href={`tel:${shop.phone}`} className="text-blue-600 hover:underline">
                            {shop.phone}
                          </a>
                        </div>
                      )}
                      
                      {shop.website && (
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4 text-gray-400" />
                          <a 
                            href={shop.website} 
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
                    <div className="text-2xl font-bold text-blue-600">{shop.product_count}</div>
                    <div className="text-sm text-gray-600">Products</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {shop.rating_avg ? shop.rating_avg.toFixed(1) : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">Rating</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Shop Profile Client Component
export default function ShopProfileClient({ shop }: ShopProfileClientProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Track shop page view */}
      <ShopViewTracker 
        tenantId={shop.id} 
        shopName={shop.name}
        category={shop.primary_category || null}
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
                <span className="font-medium text-gray-900">{shop.name}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Link href={`/shops/directory?category=${shop.primary_category}`}>
                <Button variant="ghost" size="sm">
                  Similar Shops
                </Button>
              </Link>
              <Link href="/shops/directory">
                <Button variant="ghost" size="sm">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Trending
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Shop Header */}
      <ShopProfileHeader shop={shop} />

      {/* Products Section */}
      <div className="bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* Search Section - Full width */}
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Products</h2>
              <p className="text-gray-600">
                Browse our selection of {shop.product_count} products
              </p>
            </div>

            {/* Product Search */}
            <div className="bg-white rounded-lg border shadow-sm">
              <ProductSearch 
                tenantId={shop.id}
              />
            </div>
          </div>

          {/* Featured Products - Centered with page margins */}
          <div className="mb-12">
            <StorefrontFeaturedProducts tenantId={shop.id} />
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
            {(shop.phone || shop.website) && (
              <ContactInformationCollapsible
                tenant={{
                  metadata: {
                    phone: shop.phone,
                    email: undefined,
                    address: shop.address
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
