"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PriceDisplay } from './PriceDisplay';
import ProductWithVariants from './ProductWithVariants';
import { AddToCartButton } from './AddToCartButton';
import { useTenantPaymentOptional } from '@/contexts/TenantPaymentContext';
import { Star, Sparkles, Calendar, Tag, Award } from 'lucide-react';
import { VariantBadge, PriceRangeDisplay } from '@/components/variants';
import type { PriceRange, AvailableAttributes } from '@/types/variants';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { Card, Group, Text, ActionIcon, Button, Badge as MantineBadge } from '@mantine/core';
import { distanceUtils } from '@/lib/utils';

// Helper functions for storefront featured type badges
const getStorefrontBadgeStyle = (typeId: string): string => {
  switch (typeId) {
    // Merchant-controlled types
    case 'store_selection':
      return 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-amber-600';
    case 'new_arrival':
      return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-green-600';
    case 'seasonal':
      return 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-600';
    case 'sale':
      return 'bg-gradient-to-r from-red-500 to-pink-500 text-white border-red-600';
    case 'staff_pick':
      return 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-purple-600';
    case 'clearance':
      return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-yellow-600';
    case 'featured':
      return 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-indigo-600';
      
    // Platform-controlled types (algorithmic)
    case 'trending':
      return 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-600';
    case 'recommended':
      return 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-teal-600';
    case 'bestseller':
      return 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-amber-600';
    case 'random_featured':
      return 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-cyan-600';
      
    default:
      return 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-blue-600';
  }
};

const getStorefrontBadgeIcon = (typeId: string) => {
  switch (typeId) {
    // Merchant-controlled types
    case 'store_selection':
      return <Star className="w-3.5 h-3.5 fill-white" />;
    case 'new_arrival':
      return <Sparkles className="w-3.5 h-3.5 fill-white" />;
    case 'seasonal':
      return <Calendar className="w-3.5 h-3.5 fill-white" />;
    case 'sale':
      return <Tag className="w-3.5 h-3.5 fill-white" />;
    case 'staff_pick':
      return <Award className="w-3.5 h-3.5 fill-white" />;
    case 'clearance':
      return <Tag className="w-3.5 h-3.5 fill-white" />;
    case 'featured':
      return <Award className="w-3.5 h-3.5 fill-white" />;
      
    // Platform-controlled types (algorithmic)
    case 'trending':
      return <Sparkles className="w-3.5 h-3.5 fill-white" />;
    case 'recommended':
      return <Award className="w-3.5 h-3.5 fill-white" />;
    case 'bestseller':
      return <Award className="w-3.5 h-3.5 fill-white" />;
    case 'random_featured':
      return <Sparkles className="w-3.5 h-3.5 fill-white" />;
      
    default:
      return <Star className="w-3.5 h-3.5 fill-white" />;
  }
};

const getStorefrontBadgeText = (typeId: string): string => {
  switch (typeId) {
    // Merchant-controlled types
    case 'store_selection':
      return 'FEATURED';
    case 'new_arrival':
      return 'NEW ARRIVAL';
    case 'seasonal':
      return 'SEASONAL';
    case 'sale':
      return 'SALE';
    case 'staff_pick':
      return 'STAFF PICK';
    case 'clearance':
      return 'CLEARANCE';
    case 'featured':
      return 'PREMIUM';
      
    // Platform-controlled types (algorithmic)
    case 'trending':
      return 'TRENDING';
    case 'recommended':
      return 'RECOMMENDED';
    case 'bestseller':
      return 'BESTSELLER';
    case 'random_featured':
      return 'DISCOVER';
      
    default:
      return 'FEATURED';
  }
};

const getStorefrontGradientBorder = (typeId: string): string => {
  switch (typeId) {
    case 'store_selection':
      return 'bg-gradient-to-br from-blue-400 via-cyan-400 to-teal-400';
    case 'new_arrival':
      return 'bg-gradient-to-br from-green-400 via-emerald-400 to-teal-400';
    case 'seasonal':
      return 'bg-gradient-to-br from-orange-400 via-red-400 to-pink-400';
    case 'sale':
      return 'bg-gradient-to-br from-red-400 via-pink-400 to-rose-400';
    case 'staff_pick':
      return 'bg-gradient-to-br from-purple-400 via-indigo-400 to-blue-400';
    case 'clearance':
      return 'bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400';
    case 'trending':
      return 'bg-gradient-to-br from-pink-400 via-rose-400 to-red-400';
    case 'recommended':
      return 'bg-gradient-to-br from-teal-400 via-cyan-400 to-blue-400';
    case 'bestseller':
      return 'bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400';
    case 'featured':
      return 'bg-gradient-to-br from-rose-400 via-pink-400 to-purple-400';
    default:
      return 'bg-gradient-to-br from-amber-400 via-orange-400 to-red-400';
  }
};

// Featured Type Icon component for image overlay
function FeaturedTypeIcon({ type }: { type: string }) {
  const bgColors: Record<string, string> = {
    store_selection: 'bg-amber-500',
    new_arrival: 'bg-green-500',
    seasonal: 'bg-orange-500',
    sale: 'bg-red-500',
    staff_pick: 'bg-purple-500',
    clearance: 'bg-pink-500',
    trending: 'bg-cyan-500',
    recommended: 'bg-indigo-500',
    bestseller: 'bg-yellow-500',
    featured: 'bg-rose-500',
  };
  
  const bgColor = bgColors[type] || 'bg-gray-500';
  
  return (
    <span 
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${bgColor} text-white shadow-md`}
      title={type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
    >
      {getStorefrontBadgeIcon(type)}
    </span>
  );
}

// Get all featured types for a product (supports multiple badges)
const getFeaturedTypes = (product: ProductData): string[] => {
  // If multiple types are explicitly provided, use them
  if (product.featuredTypes && product.featuredTypes.length > 0) {
    return product.featuredTypes;
  }
  
  // Otherwise, use the single type if available
  if (product.featuredType) {
    return [product.featuredType];
  }
  
  return [];
};

// Get priority order for badge display (most important first)
const getBadgePriority = (typeId: string): number => {
  switch (typeId) {
    case 'sale': return 1; // Sale is most important (drives urgency)
    case 'clearance': return 2; // Clearance is limited time
    case 'new_arrival': return 3; // New arrivals 
    case 'trending': return 4; // Trending items
    case 'seasonal': return 5; // Seasonal items
    case 'bestseller': return 6; // Bestsellers
    case 'staff_pick': return 7; // Staff picks
    case 'recommended': return 8; // Recommended
    case 'store_selection': return 9; // Directory featured
    case 'featured': return 10; // General featured
    default: return 999;
  }
};

// Sort badges by priority
const sortBadgesByPriority = (types: string[]): string[] => {
  return types.sort((a, b) => getBadgePriority(a) - getBadgePriority(b));
};

interface ProductData {
  id: string;
  sku: string;
  name: string;
  title?: string;
  brand?: string;
  description?: string;
  priceCents: number;
  salePriceCents?: number;
  listPriceCents?: number;
  stock: number;
  inventoryQuantity?: number;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  galleryUrls?: string[];
  thumbnailUrl?: string;
  featuredImageUrl?: string;
  tenantId: string;
  payment_gateway_type?: string | null;
  payment_gateway_id?: string | null;
  has_variants?: boolean;
  has_active_payment_gateway?: boolean;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  itemStatus?: string;
  isFeatured?: boolean;
  featuredType?: string;
  featuredTypes?: string[]; // Support multiple types
  featuredPriority?: number;
  featuredAt?: string;
  featuredExpiresAt?: string;
  isFeaturedActive?: boolean;
  daysUntilExpiration?: number;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  autoUnfeature?: boolean;
  // Enhanced review fields (live aggregations)
  productRatingLive?: number;
  productReviewsCountLive?: number;
  productHelpfulCountLive?: number;
  productReviewsApprovedLive?: number;
  metadata?: any;
  hasGallery?: boolean;
  hasDescription?: boolean;
  hasBrand?: boolean;
  hasPrice?: boolean;
  tenantCategory?: {
    id: string;
    name: string;
    slug: string;
  };
  // Computed variant fields from backend
  variant_count?: number;
  price_range?: PriceRange;
  available_attributes?: AvailableAttributes;
  variants?: any[];
  
  // Enhanced fields from API
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
  currency?: string;
  
  // Product details
  manufacturer?: string;
  condition?: string;
  gtin?: string;
  mpn?: string;
  specifications?: any;
  attributes?: any;
  customFields?: any;
  searchKeywords?: string[];
  tags?: string[];
  
  // SEO
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
  
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string;
}

interface SmartProductCardProps {
  product: ProductData;
  tenantId: string;
  tenantName?: string;
  tenantLogo?: string;
  tenantCity?: string;
  tenantState?: string;
  tenantSlug?: string;
  distanceKm?: number | null;
  variant?: 'grid' | 'list' | 'compact' | 'featured';
  showCategory?: boolean;
  showDescription?: boolean;
  className?: string;
  productCategory?: string;
  productCategorySlug?: string;
  // Payment gateway status to avoid individual API calls
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string;
  // Button layout for narrow cards
  buttonLayout?: 'horizontal' | 'stacked';
}

export default function SmartProductCard({
  product,
  tenantId,
  tenantName,
  tenantLogo,
  tenantCity,
  tenantState,
  tenantSlug,
  distanceKm,
  variant = 'grid',
  showCategory = true,
  showDescription = true,
  className = '',
  productCategory,
  productCategorySlug,
  hasActivePaymentGateway: propHasActivePaymentGateway,
  defaultGatewayType: propDefaultGatewayType,
  buttonLayout = 'horizontal',
}: SmartProductCardProps) {
  // Try to use context first (performance optimization)
  // console.log(`[SmartProductCard] productCategory: ${productCategory}, productCategorySlug: ${productCategorySlug}`);
  // console.log(`[SmartProductCard] propHasActivePaymentGateway: ${propHasActivePaymentGateway}, propDefaultGatewayType: ${propDefaultGatewayType}`);
  // console.log(`[SmartProductCard] product: ${JSON.stringify(product)}`);
  const contextPayment = useTenantPaymentOptional();
  
  // Fallback state for when context is not available
  const [canPurchase, setCanPurchase] = useState(false);
  const [defaultGatewayType, setDefaultGatewayType] = useState<string | undefined>();

  // Priority: context (fresh API, only when loaded) > props > product data (from MV) > individual API fetch
  // Context takes priority as it fetches fresh gateway status from /public/tenant/:tenantId/payment-gateways
  // IMPORTANT: Only use context when not loading, since context initializes with canPurchase: false
  // and false ?? nextValue returns false (nullish coalescing doesn't skip false)
  const contextCanPurchase = contextPayment && !contextPayment.loading ? contextPayment.canPurchase : undefined;
  const contextGatewayType = contextPayment && !contextPayment.loading ? contextPayment.defaultGatewayType : undefined;
  const effectiveCanPurchase = contextCanPurchase ?? propHasActivePaymentGateway ?? product.has_active_payment_gateway ?? canPurchase;
  const effectiveGatewayType = contextGatewayType ?? propDefaultGatewayType ?? product.payment_gateway_type ?? defaultGatewayType;
  const { status: hoursStatus } = useStoreStatus(product.tenantId, true); // Public scope
   // Status indicator color
  const getStatusColor = () => {
    if (!hoursStatus) return 'bg-gray-400';
    switch (hoursStatus.status) {
      case 'open': return 'bg-green-500';
      case 'closed': return 'bg-red-500';
      case 'opening-soon': return 'bg-blue-500';
      case 'closing-soon': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  // Log effective values
 /*  console.log('[SMARTCARD-DEBUG] Effective Payment Gateway Values:', {
    product_id: product.id,
    tenant_id: product.tenantId,
    effectiveCanPurchase,
    effectiveGatewayType,
    sources: {
      contextPayment: contextPayment?.canPurchase,
      propHasActivePaymentGateway,
      product_has_active_payment_gateway: product.has_active_payment_gateway,
      fallbackCanPurchase: canPurchase
    }
  }); */

  useEffect(() => {
    // Skip individual fetch if props are provided
    if (propHasActivePaymentGateway !== undefined) {
      return;
    }

    // Skip individual fetch if context is available
    if (contextPayment) {
      return;
    }

    // Skip if MV data is available
    if (product.has_active_payment_gateway !== undefined) {
      return;
    }

    const checkPurchaseAbility = async () => {
      try {
        const data = await publicTenantInfoService.getPaymentGatewayStatus(product.tenantId);
        
        if (data) {
          setCanPurchase(data.hasActiveGateway || false);
          setDefaultGatewayType(data.defaultGatewayType || undefined);
        } else {
          setCanPurchase(false);
        }
      } catch (error) {
        console.error('Failed to check payment gateway:', error);
        setCanPurchase(false);
      }
    };

    checkPurchaseAbility();
  }, [product.tenantId, contextPayment, product.has_active_payment_gateway, propHasActivePaymentGateway]);

  // Debug: Log when effectiveCanPurchase changes
 /* useEffect(() => {
     console.log('[SmartProductCard] effectiveCanPurchase changed:', {
      productId: product.id,
      variant,
      effectiveCanPurchase,
      sources: {
        propHasActivePaymentGateway,
        productHasActive: product.has_active_payment_gateway,
        contextCanPurchase: contextPayment?.canPurchase,
        canPurchase
      }
    }); 
  }, [effectiveCanPurchase, product.id, variant, propHasActivePaymentGateway, product.has_active_payment_gateway, contextPayment?.canPurchase, canPurchase]);*/

  const displayTitle = product.title || product.name;
  
  const displayBrand = product.brand || '';

  // console.log(`[SmartProductCard] product: ${JSON.stringify(product, null, 2)}`)
 
  // console.log(`[SmartProductCard] hoursStatus: ${JSON.stringify(hoursStatus, null, 2)}`)

  // Featured variant - Prominent styling for conversion optimization
  if (variant === 'featured') {
    const featuredTypes = getFeaturedTypes(product);
    const sortedTypes = sortBadgesByPriority(featuredTypes);
    const primaryType = sortedTypes[0]; // Use first (highest priority) for gradient border
    
    return (
      <div className={`group relative bg-white dark:bg-neutral-800 rounded-xl overflow-hidden hover:shadow-2xl transition-all duration-300 ${className}`}>
        {/* Featured Badges - Support Multiple */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          {sortedTypes.slice(0, 3).map((typeId, index) => (
            <span 
              key={typeId}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full shadow-lg ${getStorefrontBadgeStyle(typeId)}`}
              style={{ 
                fontSize: index === 0 ? '0.75rem' : '0.625rem', // Primary badge slightly larger
                padding: index === 0 ? '0.375rem 0.75rem' : '0.25rem 0.5rem'
              }}
            >
              {getStorefrontBadgeIcon(typeId)}
              {getStorefrontBadgeText(typeId)}
            </span>
          ))}
        </div>

        {/* Gradient Border Effect - Use primary type */}
        <div className={`absolute inset-0 ${getStorefrontGradientBorder(primaryType || 'store_selection')} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl`} style={{ padding: '2px' }}>
          <div className="w-full h-full bg-white dark:bg-neutral-800 rounded-xl"></div>
        </div>

        <div className="relative">
          {/* Featured Image - Larger */}
          <Link href={`/products/${product.id}`} className="relative block aspect-square bg-neutral-100 dark:bg-neutral-700">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={displayTitle}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            {product.availability === 'out_of_stock' && (
              <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-3 py-1.5 rounded-full font-semibold">
                Out of Stock
              </div>
            )}
            {product.availability === 'preorder' && (
              <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-full font-semibold">
                Pre-order
              </div>
            )}
          </Link>

          {/* Featured Info - Enhanced */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-2">
              {displayBrand && (
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                  {displayBrand}
                </p>
              )}
              {showCategory && (product.productCategory || (product as any).tenantCategory?.name) && (
                <span className="text-xs px-2.5 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full font-medium">
                  {typeof product.productCategory === 'string' ? product.productCategory : (product as any).tenantCategory?.name || productCategory}
                </span>
              )}
            </div>
            
            {/* Store Information for Directory Context */}
            {tenantName && (
              <Link 
                href={tenantSlug ? `/directory/${tenantSlug}` : `/shops/${tenantSlug ? tenantSlug : tenantId}`}
                className="flex items-center gap-2 mb-3 p-2 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors group"
                title={`Visit ${tenantName} store`}
              >
                {tenantLogo ? (
                  <Image
                    src={tenantLogo}
                    alt={tenantName}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-lg object-cover"
                    sizes="24px"
                  />
                ) : (
                  <div className="w-6 h-6 bg-neutral-200 dark:bg-neutral-600 rounded-lg flex items-center justify-center">
                    <svg className="w-3 h-3 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {tenantName}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {tenantCity && tenantState ? `${tenantCity}, ${tenantState}` : 'Available at this store'}
                    {distanceKm !== null && distanceKm !== undefined && ` • ${distanceUtils.formatDistance(distanceKm)}`}
                  </p>
                </div>
                <div className="text-neutral-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
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
			
              </Link>
            )}
            
            <Link href={`/products/${product.id}`}>
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white line-clamp-2 mb-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {displayTitle}
              </h3>
            </Link>

            {showDescription && product.description && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-4">
                {product.description}
              </p>
            )}

            {/* Enhanced Product Info */}
            <div className="space-y-3 mb-4">
              {/* Brand and Rating Row */}
              <div className="flex items-center justify-between">
                {displayBrand && (
                  <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                    {displayBrand}
                  </p>
                )}
                
                {/* Rating - Product-specific data only */}
                {product.productRatingLive !== undefined && product.productRatingLive !== null && (
                  <div className="flex items-center gap-1">
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm text-neutral-600 dark:text-neutral-400 ml-1">
                        {typeof product.productRatingLive === 'number' 
                          ? product.productRatingLive.toFixed(1)
                          : parseFloat(String(product.productRatingLive)).toFixed(1)
                        }
                      </span>
                    </div>
                    <span className="text-xs text-neutral-500 dark:text-neutral-500">
                      ({product.productReviewsCountLive || 0})
                    </span>
                  </div>
                )}
              </div>

              {/* Media Indicators */}
              {(product.hasGallery || product.videoUrl) && (
                <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                  {product.hasGallery && (
                    <span className="flex items-center gap-1">
                      📷 Gallery
                    </span>
                  )}
                  {product.videoUrl && (
                    <span className="flex items-center gap-1">
                      🎥 Video
                    </span>
                  )}
                </div>
              )}

              {/* Engagement Metrics */}
              {(product.viewCount || product.wishlistCount) && (
                <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                  {product.viewCount && (
                    <span className="flex items-center gap-1">
                      👁️ {product.viewCount.toLocaleString()} views
                    </span>
                  )}
                  {product.wishlistCount && (
                    <span className="flex items-center gap-1">
                      ❤️ {product.wishlistCount.toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {/* Sale Badge */}
              {product.isOnSale && product.discountPercentage && (
                <div className="inline-flex">
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                    {product.discountPercentage}% OFF
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-4">
              {product.has_variants && product.price_range ? (
                <div>
                  <PriceRangeDisplay 
                    priceRange={product.price_range} 
                    size="lg"
                  />
                  <VariantBadge 
                    variantCount={product.variant_count || 0} 
                    size="sm"
                    className="mt-1"
                  />
                </div>
              ) : (
                <PriceDisplay
                  priceCents={product.priceCents}
                  salePriceCents={product.salePriceCents}
                  variant="large"
                  showSavingsBadge={true}
                />
              )}
              <div className="text-right">
                {product.sku && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    SKU: {product.sku}
                  </p>
                )}
                <p className={`text-xs font-semibold ${
                  product.stock === 0 
                    ? 'text-red-600 dark:text-red-400' 
                    : product.stock < 10 
                      ? 'text-amber-600 dark:text-amber-400' 
                      : 'text-green-600 dark:text-green-400'
                }`}>
                  Stock: {product.stock}
                </p>
              </div>
            </div>

            {/* Purchase UI - Prominent */}
            {(() => {
             /*  console.log('[SmartProductCard] Featured variant render check:', {
                productId: product.id,
                effectiveCanPurchase,
                hasVariants: product.has_variants
              }); */
              return effectiveCanPurchase && (
                <div className="mt-4">
                  {(product.has_variants === true) ? (
                    <ProductWithVariants
                      product={product}
                      tenantId={tenantId}
                      tenantName={tenantName || ''}
                      tenantLogo={tenantLogo}
                      defaultGatewayType={effectiveGatewayType}
                      className="w-full"
                    />
                  ) : (
                    <AddToCartButton
                      product={product}
                      tenantName={tenantName || ''}
                      tenantLogo={tenantLogo}
                      hasActivePaymentGateway={effectiveCanPurchase}
                      defaultGatewayType={effectiveGatewayType}
                      layout={buttonLayout}
                      className="w-full"
                    />
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 hover:shadow-md transition-shadow ${className}`}>
        <div className="flex gap-3">
          {/* Compact Image */}
          <Link href={`/products/${product.id}`} className="relative w-16 h-16 shrink-0 bg-neutral-100 dark:bg-neutral-700 rounded">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={displayTitle}
                fill
                className="object-cover rounded"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </Link>

          {/* Compact Info */}
          <div className="flex-1 min-w-0">
            <Link href={`/products/${product.id}`}>
              <h4 className="font-medium text-sm text-neutral-900 dark:text-white truncate">
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
			
                {displayTitle}
              </h4>
            </Link>
            
            {/* Brand if available */}
            {product.brand && product.brand !== tenantName && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                by {product.brand}
              </p>
            )}
            
            {/* Rating and Engagement for Compact */}
            <div className="flex items-center justify-between mt-1">
              {/* Rating - Product-specific data only */}
              {product.productRatingLive !== undefined && product.productRatingLive !== null && (
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs text-neutral-600 dark:text-neutral-400">
                    {typeof product.productRatingLive === 'number' 
                      ? product.productRatingLive.toFixed(1)
                      : parseFloat(String(product.productRatingLive)).toFixed(1)
                    }
                  </span>
                  {product.productReviewsCountLive && (
                    <span className="text-xs text-neutral-500">
                      ({product.productReviewsCountLive})
                    </span>
                  )}
                </div>
              )}
              
              {/* Media Indicators */}
              {(product.hasGallery || product.videoUrl) && (
                <div className="flex items-center gap-1 text-xs text-neutral-500">
                  {product.hasGallery && (
                    <span>📷</span>
                  )}
                  {product.videoUrl && (
                    <span>🎥</span>
                  )}
                </div>
              )}
              
              {/* Engagement */}
              {product.viewCount && !product.hasGallery && !product.videoUrl && (
                <span className="text-xs text-neutral-500">
                  👁️ {product.viewCount > 999 ? `${(product.viewCount / 1000).toFixed(1)}k` : product.viewCount}
                </span>
              )}
            </div>
            
            {/* Store Information for Directory Context */}
            {tenantName && (
              <div className="flex items-center gap-1 mt-0.5">
                {tenantLogo ? (
                  <Image
                    src={tenantLogo}
                    alt={tenantName}
                    width={16}
                    height={16}
                    className="w-4 h-4 rounded object-cover"
                  />
                ) : (
                  <div className="w-4 h-4 bg-neutral-200 dark:bg-neutral-600 rounded flex items-center justify-center">
                    <svg className="w-2 h-2 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                    {tenantName}
                    {tenantCity && tenantState && ` • ${tenantCity}`}
                    {distanceKm !== null && distanceKm !== undefined && ` • ${Math.round(distanceKm)}km`}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-1 mt-0.5">
              {product.has_variants && product.price_range ? (
                <PriceRangeDisplay 
                  priceRange={product.price_range} 
                  size="sm"
                />
              ) : (
                // <PriceDisplay
                //   priceCents={product.priceCents}
                //   salePriceCents={product.salePriceCents}
                //   variant="compact"
                // />
                <div>Price: ${product.priceCents / 100}</div>
              )}
              {product.salePriceCents && !product.has_variants && (
                <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 px-1.5 py-0.5 rounded">
                  {product.discountPercentage ? `${product.discountPercentage}% OFF` : 'Sale'}
                </span>
              )}
              {product.has_variants && product.variant_count && (
                <VariantBadge 
                  variantCount={product.variant_count} 
                  size="sm"
                  showIcon={false}
                />
              )}
            </div>
            
            {/* Category and Stock Status */}
            <div className="flex items-center gap-2 mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {showCategory && (product.categoryName || product.productCategory) && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {product.categoryName || (typeof product.productCategory === 'string' ? product.productCategory : productCategory)}
                </span>
              )}
              {product.condition && (
                <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded capitalize">
                  {product.condition.replace('_', ' ')}
                </span>
              )}
              {(product.inStock === true || (product.stock && product.stock > 0)) && (
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                  ✓ In Stock
                </span>
              )}
              {product.inStock === false && (
                <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                  Out of Stock
                </span>
              )}
              {product.stock !== undefined && product.stock !== null && (
                <>
                  {(showCategory && (product.categoryName || product.productCategory)) || product.condition || product.inStock !== undefined ? <span>•</span> : null}
                  <span className={`flex items-center gap-1 ${
                    product.stock === 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : product.stock <= 5 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-green-600 dark:text-green-400'
                  }`}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    {product.stock === 0 
                      ? 'Out of Stock' 
                      : product.stock <= 5 
                        ? `Only ${product.stock} left` 
                        : 'In Stock'
                    }
                  </span>
                </>
              )}
              {product.has_variants && (
                <>
                  {(showCategory && product.productCategory) || (product.stock !== undefined && product.stock !== null) ? <span>•</span> : null}
                  <span className="text-blue-600 dark:text-blue-400">
                    Multiple options
                  </span>
                </>
              )}
            </div>
            
            {effectiveCanPurchase && (
              <div className="mt-2">
                {(product.has_variants === true) ? (
                  <ProductWithVariants
                    product={product}
                    tenantId={tenantId}
                    tenantName={tenantName || ''}
                    tenantLogo={tenantLogo}
                    defaultGatewayType={effectiveGatewayType}
                  />
                ) : (
                  <AddToCartButton
                    product={product}
                    tenantName={tenantName || ''}
                    tenantLogo={tenantLogo}
                    hasActivePaymentGateway={effectiveCanPurchase}
                    defaultGatewayType={effectiveGatewayType}
                    layout={buttonLayout}
                    className="text-xs py-1"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-lg transition-shadow flex ${className}`}>
        {/* List Image */}
        <Link href={`/products/${product.id}`} className="relative w-32 h-32 shrink-0 bg-neutral-100 dark:bg-neutral-700 block overflow-hidden">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={displayTitle}
              width={128}
              height={128}
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 800px) 33vw, 25vw"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {product.availability === 'out_of_stock' && (
            <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
              Out of Stock
            </div>
          )}
          {product.availability === 'preorder' && (
            <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
              Pre-order
            </div>
          )}
        </Link>

        {/* List Info */}
        <div className="p-6 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  {displayBrand && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {displayBrand}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    {(() => {
                      const featuredTypes = getFeaturedTypes(product);
                      const sortedTypes = sortBadgesByPriority(featuredTypes);
                      return sortedTypes.slice(0, 2).map((typeId) => (
                        <span key={typeId} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full shadow-lg ${getStorefrontBadgeStyle(typeId)}`}>
                          {getStorefrontBadgeIcon(typeId)}
                          {getStorefrontBadgeText(typeId)}
                        </span>
                      ));
                    })()}
                    {showCategory && (product.categoryName || product.productCategory) && (
                      <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
                        {product.categoryName || (typeof product.productCategory === 'string' ? product.productCategory : productCategory)}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Store Information for Directory Context */}
                {tenantName && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
                    {tenantLogo ? (
                      <Image
                        src={tenantLogo}
                        alt={tenantName}
                        width={20}
                        height={20}
                        className="w-5 h-5 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-5 h-5 bg-neutral-200 dark:bg-neutral-600 rounded-lg flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-900 dark:text-white truncate">
                        {tenantName}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {tenantCity && tenantState ? `${tenantCity}, ${tenantState}` : 'Available at this store'}
                        {distanceKm !== null && distanceKm !== undefined && ` • ${distanceUtils.formatDistance(distanceKm)}`}
                      </p>
                    </div>
                  </div>
                )}
                <Link href={`/products/${product.id}`}>
                  <h3 className="font-semibold text-lg text-neutral-900 dark:text-white mb-2 hover:text-primary-600 dark:hover:text-primary-400">
                    
                    {displayTitle}

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
                  </h3>
                </Link>
              </div>
              <div className="ml-4">
                {product.has_variants && product.price_range ? (
                  <div className="text-right">
                    <PriceRangeDisplay 
                      priceRange={product.price_range} 
                      size="default"
                    />
                    <VariantBadge 
                      variantCount={product.variant_count || 0} 
                      size="sm"
                      className="mt-1 inline-block"
                    />
                  </div>
                ) : (
                  <PriceDisplay
                    priceCents={product.priceCents}
                    salePriceCents={product.salePriceCents}
                    variant="default"
                    showSavingsBadge={true}
                  />
                )}
              </div>
            </div>
            {showDescription && product.description && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                {product.description}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-neutral-500">SKU: {product.sku}</span>
              {product.condition && (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded capitalize">
                  {product.condition.replace('_', ' ')}
                </span>
              )}
              {(product.inStock === true || (product.stock && product.stock > 0)) && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                  ✓ In Stock
                </span>
              )}
              {product.inStock === false && (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                  Out of Stock
                </span>
              )}
              {product.stock !== undefined && product.stock !== null && (
                <span className={`font-medium ${
                  product.stock === 0 
                    ? 'text-red-600 dark:text-red-400' 
                    : product.stock < 10 
                      ? 'text-amber-600 dark:text-amber-400' 
                      : 'text-green-600 dark:text-green-400'
                }`}>
                  Stock: {product.stock}
                </span>
              )}
            </div>
            {effectiveCanPurchase && (
              (product.has_variants === true) ? (
                <ProductWithVariants
                  product={product}
                  tenantId={tenantId}
                  tenantName={tenantName || ''}
                  tenantLogo={tenantLogo}
                  defaultGatewayType={effectiveGatewayType}
                />
              ) : (
                <AddToCartButton
                  product={product}
                  tenantName={tenantName || ''}
                  tenantLogo={tenantLogo}
                  hasActivePaymentGateway={effectiveCanPurchase}
                  defaultGatewayType={effectiveGatewayType}
                  layout={buttonLayout}
                />
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grid variant (default)
  return (
    <div className={`group bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-lg transition-shadow ${className}`}>
      {/* Grid Image */}
      <Link href={`/products/${product.id}`} className="block relative aspect-square bg-neutral-100 dark:bg-neutral-700">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={displayTitle}
            width={512}
            height={512}
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {/* Featured Type Icons Overlay */}
        {product.featuredTypes && product.featuredTypes.length > 0 && (
          <div className="absolute bottom-2 left-2 flex flex-col gap-1">
            {product.featuredTypes.map((type, index) => (
              <FeaturedTypeIcon key={index} type={type} />
            ))}
          </div>
        )}
        {product.availability === 'out_of_stock' && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
            Out of Stock
          </div>
        )}
        {product.availability === 'preorder' && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
            Pre-order
          </div>
        )}
      </Link>

      {/* Grid Info */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          {displayBrand && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {displayBrand}
            </p>
          )}
          {(showCategory && (product.categoryName || product.productCategory)) && (
            <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
              {product.categoryName || (typeof product.productCategory === 'string' ? product.productCategory : productCategory)}
            </span>
          )}
        </div>
        
        <Link href={`/products/${product.id}`}>
          <h3 className="font-semibold text-lg text-neutral-900 dark:text-white mb-2 hover:text-primary-600 dark:hover:text-primary-400">
           
            {displayTitle}

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
          </h3>
        </Link>
        
        {showDescription && product.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
            {product.description}
          </p>
        )}
        
        <div className="flex items-center justify-between mb-3">
          {/* Condition and Stock Status */}
          <div className="flex items-center gap-2 text-xs">
            {product.condition && (
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded capitalize">
                {product.condition.replace('_', ' ')}
              </span>
            )}
            {(product.inStock === true || (product.stock && product.stock > 0)) && (
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                ✓ In Stock
              </span>
            )}
            {product.inStock === false && (
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                Out of Stock
              </span>
            )}
          </div>
          
          <div className="flex-1">
            {product.has_variants && product.price_range ? (
              <>
                <PriceRangeDisplay 
                  priceRange={product.price_range} 
                  size="default"
                />
                <VariantBadge 
                  variantCount={product.variant_count || 0} 
                  size="sm"
                  className="mt-1"
                />
              </>
            ) : (
              <PriceDisplay
                priceCents={product.priceCents}
                salePriceCents={product.salePriceCents}
                variant="default"
                showSavingsBadge={true}
              />
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-500">
              SKU: {product.sku}
            </p>
            {product.stock !== undefined && product.stock !== null && (
              <p className={`text-xs font-medium ${
                product.stock === 0 
                  ? 'text-red-600 dark:text-red-400' 
                  : product.stock < 10 
                    ? 'text-amber-600 dark:text-amber-400' 
                    : 'text-green-600 dark:text-green-400'
              }`}>
                Stock: {product.stock}
              </p>
            )}
          </div>
        </div>

        {effectiveCanPurchase && (
            (product.has_variants === true) ? (
              <ProductWithVariants
                product={product}
                tenantId={tenantId}
                tenantName={tenantName || ''}
                tenantLogo={tenantLogo}
                defaultGatewayType={effectiveGatewayType}
                className="w-full"
              />
            ) : (
              <AddToCartButton
                product={product}
                tenantName={tenantName || ''}
                tenantLogo={tenantLogo}
                hasActivePaymentGateway={effectiveCanPurchase}
                defaultGatewayType={effectiveGatewayType}
                layout={buttonLayout}
                className="w-full"
              />
            )
          )}
      </div>
    </div>
  );
}
