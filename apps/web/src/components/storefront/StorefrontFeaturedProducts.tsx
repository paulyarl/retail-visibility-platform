'use client';

import { useState, useEffect } from 'react';
import { Package, Calendar, DollarSign, Star, Tag, Grid, List } from 'lucide-react';
import Link from 'next/link';
import SmartProductCard from '@/components/products/SmartProductCard';
import { Button } from '@/components/ui/Button';
import { storefrontService } from '@/services/StorefrontSingletonService';

interface FeaturedProduct {
  id: string;
  sku?: string;
  name: string;
  title?: string;
  description?: string;
  price: number;
  priceCents: number;
  salePriceCents?: number;
  listPriceCents?: number;
  currency: string;
  stock: number;
  inventoryQuantity?: number;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  galleryUrls?: string[];
  thumbnailUrl?: string;
  featuredImageUrl?: string;
  brand?: string;
  manufacturer?: string;
  condition?: string;
  gtin?: string;
  mpn?: string;
  availability?: string;
  itemStatus?: string;
  tenantCategory?: any;
  has_variants?: boolean;
  hasActivePaymentGateway?: boolean;
  paymentGatewayType?: string;
  isFeatured?: boolean;
  featuredTypes?: ('store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick')[];

  // Enhanced fields for rich display
  averageRating?: number;
  reviewCount?: number;
  viewCount?: number;
  uniqueViewers?: number;
  engagementCount?: number;
  conversionCount?: number;
  revenueCents?: number;
  unitsSold?: number;
  wishlistCount?: number;
  shareCount?: number;
  isOnSale?: boolean;
  discountPercentage?: string;

  // Media fields
  hasGallery?: boolean;

  // Product details
  specifications?: any;
  attributes?: any;
  customFields?: any;
  searchKeywords?: string[];
  tags?: string[];
  metadata?: any;

  // SEO fields
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];

  // Physical properties
  weight?: number;
  dimensions?: any;
  weightUnit?: string;
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit?: string;

  // Categories
  categoryName?: string;
  categorySlug?: string;
  productCategory?: string;
  productCategorySlug?: string;
  googleCategoryId?: string;
  productParentCategoryId?: string;

  // Variants
  hasVariants?: boolean;
  variantId?: string;
  variantName?: string;
  variantSku?: string;
  variantColor?: string;
  variantSize?: string;
  variantMaterial?: string;
  variantStyle?: string;

  // Product types
  productType?: string;
  isDigitalProduct?: boolean;
  isPhysicalProduct?: boolean;
  isService?: boolean;
  isBundle?: boolean;
  isCustomizable?: boolean;
  isTrackable?: boolean;

  // Rich descriptions
  marketingDescription?: string;

  // Shop info
  tenantId?: string;
  tenantName?: string;
  tenantLogoUrl?: string;
  shopCategory?: string;
  shopCategoryId?: string;
  shopGoogleCategoryId?: string;

  // Location
  tenantCity?: string;
  tenantState?: string;
  tenantCountry?: string;
  tenantZip?: string;
  tenantAddress?: string;
  tenantLatitude?: number;
  tenantLongitude?: number;
  timezone?: string;

  // Business info
  businessType?: string;
  businessCategory?: string;
  businessSize?: string;
  establishedYear?: number;

  // Status indicators
  inStock?: boolean;
  stockStatus?: string;
  priceStatus?: string;

  // Analytics
  bucketPriority?: number;
  trendingScore?: number;

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;

  // Featured system
  featuredType?: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
  featuredPriority?: number;
  featuredAt?: string;
  featuredExpiresAt?: string;
  isFeaturedActive?: boolean;
  daysUntilExpiration?: number;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  autoUnfeature?: boolean;
  // NEW LIVE REVIEW AGGREGATIONS
  productRatingLive?: number;
  productReviewsCountLive?: number;
  productHelpfulCountLive?: number;
  productReviewsApprovedLive?: number;
}

interface FeaturedSectionProps {
  tenantId: string;
  type: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  maxProducts?: number;
}

const featuredTypeConfig = {
  store_selection: {
    title: 'Featured Products',
    description: 'Hand-picked favorites from our collection',
    icon: <Star className="w-5 h-5" />,
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    buttonColor: 'bg-amber-600 hover:bg-amber-700',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  new_arrival: {
    title: 'New Arrivals',
    description: 'Fresh products just added to our store',
    icon: <Package className="w-5 h-5" />,
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    buttonColor: 'bg-green-600 hover:bg-green-700',
    badgeColor: 'bg-green-100 text-green-800 border-green-200'
  },
  seasonal: {
    title: 'Seasonal Specials',
    description: 'Perfect for this time of year',
    icon: <Calendar className="w-5 h-5" />,
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    buttonColor: 'bg-orange-600 hover:bg-orange-700',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-200'
  },
  sale: {
    title: 'Sale Items',
    description: 'Great deals on selected products',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    buttonColor: 'bg-red-600 hover:bg-red-700',
    badgeColor: 'bg-red-100 text-red-800 border-red-200'
  },
  staff_pick: {
    title: 'Staff Picks',
    description: 'Hand-picked favorites by our team',
    icon: <Star className="w-5 h-5" />,
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    buttonColor: 'bg-purple-600 hover:bg-purple-700',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200'
  }
};

// Helper function to render featured type badges
function FeaturedTypeBadges({ featuredTypes }: { featuredTypes?: string[] }) {
  if (!featuredTypes || featuredTypes.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {featuredTypes.map((type) => {
        const config = featuredTypeConfig[type as keyof typeof featuredTypeConfig];
        if (!config) return null;
        
        return (
          <span
            key={type}
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${config.badgeColor}`}
          >
            {config.icon}
            <span className="ml-1">{config.title}</span>
          </span>
        );
      })}
    </div>
  );
}

interface FeaturedSectionWithProductsProps {
  tenantId: string;
  type: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  products: FeaturedProduct[];
  loading: boolean;
  maxProducts?: number;
}

function FeaturedSection({ tenantId, type, title, description, icon, color, products, loading, maxProducts = 8 }: FeaturedSectionWithProductsProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const config = featuredTypeConfig[type];
  
  // Filter products by type (already done at parent level, but keep for safety)
  const typeProducts = products.filter(p => p.featuredType === type).slice(0, maxProducts);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="flex items-center space-x-3 mb-6">
          <div className={`w-10 h-10 rounded-lg ${config.bgColor}`}></div>
          <div>
            <div className="h-6 bg-gray-200 rounded w-32 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-48"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-48"></div>
          ))}
        </div>
      </div>
    );
  }

  if (typeProducts.length === 0) {
    return null; // Don't show empty sections
  }

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-lg ${config.bgColor} ${config.textColor}`}>
              {icon}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
              <p className="text-gray-600 mt-1">{description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* Grid/List Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="px-3 py-1.5"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="px-3 py-1.5"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Link
              href={`/tenant/${tenantId}?view=grid&featured=${type}&products_only=true`}
              className={`px-4 py-2 rounded-lg text-white font-medium ${config.buttonColor} transition-colors`}
            >
              View All
            </Link>
          </div>
        </div>

        {/* Products Display */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <SmartProductCard
                key={product.id}
                tenantId={tenantId}
                product={{
                  // Basic fields
                  id: product.id,
                  sku: product.sku || product.id,
                  name: product.name,
                  title: product.title,
                  brand: product.brand,
                  description: product.description,
                  priceCents: product.priceCents,
                  stock: product.stock,
                  imageUrl: product.imageUrl,
                  tenantId: tenantId,
                  availability: (product.availability as 'in_stock' | 'out_of_stock' | 'preorder') || 'in_stock',
                  has_active_payment_gateway: product.hasActivePaymentGateway,
                  payment_gateway_type: product.paymentGatewayType,
                  tenantCategory: product.tenantCategory||product.shopCategory,
                  isFeatured: product.isFeatured,
                  
                  // Enhanced fields for rich display
                  averageRating: typeof product.averageRating === 'string' ? parseFloat(product.averageRating) : product.averageRating,
                  reviewCount: product.reviewCount,
                  viewCount: product.viewCount,
                  wishlistCount: product.wishlistCount,
                  shareCount: product.shareCount,
                  isOnSale: product.isOnSale,
                  discountPercentage: product.discountPercentage,
                  currency: product.currency,
                  
                  // NEW LIVE REVIEW AGGREGATIONS
                  productRatingLive: typeof product.productRatingLive === 'string' ? parseFloat(product.productRatingLive) : product.productRatingLive,
                  productReviewsCountLive: product.productReviewsCountLive,
                  productHelpfulCountLive: product.productHelpfulCountLive,
                  productReviewsApprovedLive: product.productReviewsApprovedLive,
                  
                  // Media fields
                  hasGallery: product.hasGallery,
                  videoUrl: product.videoUrl,
                  imageUrls: product.imageUrls,
                  galleryUrls: product.galleryUrls,
                  thumbnailUrl: product.thumbnailUrl,
                  featuredImageUrl: product.featuredImageUrl,
                  
                  // Product details
                  manufacturer: product.manufacturer,
                  condition: product.condition,
                  gtin: product.gtin,
                  mpn: product.mpn,
                  specifications: product.specifications,
                  attributes: product.attributes,
                  customFields: product.customFields,
                  searchKeywords: product.searchKeywords,
                  tags: product.tags,
                  
                  // SEO fields
                  seoTitle: product.seoTitle,
                  seoDescription: product.seoDescription,
                  seoKeywords: product.seoKeywords,
                  
                  // Physical properties
                  weight: product.weight,
                  dimensions: product.dimensions,
                  weightUnit: product.weightUnit,
                  length: product.length,
                  width: product.width,
                  height: product.height,
                  dimensionUnit: product.dimensionUnit,
                  
                  // Categories
                  categoryName: product.categoryName||product.productCategory,
                  categorySlug: product.categorySlug||product.productCategorySlug,
                  productCategory: product.productCategory||product.categoryName,
                  productCategorySlug: product.productCategorySlug||product.categorySlug,
                  googleCategoryId: product.googleCategoryId,
                  productParentCategoryId: product.productParentCategoryId,
                  
                  // Variants
                  has_variants: product.hasVariants,
                  variantId: product.variantId,
                  variantName: product.variantName,
                  variantSku: product.variantSku,
                  variantColor: product.variantColor,
                  variantSize: product.variantSize,
                  variantMaterial: product.variantMaterial,
                  variantStyle: product.variantStyle,
                  
                  // Product types
                  productType: product.productType,
                  isDigitalProduct: product.isDigitalProduct,
                  isPhysicalProduct: product.isPhysicalProduct,
                  isService: product.isService,
                  isBundle: product.isBundle,
                  isCustomizable: product.isCustomizable,
                  isTrackable: product.isTrackable,
                  
                  // Rich descriptions
                  marketingDescription: product.marketingDescription,
                  
                  // Shop info
                  tenantName: product.tenantName,
                  tenantLogoUrl: product.tenantLogoUrl,
                  shopCategory: product.shopCategory,
                  shopCategoryId: product.shopCategoryId,
                  shopGoogleCategoryId: product.shopGoogleCategoryId,
                  
                  // Location
                  tenantCity: product.tenantCity,
                  tenantState: product.tenantState,
                  tenantCountry: product.tenantCountry,
                  tenantZip: product.tenantZip,
                  tenantAddress: product.tenantAddress,
                  tenantLatitude: product.tenantLatitude,
                  tenantLongitude: product.tenantLongitude,
                  timezone: product.timezone,
                  
                  // Business info
                  businessType: product.businessType,
                  businessCategory: product.businessCategory,
                  businessSize: product.businessSize,
                  establishedYear: product.establishedYear,
                  
                  // Status indicators
                  inStock: product.inStock,
                  stockStatus: product.stockStatus,
                  priceStatus: product.priceStatus,
                  
                  // Analytics
                  bucketPriority: product.bucketPriority,
                  trendingScore: product.trendingScore,
                  
                  // Timestamps
                  createdAt: product.createdAt,
                  updatedAt: product.updatedAt,
                  publishedAt: product.publishedAt,
                  
                  // Featured system
                  featuredType: product.featuredType as 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick',
                  featuredTypes: product.featuredTypes,
                  featuredPriority: product.featuredPriority,
                  featuredAt: product.featuredAt,
                  featuredExpiresAt: product.featuredExpiresAt,
                  isFeaturedActive: product.isFeaturedActive,
                  daysUntilExpiration: product.daysUntilExpiration,
                  isExpired: product.isExpired,
                  isExpiringSoon: product.isExpiringSoon,
                  autoUnfeature: product.autoUnfeature,
                  
                  // Legacy metadata
                  metadata: {
                    featuredTypes: product.featuredTypes
                  }
                }}
                variant="featured"
                showCategory={true}
                showDescription={false}
                className="h-full"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <SmartProductCard
                key={product.id}
                tenantId={tenantId}
                product={{
                  // Basic fields
                  id: product.id,
                  sku: product.sku || product.id,
                  name: product.name,
                  title: product.title,
                  brand: product.brand,
                  description: product.description,
                  priceCents: product.priceCents,
                  stock: product.stock,
                  imageUrl: product.imageUrl,
                  tenantId: tenantId,
                  availability: (product.availability as 'in_stock' | 'out_of_stock' | 'preorder') || 'in_stock',
                  has_active_payment_gateway: product.hasActivePaymentGateway,
                  payment_gateway_type: product.paymentGatewayType,
                  tenantCategory: product.tenantCategory||product.shopCategory,
                  isFeatured: product.isFeatured,
                  
                  // Enhanced fields for rich display
                  averageRating: typeof product.averageRating === 'string' ? parseFloat(product.averageRating) : product.averageRating,
                  reviewCount: product.reviewCount,
                  viewCount: product.viewCount,
                  wishlistCount: product.wishlistCount,
                  shareCount: product.shareCount,
                  isOnSale: product.isOnSale,
                  discountPercentage: product.discountPercentage,
                  currency: product.currency,
                  
                  // NEW LIVE REVIEW AGGREGATIONS
                  productRatingLive: typeof product.productRatingLive === 'string' ? parseFloat(product.productRatingLive) : product.productRatingLive,
                  productReviewsCountLive: product.productReviewsCountLive,
                  productHelpfulCountLive: product.productHelpfulCountLive,
                  productReviewsApprovedLive: product.productReviewsApprovedLive,
                  
                  // Media fields
                  hasGallery: product.hasGallery,
                  videoUrl: product.videoUrl,
                  imageUrls: product.imageUrls,
                  galleryUrls: product.galleryUrls,
                  thumbnailUrl: product.thumbnailUrl,
                  featuredImageUrl: product.featuredImageUrl,
                  
                  // Product details
                  manufacturer: product.manufacturer,
                  condition: product.condition,
                  gtin: product.gtin,
                  mpn: product.mpn,
                  specifications: product.specifications,
                  attributes: product.attributes,
                  customFields: product.customFields,
                  searchKeywords: product.searchKeywords,
                  tags: product.tags,
                  
                  // SEO fields
                  seoTitle: product.seoTitle,
                  seoDescription: product.seoDescription,
                  seoKeywords: product.seoKeywords,
                  
                  // Physical properties
                  weight: product.weight,
                  dimensions: product.dimensions,
                  weightUnit: product.weightUnit,
                  length: product.length,
                  width: product.width,
                  height: product.height,
                  dimensionUnit: product.dimensionUnit,
                  
                  // Categories
                  categoryName: product.categoryName,
                  categorySlug: product.categorySlug,
                  productCategory: product.productCategory,
                  productCategorySlug: product.productCategorySlug,
                  googleCategoryId: product.googleCategoryId,
                  productParentCategoryId: product.productParentCategoryId,
                  
                  // Variants
                  has_variants: product.hasVariants,
                  variantId: product.variantId,
                  variantName: product.variantName,
                  variantSku: product.variantSku,
                  variantColor: product.variantColor,
                  variantSize: product.variantSize,
                  variantMaterial: product.variantMaterial,
                  variantStyle: product.variantStyle,
                  
                  // Product types
                  productType: product.productType,
                  isDigitalProduct: product.isDigitalProduct,
                  isPhysicalProduct: product.isPhysicalProduct,
                  isService: product.isService,
                  isBundle: product.isBundle,
                  isCustomizable: product.isCustomizable,
                  isTrackable: product.isTrackable,
                  
                  // Rich descriptions
                  marketingDescription: product.marketingDescription,
                  
                  // Shop info
                  tenantName: product.tenantName,
                  tenantLogoUrl: product.tenantLogoUrl,
                  shopCategory: product.shopCategory,
                  shopCategoryId: product.shopCategoryId,
                  shopGoogleCategoryId: product.shopGoogleCategoryId,
                  
                  // Location
                  tenantCity: product.tenantCity,
                  tenantState: product.tenantState,
                  tenantCountry: product.tenantCountry,
                  tenantZip: product.tenantZip,
                  tenantAddress: product.tenantAddress,
                  tenantLatitude: product.tenantLatitude,
                  tenantLongitude: product.tenantLongitude,
                  timezone: product.timezone,
                  
                  // Business info
                  businessType: product.businessType,
                  businessCategory: product.businessCategory,
                  businessSize: product.businessSize,
                  establishedYear: product.establishedYear,
                  
                  // Status indicators
                  inStock: product.inStock,
                  stockStatus: product.stockStatus,
                  priceStatus: product.priceStatus,
                  
                  // Analytics
                  bucketPriority: product.bucketPriority,
                  trendingScore: product.trendingScore,
                  
                  // Timestamps
                  createdAt: product.createdAt,
                  updatedAt: product.updatedAt,
                  publishedAt: product.publishedAt,
                  
                  // Featured system
                  featuredType: product.featuredType as 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick',
                  featuredTypes: product.featuredTypes,
                  featuredPriority: product.featuredPriority,
                  featuredAt: product.featuredAt,
                  featuredExpiresAt: product.featuredExpiresAt,
                  isFeaturedActive: product.isFeaturedActive,
                  daysUntilExpiration: product.daysUntilExpiration,
                  isExpired: product.isExpired,
                  isExpiringSoon: product.isExpiringSoon,
                  autoUnfeature: product.autoUnfeature,
                  
                  // Legacy metadata
                  metadata: {
                    featuredTypes: product.featuredTypes
                  }
                }}
                variant="list"
                showCategory={true}
                showDescription={true}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function StorefrontFeaturedProducts({ tenantId }: { tenantId: string }) {
  const [allProducts, setAllProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchAllProducts = async () => {
      try {
        // Use StorefrontSingletonService for backend API call with caching
        const data = await storefrontService.getFeaturedProducts(tenantId, { limit: 50 });
        
        if (data.items && isMounted) {
          // Transform the data to match the expected format with all rich fields
          const transformedProducts = data.items.map((product: any) => ({
            // Basic product info
            id: product.id,
            sku: product.sku,
            name: product.name,
            title: product.title,
            description: product.description,
            
            // Pricing
            price: product.price || 0,
            priceCents: product.priceCents,
            salePrice: product.salePrice,
            salePriceCents: product.salePriceCents,
            listPriceCents: product.listPriceCents,
            currency: product.currency || 'USD',
            
            // Inventory & Availability
            stock: product.stock || 0,
            inventoryQuantity: product.inventoryQuantity,
            availability: product.availability,
            itemStatus: product.itemStatus,
            
            // Media
            imageUrl: product.imageUrl,
            imageUrls: product.imageUrls || [],
            videoUrl: product.videoUrl,
            galleryUrls: product.galleryUrls || [],
            thumbnailUrl: product.thumbnailUrl,
            featuredImageUrl: product.featuredImageUrl,
            hasGallery: product.hasGallery,
            
            // Product Details
            brand: product.brand,
            manufacturer: product.manufacturer,
            condition: product.condition,
            gtin: product.gtin,
            mpn: product.mpn,
            
            // Categories
            categoryName: product.categoryName,
            categorySlug: product.categorySlug,
            productCategory: product.productCategory,
            productCategorySlug: product.productCategorySlug,
            googleCategoryId: product.googleCategoryId,
            productParentCategoryId: product.productParentCategoryId,
            
            // Variants
            hasVariants: product.has_variants,
            variantId: product.variantId,
            variantName: product.variantName,
            variantSku: product.variantSku,
            variantColor: product.variantColor,
            variantSize: product.variantSize,
            variantMaterial: product.variantMaterial,
            variantStyle: product.variantStyle,
            
            // Product Types
            productType: product.productType,
            isDigitalProduct: product.isDigitalProduct,
            isPhysicalProduct: product.isPhysicalProduct,
            isService: product.isService,
            isBundle: product.isBundle,
            isCustomizable: product.isCustomizable,
            isTrackable: product.isTrackable,
            
            // Featured Status
            featuredTypes: product.featuredType ? [product.featuredType] : [],
            featuredType: product.featuredType,
            featuredPriority: product.featuredPriority,
            featuredAt: product.featuredAt,
            featuredExpiresAt: product.featuredExpiresAt,
            isFeaturedActive: product.isFeaturedActive,
            isFeatured: true,
            
            // Sales & Discounts
            isOnSale: product.isOnSale,
            discountPercentage: product.discountPercentage,
            
            // Rich Data
            marketingDescription: product.marketingDescription,
            specifications: product.specifications,
            attributes: product.attributes,
            customFields: product.customFields,
            searchKeywords: product.searchKeywords,
            tags: product.tags,
            metadata: product.metadata,
            
            // SEO
            seoTitle: product.seoTitle,
            seoDescription: product.seoDescription,
            seoKeywords: product.seoKeywords,
            
            // Physical Properties
            weight: product.weight,
            dimensions: product.dimensions,
            weightUnit: product.weightUnit,
            length: product.length,
            width: product.width,
            height: product.height,
            dimensionUnit: product.dimensionUnit,
            
            // Inventory Management
            inventoryPolicy: product.inventoryPolicy,
            inventoryTracking: product.inventoryTracking,
            inventoryQuantityTracked: product.inventoryQuantityTracked,
            allowBackorder: product.allowBackorder,
            backorderQuantity: product.backorderQuantity,
            lowStockThreshold: product.lowStockThreshold,
            requiresShipping: product.requiresShipping,
            
            // Shop/Tenant Info
            tenantId: product.tenantId,
            tenantName: product.tenantName,
            tenantLogoUrl: product.tenantLogoUrl,
            tenantCategory: product.tenantCategory||product.shopCategory,
            shopCategory: product.shopCategory,
            shopCategoryId: product.shopCategoryId,
            shopGoogleCategoryId: product.shopGoogleCategoryId,
            
            // Location
            tenantCity: product.tenantCity,
            tenantState: product.tenantState,
            tenantCountry: product.tenantCountry,
            tenantZip: product.tenantZip,
            tenantAddress: product.tenantAddress,
            tenantLatitude: product.tenantLatitude,
            tenantLongitude: product.tenantLongitude,
            timezone: product.timezone,
            
            // Business Info
            businessType: product.businessType,
            businessCategory: product.businessCategory,
            businessSize: product.businessSize,
            establishedYear: product.establishedYear,
            
            // Analytics
            viewCount: product.viewCount,
            uniqueViewers: product.uniqueViewers,
            engagementCount: product.engagementCount,
            conversionCount: product.conversionCount,
            revenueCents: product.revenueCents,
            unitsSold: product.unitsSold,
            
            // Reviews & Social
            averageRating: product.averageRating,
            reviewCount: product.reviewCount,
            wishlistCount: product.wishlistCount,
            shareCount: product.shareCount,
            
            // Payment
            hasActivePaymentGateway: product.hasActivePaymentGateway,
            paymentGatewayType: product.defaultGatewayType,
            
            // Timestamps
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            publishedAt: product.publishedAt,
            
            // Status Indicators
            hasDescription: product.hasDescription,
            hasBrand: product.hasBrand,
            hasPrice: product.hasPrice,
            inStock: product.inStock,
            stockStatus: product.stockStatus,
            priceStatus: product.priceStatus,
            
            // Featured Analytics
            bucketPriority: product.bucketPriority,
            trendingScore: product.trendingScore,
            
            // Featured Expiration
            daysUntilExpiration: product.daysUntilExpiration,
            isExpired: product.isExpired,
            isExpiringSoon: product.isExpiringSoon,
            autoUnfeature: product.autoUnfeature
          }));
          
          setAllProducts(transformedProducts);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError' && isMounted) {
          console.error('Error fetching featured products:', error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAllProducts();

    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  if (loading || allProducts.length === 0) {
    return null;
  }

  // Filter products by type for each section
  const productsByType = {
    new_arrival: allProducts.filter(p => p.featuredType === 'new_arrival'),
    seasonal: allProducts.filter(p => p.featuredType === 'seasonal'),
    sale: allProducts.filter(p => p.featuredType === 'sale'),
    staff_pick: allProducts.filter(p => p.featuredType === 'staff_pick'),
    store_selection: allProducts.filter(p => p.featuredType === 'store_selection')
  };

  return (
    <div className="space-y-0">
      {productsByType.new_arrival.length > 0 && (
        <FeaturedSection
          tenantId={tenantId}
          type="new_arrival"
          {...featuredTypeConfig.new_arrival}
          products={productsByType.new_arrival}
          loading={false}
          maxProducts={8}
        />
      )}
      {productsByType.seasonal.length > 0 && (
        <FeaturedSection
          tenantId={tenantId}
          type="seasonal"
          {...featuredTypeConfig.seasonal}
          products={productsByType.seasonal}
          loading={false}
          maxProducts={8}
        />
      )}
      {productsByType.sale.length > 0 && (
        <FeaturedSection
          tenantId={tenantId}
          type="sale"
          {...featuredTypeConfig.sale}
          products={productsByType.sale}
          loading={false}
          maxProducts={8}
        />
      )}
      {productsByType.staff_pick.length > 0 && (
        <FeaturedSection
          tenantId={tenantId}
          type="staff_pick"
          {...featuredTypeConfig.staff_pick}
          products={productsByType.staff_pick}
          loading={false}
          maxProducts={8}
        />
      )}
      {productsByType.store_selection.length > 0 && (
        <FeaturedSection
          tenantId={tenantId}
          type="store_selection"
          {...featuredTypeConfig.store_selection}
          products={productsByType.store_selection}
          loading={false}
          maxProducts={8}
        />
      )}
    </div>
  );
}
