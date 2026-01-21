"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PriceDisplay } from './PriceDisplay';
import ProductWithVariants from './ProductWithVariants';
import { AddToCartButton } from './AddToCartButton';
import { useTenantPaymentOptional } from '@/contexts/TenantPaymentContext';
import { Star, Sparkles, Calendar, Tag, Award } from 'lucide-react';

// Helper functions for storefront featured type badges
const getStorefrontBadgeStyle = (typeId: string): string => {
  switch (typeId) {
    case 'store_selection':
      return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
    case 'new_arrival':
      return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
    case 'seasonal':
      return 'bg-gradient-to-r from-orange-500 to-red-500 text-white';
    case 'sale':
      return 'bg-gradient-to-r from-red-500 to-pink-500 text-white';
    case 'staff_pick':
      return 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white';
    default:
      return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
  }
};

const getStorefrontBadgeIcon = (typeId: string) => {
  switch (typeId) {
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
    default:
      return <Star className="w-3.5 h-3.5 fill-white" />;
  }
};

const getStorefrontBadgeText = (typeId: string): string => {
  switch (typeId) {
    case 'store_selection':
      return 'FEATURED';
    case 'new_arrival':
      return 'NEW ARRIVAL';
    case 'seasonal':
      return 'SEASONAL';
    case 'sale':
      return 'ON SALE';
    case 'staff_pick':
      return 'STAFF PICK';
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
    default:
      return 'bg-gradient-to-br from-amber-400 via-orange-400 to-pink-400';
  }
};

// Get all featured types for a product (supports multiple badges)
const getFeaturedTypes = (product: ProductData): ('store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick')[] => {
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
    case 'new_arrival': return 2; // New arrivals are second
    case 'seasonal': return 3; // Seasonal items are third
    case 'staff_pick': return 4; // Staff picks are fourth
    case 'store_selection': return 5; // Directory featured is fifth
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
  stock: number;
  imageUrl?: string;
  tenantId: string;
  payment_gateway_type?: string | null;
  payment_gateway_id?: string | null;
  has_variants?: boolean;
  has_active_payment_gateway?: boolean;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  isFeatured?: boolean;
  featuredType?: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
  featuredTypes?: ('store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick')[]; // Support multiple types
  featuredPriority?: number;
  featuredAt?: string;
  featuredExpiresAt?: string;
  isFeaturedActive?: boolean;
  daysUntilExpiration?: number;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
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
}

interface SmartProductCardProps {
  product: ProductData;
  tenantName?: string;
  tenantLogo?: string;
  variant?: 'grid' | 'list' | 'compact' | 'featured';
  showCategory?: boolean;
  showDescription?: boolean;
  className?: string;
}

export default function SmartProductCard({
  product,
  tenantName,
  tenantLogo,
  variant = 'grid',
  showCategory = true,
  showDescription = true,
  className = '',
}: SmartProductCardProps) {
  // Debug logging for featured products
  /* console.log('[SmartProductCard] Rendering product:', {
    id: product.id,
    name: product.name,
    variant,
    hasImage: !!product.imageUrl,
    priceCents: product.priceCents
  }); */

  // Try to use context first (performance optimization)
  const contextPayment = useTenantPaymentOptional();
  
  // Fallback state for when context is not available
  const [canPurchase, setCanPurchase] = useState(false);
  const [defaultGatewayType, setDefaultGatewayType] = useState<string | undefined>();

  // Priority: product data (from MV) > context > individual API fetch
  const effectiveCanPurchase = product.has_active_payment_gateway ?? contextPayment?.canPurchase ?? canPurchase;
  const effectiveGatewayType = product.payment_gateway_type ?? contextPayment?.defaultGatewayType ?? defaultGatewayType;

  useEffect(() => {
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
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/api/tenants/${product.tenantId}/payment-gateway`);
        
        if (response.ok) {
          const data = await response.json();
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
  }, [product.tenantId, contextPayment, product.has_active_payment_gateway]);

  const displayTitle = product.title || product.name;
  const displayBrand = product.brand || '';

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
              {showCategory && product.tenantCategory && (
                <span className="text-xs px-2.5 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full font-medium">
                  {product.tenantCategory.name}
                </span>
              )}
            </div>
            
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

            <div className="flex items-center justify-between mb-4">
              <PriceDisplay
                priceCents={product.priceCents}
                salePriceCents={product.salePriceCents}
                variant="large"
                showSavingsBadge={true}
              />
              <div className="text-right">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  SKU: {product.sku}
                </p>
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
            {effectiveCanPurchase && (
              <div className="mt-4">
                {product.has_variants ? (
                  <ProductWithVariants
                    product={product}
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
                    className="w-full"
                  />
                )}
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
            
            <div className="flex items-center gap-1 mt-0.5">
              <PriceDisplay
                priceCents={product.priceCents}
                salePriceCents={product.salePriceCents}
                variant="compact"
              />
              {product.salePriceCents && (
                <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 px-1.5 py-0.5 rounded">
                  Sale
                </span>
              )}
            </div>
            
            {/* Category and Stock Status */}
            <div className="flex items-center gap-2 mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {showCategory && product.tenantCategory && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {typeof product.tenantCategory === 'string' ? product.tenantCategory : product.tenantCategory?.name || ''}
                </span>
              )}
              {product.stock !== undefined && product.stock !== null && (
                <>
                  {showCategory && product.tenantCategory && <span>•</span>}
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
                  {(showCategory && product.tenantCategory) || (product.stock !== undefined && product.stock !== null) ? <span>•</span> : null}
                  <span className="text-blue-600 dark:text-blue-400">
                    Multiple options
                  </span>
                </>
              )}
            </div>
            
            {effectiveCanPurchase && (
              <div className="mt-2">
                {product.has_variants ? (
                  <Link
                    href={`/products/${product.id}`}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                  >
                    View Options →
                  </Link>
                ) : (
                  <AddToCartButton
                    product={product}
                    tenantName={tenantName || ''}
                    tenantLogo={tenantLogo}
                    hasActivePaymentGateway={effectiveCanPurchase}
                    defaultGatewayType={effectiveGatewayType}
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
        <Link href={`/products/${product.id}`} className="relative w-48 h-48 shrink-0 bg-neutral-100 dark:bg-neutral-700 block">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={displayTitle}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
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
                    {showCategory && product.tenantCategory && (
                      <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
                        {product.tenantCategory.name}
                      </span>
                    )}
                  </div>
                </div>
                <Link href={`/products/${product.id}`}>
                  <h3 className="font-semibold text-lg text-neutral-900 dark:text-white mb-2 hover:text-primary-600 dark:hover:text-primary-400">
                    {displayTitle}
                  </h3>
                </Link>
              </div>
              <div className="ml-4">
                <PriceDisplay
                  priceCents={product.priceCents}
                  salePriceCents={product.salePriceCents}
                  variant="default"
                  showSavingsBadge={true}
                />
              </div>
            </div>
            {showDescription && product.description && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                {product.description}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-500">
              <span>SKU: {product.sku}</span>
              <span className={`ml-4 font-medium ${
                product.stock === 0 
                  ? 'text-red-600 dark:text-red-400' 
                  : product.stock < 10 
                  ? 'text-amber-600 dark:text-amber-400' 
                  : 'text-green-600 dark:text-green-400'
              }`}>
                Stock: {product.stock}
              </span>
            </div>
            {effectiveCanPurchase && (
              product.has_variants ? (
                <ProductWithVariants
                  product={product}
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
            fill
            className="object-cover group-hover:scale-105 transition-transform"
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

      {/* Grid Info */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          {displayBrand && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {displayBrand}
            </p>
          )}
          {showCategory && product.tenantCategory && (
            <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
              {product.tenantCategory.name}
            </span>
          )}
        </div>
        <Link href={`/products/${product.id}`}>
          <h3 className="font-semibold text-neutral-900 dark:text-white line-clamp-2 mb-2 hover:text-primary-600 dark:hover:text-primary-400">
            {displayTitle}
          </h3>
        </Link>
        {showDescription && product.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
            {product.description}
          </p>
        )}
        <div className="flex items-center justify-between mb-3">
          <PriceDisplay
            priceCents={product.priceCents}
            salePriceCents={product.salePriceCents}
            variant="default"
            showSavingsBadge={true}
          />
          <div className="text-right">
            <p className="text-xs text-neutral-500">
              SKU: {product.sku}
            </p>
            <p className={`text-xs font-medium ${
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

        {effectiveCanPurchase && (
            product.has_variants ? (
              <ProductWithVariants
                product={product}
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
                className="w-full"
              />
            )
          )}
      </div>
    </div>
  );
}
