"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PriceDisplay } from './PriceDisplay';
import { AddToCartButton } from './AddToCartButton';
import { useTenantPaymentOptional } from '@/contexts/TenantPaymentContext';
import { usePublicCommerceCapability, usePublicPaymentGatewayCapability } from '@/hooks/tenant-access/usePublicCapabilityAccess';
import { Star, Sparkles, Calendar, Tag, Award, Download, Globe, Package } from 'lucide-react';
import { VariantBadge, PriceRangeDisplay } from '@/components/variants';
import { ProductTypeBadge } from './ProductTypeBadge';
import type { PriceRange, AvailableAttributes } from '@/types/variants';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { Card, Group, Text, ActionIcon, Button, Badge as MantineBadge } from '@mantine/core';
import { distanceUtils } from '@/lib/utils';
import HoursStatusBadge from '../storefront/HoursStatusBadge';
import { PromotedBadge, promotedCardClass } from './PromotedBadge';
import { clientLogger } from '@/lib/client-logger';

// Type-aware CTA: renders the correct button based on productType
function TypeAwareCTA({
  product,
  tenantName,
  tenantLogo,
  effectiveCanPurchase,
  effectiveGatewayType,
  propHasActivePaymentGateway,
  propDefaultGatewayType,
  buttonLayout,
  commerceDisabled,
  className,
  compact = false,
}: {
  product: ProductData;
  tenantName: string;
  tenantLogo?: string;
  effectiveCanPurchase: boolean;
  effectiveGatewayType?: string;
  propHasActivePaymentGateway?: boolean;
  propDefaultGatewayType?: string;
  buttonLayout: 'horizontal' | 'stacked';
  commerceDisabled: boolean;
  className?: string;
  compact?: boolean;
}) {
  const productType = product.productType || 'physical';

  // Digital products: "Get" button linking to product page for download flow
  if (productType === 'digital') {
    return (
      <Link
        href={`/products/${product.id}`}
        className={`inline-flex items-center justify-center w-full rounded-md border border-blue-300 bg-blue-50 ${compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'} font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors`}
      >
        <Download className={`mr-2 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
        Get
      </Link>
    );
  }

  // Service products: "Book Now" button linking to product page for booking flow
  if (productType === 'service') {
    return (
      <Link
        href={`/products/${product.id}`}
        className={`inline-flex items-center justify-center w-full rounded-md border border-green-300 bg-green-50 ${compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'} font-medium text-green-700 hover:bg-green-100 hover:border-green-400 transition-colors`}
      >
        <Calendar className={`mr-2 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
        Book Now
      </Link>
    );
  }

  // Physical / Hybrid: existing flow (View Options if variants, else AddToCartButton)
  if (product.has_variants === true && !commerceDisabled) {
    return (
      <Link
        href={`/products/${product.id}`}
        className={`inline-flex items-center justify-center w-full rounded-md border border-gray-300 bg-white ${compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'} font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors ${className || ''}`}
      >
        View Options
      </Link>
    );
  }

  return (
    <AddToCartButton
      product={product}
      tenantName={tenantName}
      tenantLogo={tenantLogo}
      hasActivePaymentGateway={effectiveCanPurchase || propHasActivePaymentGateway}
      defaultGatewayType={effectiveGatewayType || propDefaultGatewayType}
      layout={buttonLayout}
      commerceDisabled={commerceDisabled}
      className={className}
    />
  );
}

// Whether stock info should be shown for this product type
function shouldShowStock(productType: string): boolean {
  const type = productType || 'physical';
  return type === 'physical' || type === 'hybrid';
}

// Type-specific metadata row: shows relevant fields from product.metadata based on productType
function TypeMetadataRow({ product, compact = false }: { product: ProductData; compact?: boolean }) {
  const productType = product.productType || 'physical';
  const metadata = (product as any).metadata || {};
  const items: { icon: string; label: string }[] = [];

  if (productType === 'digital') {
    const fileType = metadata.fileType || metadata.file_type || (product as any).fileType;
    const fileSize = metadata.fileSize || metadata.file_size || (product as any).fileSize;
    const licenseType = metadata.licenseType || metadata.license_type || (product as any).licenseType;
    if (fileType) items.push({ icon: 'file', label: fileType });
    if (fileSize) items.push({ icon: 'download', label: fileSize });
    if (licenseType) items.push({ icon: 'check', label: licenseType });
  } else if (productType === 'service') {
    const durationMinutes = metadata.durationMinutes || metadata.duration_minutes || (product as any).durationMinutes;
    const serviceArea = metadata.serviceArea || metadata.service_area || (product as any).serviceArea;
    const serviceLocation = metadata.serviceLocation || metadata.service_location || (product as any).serviceLocation;
    const providerName = metadata.providerName || metadata.provider_name || (product as any).providerName;
    if (durationMinutes) items.push({ icon: 'clock', label: `${durationMinutes} min` });
    if (serviceLocation) items.push({ icon: 'pin', label: serviceLocation.replace(/_/g, ' ') });
    if (serviceArea) items.push({ icon: 'area', label: serviceArea });
    if (providerName) items.push({ icon: 'user', label: providerName });
  } else if (productType === 'hybrid') {
    const digitalComponent = metadata.digitalComponent || metadata.digital_component || (product as any).digitalComponent;
    const physicalComponent = metadata.physicalComponent || metadata.physical_component || (product as any).physicalComponent;
    if (physicalComponent) items.push({ icon: 'box', label: physicalComponent });
    if (digitalComponent) items.push({ icon: 'download', label: digitalComponent });
  }

  if (items.length === 0) return null;

  const maxItems = compact ? 2 : 3;
  const displayItems = items.slice(0, maxItems);
  const sizeClasses = compact ? 'text-[0.625rem] gap-2' : 'text-xs gap-3';
  const iconSize = compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';

  return (
    <div className={`flex flex-wrap items-center ${sizeClasses} text-neutral-500 dark:text-neutral-400`}>
      {displayItems.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {item.icon === 'file' && (
            <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          )}
          {item.icon === 'download' && (
            <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          )}
          {item.icon === 'check' && (
            <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {item.icon === 'clock' && (
            <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {item.icon === 'pin' && (
            <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          )}
          {item.icon === 'area' && (
            <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          )}
          {item.icon === 'user' && (
            <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          )}
          {item.icon === 'box' && (
            <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

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

// Aspect ratio classes for image container
const aspectRatioClasses: Record<string, string> = {
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '3:4': 'aspect-[3/4]',
  '16:9': 'aspect-video',
};

// Truncate text helper
const truncateText = (text: string, maxLength?: number): string => {
  if (!maxLength || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
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
  promotional_priority?: number;
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
  // Immersive layout enhancements
  showQuickAdd?: boolean;       // Overlay add-to-cart on hover
  showQuickView?: boolean;      // "Quick View" eye icon on hover
  imageAspectRatio?: '1:1' | '4:3' | '3:4' | '16:9';  // Configurable aspect
  truncateTitle?: number;       // Max chars before ellipsis
  /** Only show badges for these featured types (gated types filtered out) */
  allowedFeaturedTypes?: string[];
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
  variant = 'featured',
  showCategory = true,
  showDescription = true,
  className = '',
  productCategory,
  productCategorySlug,
  hasActivePaymentGateway: propHasActivePaymentGateway,
  defaultGatewayType: propDefaultGatewayType,
  buttonLayout = 'stacked',
  showQuickAdd = false,
  showQuickView = false,
  imageAspectRatio = '1:1',
  truncateTitle,
  allowedFeaturedTypes,
}: SmartProductCardProps) {
  // Debug: Log tenant info for directory featured products
  // if (variant === 'featured') {
  //   console.log(`[SmartProductCard] Featured product tenant info:`, {
  //     id: product.id,
  //     name: product.name,
  //     tenantName,
  //     tenantLogo,
  //     tenantSlug
  //   });
  // }
  //   // Try to use context first (performance optimization)
  const contextPayment = useTenantPaymentOptional();
  
  // Fallback state for when context is not available
  const [canPurchase, setCanPurchase] = useState(false);
  const [defaultGatewayType, setDefaultGatewayType] = useState<string | undefined>();

  // Priority: context (fresh API, only when loaded) > props > product data (from MV) > individual API fetch
  // Context takes priority as it fetches fresh gateway status from /public/tenant/:tenantId/payment-gateways
  // IMPORTANT: Only use context when not loading, since context initializes with canPurchase: false
  // and false ?? nextValue returns false (nullish coalescing doesn't skip false)
  const contextCanPurchase = contextPayment && !contextPayment.loading ? contextPayment.canPurchase : undefined;
  const contextGatewayType = contextPayment && !contextPayment.loading ? contextPayment.defaultGatewayType : product.payment_gateway_type ?? defaultGatewayType;

  // Capability-aware commerce and payment gateway resolution
  const commerceCap = usePublicCommerceCapability(product.tenantId);
  const paymentCap = usePublicPaymentGatewayCapability(product.tenantId);

  // Simplified: Check for gateway_type instead of boolean status
  const effectiveGatewayType = contextGatewayType ?? propDefaultGatewayType ?? product.payment_gateway_type ?? defaultGatewayType;
  const hasGateway = !!effectiveGatewayType; // Has gateway if gateway_type exists

  // Capability gating: commerce must be enabled AND gateway capability must be enabled AND gateway must exist
  const commerceEnabled = commerceCap.data?.enabled ?? true; // default to true while loading
  const gatewayCapEnabled = paymentCap.data?.enabled ?? true; // default to true while loading
  const effectiveCanPurchase = hasGateway && commerceEnabled && gatewayCapEnabled;
  const commerceDisabled = !!((commerceCap.data && !commerceCap.data.enabled) || (paymentCap.data && !paymentCap.data.enabled));
  
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

  useEffect(() => {
    // Skip individual fetch if props are provided
    if (effectiveGatewayType && effectiveCanPurchase) {
      return;
    }

    // Skip individual fetch if context is available
    if (contextPayment) {
      return;
    }

    // Skip if MV data confirms gateway exists (trust positive, verify negative — MV may be stale)
    if (product.has_active_payment_gateway === true) {
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
        clientLogger.error('Failed to check payment gateway:', { detail: error });
        setCanPurchase(false);
      }
    };

    checkPurchaseAbility();
  }, [product.tenantId, contextPayment, product.has_active_payment_gateway, propHasActivePaymentGateway||product.has_active_payment_gateway]);

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

  const productType = product.productType || 'physical';
  const showStock = shouldShowStock(productType);

  // console.log(`[SmartProductCard] product: ${JSON.stringify(product, null, 2)}`)
 
  // console.log(`[SmartProductCard] hoursStatus: ${JSON.stringify(hoursStatus, null, 2)}`)

  // Featured variant - Prominent styling for conversion optimization
  if (variant === 'featured') {
    const featuredTypes = getFeaturedTypes(product)
      .filter(t => !allowedFeaturedTypes || allowedFeaturedTypes.includes(t));
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
                    style={{ width: 'auto', height: 'auto' }}
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

            {/* Type-specific metadata */}
            <div className="mb-4">
              <TypeMetadataRow product={product} />
            </div>

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
                {showStock && (
                  <p className={`text-xs font-semibold ${
                    product.stock === 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : product.stock < 10 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-green-600 dark:text-green-400'
                  }`}>
                    Stock: {product.stock}
                  </p>
                )}
                <div className="mt-1">
                  <ProductTypeBadge productType={productType} />
                </div>
              </div>
            </div>

            {/* Purchase UI - Type-aware CTA */}
            {(effectiveCanPurchase || commerceDisabled) && (
              <div className="mt-4">
                <TypeAwareCTA
                  product={product}
                  tenantName={tenantName || ''}
                  tenantLogo={tenantLogo}
                  effectiveCanPurchase={effectiveCanPurchase}
                  effectiveGatewayType={effectiveGatewayType}
                  propHasActivePaymentGateway={propHasActivePaymentGateway}
                  propDefaultGatewayType={propDefaultGatewayType}
                  buttonLayout={buttonLayout}
                  commerceDisabled={commerceDisabled}
                  className="w-full"
                />
              </div>
            )}
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
                sizes="64px"
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
                    style={{ width: 'auto', height: 'auto' }}
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
            
            <div className="mt-0.5">
              <TypeMetadataRow product={product} compact />
            </div>

            <div className="flex items-center gap-1 mt-0.5">
              {product.has_variants && product.price_range ? (
                <PriceRangeDisplay 
                  priceRange={product.price_range} 
                  size="sm"
                />
              ) : (
                <div className="flex items-center justify-between">
                  <PriceDisplay
                    priceCents={product.priceCents}
                    salePriceCents={product.salePriceCents}
                    variant="compact"
                    showSavingsBadge={true}
                  />
                  {product.salePriceCents && product.salePriceCents > 0 && product.salePriceCents < product.priceCents && (
                    <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                      Sale
                    </span>
                  )}
                </div>
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
              {showStock && (product.inStock === true || (product.stock && product.stock > 0)) && (
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                  ✓ In Stock
                </span>
              )}
              {showStock && product.inStock === false && (
                <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                  Out of Stock
                </span>
              )}
              {showStock && product.stock !== undefined && product.stock !== null && (
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
              <ProductTypeBadge productType={productType} size="xs" />
              {product.has_variants && (
                <>
                  {(showCategory && product.productCategory) || (product.stock !== undefined && product.stock !== null) ? <span>•</span> : null}
                  <span className="text-blue-600 dark:text-blue-400">
                    Multiple options
                  </span>
                </>
              )}
            </div>
            
            {(effectiveCanPurchase || commerceDisabled) && (
              <div className="mt-2">
                <TypeAwareCTA
                  product={product}
                  tenantName={tenantName || ''}
                  tenantLogo={tenantLogo}
                  effectiveCanPurchase={effectiveCanPurchase}
                  effectiveGatewayType={effectiveGatewayType}
                  propHasActivePaymentGateway={propHasActivePaymentGateway}
                  propDefaultGatewayType={propDefaultGatewayType}
                  buttonLayout={buttonLayout}
                  commerceDisabled={commerceDisabled}
                  compact
                />
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
                      const featuredTypes = getFeaturedTypes(product)
                        .filter(t => !allowedFeaturedTypes || allowedFeaturedTypes.includes(t));
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
                        style={{ width: 'auto', height: 'auto' }}
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
            <div className="mb-4">
              <TypeMetadataRow product={product} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-neutral-500">SKU: {product.sku}</span>
              {product.condition && (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded capitalize">
                  {product.condition.replace('_', ' ')}
                </span>
              )}
              {showStock && (product.inStock === true || (product.stock && product.stock > 0)) && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                  ✓ In Stock
                </span>
              )}
              {showStock && product.inStock === false && (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                  Out of Stock
                </span>
              )}
              {showStock && product.stock !== undefined && product.stock !== null && (
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
              <ProductTypeBadge productType={productType} size="xs" />
            </div>
            {(effectiveCanPurchase || commerceDisabled) && (
              <TypeAwareCTA
                product={product}
                tenantName={tenantName || ''}
                tenantLogo={tenantLogo}
                effectiveCanPurchase={effectiveCanPurchase}
                effectiveGatewayType={effectiveGatewayType}
                propHasActivePaymentGateway={propHasActivePaymentGateway}
                propDefaultGatewayType={propDefaultGatewayType}
                buttonLayout={buttonLayout}
                commerceDisabled={commerceDisabled}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grid variant (default)
  const aspectClass = aspectRatioClasses[imageAspectRatio] || 'aspect-square';
  return (
    <div className={`group bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-lg transition-shadow ${product.promotional_priority ? promotedCardClass() : ''} ${className}`}>
      {/* Grid Image */}
      <div className={`block relative ${aspectClass} bg-neutral-100 dark:bg-neutral-700 overflow-hidden`}>
        <Link href={`/products/${product.id}`} className="absolute inset-0">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={displayTitle}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </Link>

        {/* Featured Type Icons Overlay */}
        {product.featuredTypes && product.featuredTypes.length > 0 && (
          <div className="absolute bottom-2 left-2 flex flex-col gap-1 z-10">
            {product.featuredTypes
              .filter(t => !allowedFeaturedTypes || allowedFeaturedTypes.includes(t))
              .map((type, index) => (
              <FeaturedTypeIcon key={index} type={type} />
            ))}
          </div>
        )}

        {/* Promoted Badge */}
        {product.promotional_priority && product.promotional_priority > 0 && (
          <PromotedBadge priority={product.promotional_priority} />
        )}

        {/* Availability badges */}
        {product.availability === 'out_of_stock' && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded z-10">
            Out of Stock
          </div>
        )}
        {product.availability === 'preorder' && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded z-10">
            Pre-order
          </div>
        )}

        {/* Hover overlay: Quick Add + Quick View */}
        {(showQuickAdd || showQuickView) && (
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex items-center justify-center gap-2 z-20">
            {showQuickView && (
              <Link
                href={`/products/${product.id}`}
                className="p-2 rounded-full bg-white/90 text-neutral-700 hover:bg-white transition-colors"
                aria-label="Quick view"
                title="Quick view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </Link>
            )}
            {showQuickAdd && !product.has_variants && effectiveCanPurchase && (
              <AddToCartButton
                product={product}
                tenantName={tenantName || ''}
                tenantLogo={tenantLogo}
                hasActivePaymentGateway={effectiveCanPurchase}
                defaultGatewayType={effectiveGatewayType}
                layout="horizontal"
                commerceDisabled={commerceDisabled}
                className="text-xs py-1.5 px-3"
              />
            )}
            {showQuickAdd && product.has_variants && (
              <Link
                href={`/products/${product.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-neutral-700 text-xs font-medium hover:bg-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Options
              </Link>
            )}
          </div>
        )}
      </div>

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
            {truncateText(displayTitle, truncateTitle)}
          </h3>
        </Link>

        {showDescription && product.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
            {product.description}
          </p>
        )}

        <div className="mb-3">
          <TypeMetadataRow product={product} />
        </div>

        <div className="flex items-center justify-between mb-3">
          {/* Condition and Stock Status */}
          <div className="flex items-center gap-2 text-xs">
            {product.condition && (
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded capitalize">
                {product.condition.replace('_', ' ')}
              </span>
            )}
            {showStock && (product.inStock === true || (product.stock && product.stock > 0)) && (
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                ✓ In Stock
              </span>
            )}
            {showStock && product.inStock === false && (
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                Out of Stock
              </span>
            )}
            <ProductTypeBadge productType={productType} />
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
            {showStock && product.stock !== undefined && product.stock !== null && (
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

        {(effectiveCanPurchase || commerceDisabled) && (
          <TypeAwareCTA
            product={product}
            tenantName={tenantName || ''}
            tenantLogo={tenantLogo}
            effectiveCanPurchase={effectiveCanPurchase}
            effectiveGatewayType={effectiveGatewayType}
            propHasActivePaymentGateway={propHasActivePaymentGateway}
            propDefaultGatewayType={propDefaultGatewayType}
            buttonLayout={buttonLayout}
            commerceDisabled={commerceDisabled}
            className="w-full"
          />
        )}
      </div>
    </div>
  );
}
