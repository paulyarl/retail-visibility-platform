/**
 * Product Card Layout Variants
 * 
 * Provides different layout options while maintaining data integrity
 * All variants display the same data fields with different visual presentation
 */

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Package, ShoppingCart, Star, Store } from 'lucide-react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import { AddToCartButton } from '@/components/products/AddToCartButton';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { useTenantPaymentOptional } from '@/contexts/TenantPaymentContext';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { Card, Group, Text, ActionIcon, Button, Badge as MantineBadge } from '@mantine/core';
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';


// Common data interface for all layouts
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
  categoryName?: string;
  condition?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  ratingAvg?: number;
  ratingCount?: number;
  isFeatured?: boolean;
  featuredType?: string;
  featuredTypes?: string[];
  hasVariants?: boolean;
  payment_gateway_type?: string;
  defaultGatewayType?: string;
  // Shop information from API response
  tenantName?: string;
  tenantSlug?: string;
  tenantLogoUrl?: string;
  // Legacy fields for backward compatibility
  shopName?: string;
  shopSlug?: string;
  metadata?: Record<string, any>;
}

interface ProductCardProps {
  product: ProductData;
  variant?: 'classic' | 'enhanced' | 'compact' | 'premium' | 'zoom';
  tenantId: string;
  tenantName?: string;
  tenantLogo?: string;
  defaultGatewayType?: string;
  className?: string;
  trackingContext?: {
    source: 'directory' | 'featured' | 'search' | 'category' | 'storefront';
    position?: number;
    searchQuery?: string;
  };
}
  
/**
 * Classic Layout - Original design with all essential fields
 */
function ClassicLayout({ product, className = '', trackingContext, tenantId, tenantName, tenantLogo, defaultGatewayType }: Pick<ProductCardProps, 'product' | 'className' | 'trackingContext' | 'tenantId' | 'tenantName' | 'tenantLogo' | 'defaultGatewayType'>) {
  const hasGateway = !!(defaultGatewayType || product.payment_gateway_type);
  const formattedPrice = (product.priceCents / 100).toFixed(2);
  const formattedSalePrice = product.salePriceCents ? (product.salePriceCents / 100).toFixed(2) : null;
  const isOnSale = product.salePriceCents && product.salePriceCents < product.priceCents;
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
  const handleProductClick = () => {
    if (trackingContext) {
      trackBehaviorClient({
        entityType: 'product',
        entityId: product.id,
        context: {
          tenant_id: product.tenantId,
          product_name: product.name,
          category: product.categoryName,
          featured_type: product.featuredType,
          position: trackingContext.position,
          source: trackingContext.source,
          search_query: trackingContext.searchQuery
        },
        pageType: trackingContext.source === 'storefront' ? 'storefront' : 'directory_home'
      });
    }
  };

  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow ${className}`}>
      {/* Product Image */}
      <div className="relative aspect-square bg-gray-100 dark:bg-gray-700">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-400" />
          </div>
        )}
        
        {/* Stock Status Overlay */}
        {product.availability === 'out_of_stock' && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        
        {/* Shop Info */}
        {(product.tenantName || product.shopName) && (
          <div className="flex items-center mb-2">
            {(tenantLogo || product.tenantLogoUrl) ? (
              <Image
                src={tenantLogo || product.tenantLogoUrl || ''}
                alt={product.tenantName || product.shopName || 'Shop'}
                width={20}
                height={20}
                className="rounded-full mr-2"
              />
            ) : (
              <Store className="w-5 h-5 text-gray-400 mr-2" />
            )}
            <Link 
              href={`/shops/${product.tenantSlug || product.shopSlug || product.tenantId}`}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {product.tenantName || product.shopName}
            </Link>
            
                {hoursStatus && (
                  <div
                    className={`w-2 h-2 rounded-full ml-2 ${getStatusColor()}`}
                    title={hoursStatus.label}
                  />
                )}
          </div>
        )}
       
        {/* Product Name */}
        <Link href={`/products/${product.id}`} onClick={handleProductClick}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2">
            {product.name}
          </h3>
        </Link>

        {/* Brand */}
        {product.brand && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{product.brand}</p>
        )}

        {/* SKU */}
        {product.sku && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            SKU: {product.sku}
          </p>
        )}

        {/* Category and Condition */}
        <div className="flex items-center gap-2 mb-3">
          {product.categoryName && (
            <span className="inline-flex items-center px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded">
              🏷️ {product.categoryName}
            </span>
          )}
          {product.condition && (
            <span className="inline-flex items-center px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs rounded">
              ✅ {product.condition.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Featured Type Badges */}
        {product.featuredTypes && product.featuredTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {product.featuredTypes.map((type: string) => {
              const badgeConfig: Record<string, { label: string; color: string; icon: string }> = {
                store_selection: { label: 'Featured', color: 'amber', icon: '⭐' },
                new_arrival: { label: 'New', color: 'green', icon: '🆕' },
                seasonal: { label: 'Seasonal', color: 'orange', icon: '🎄' },
                sale: { label: 'Sale', color: 'red', icon: '💰' },
                featured: { label: 'Featured', color: 'purple', icon: '⭐' },
                staff_pick: { label: 'Staff Pick', color: 'blue', icon: '👨‍🔬' }
              };
              
              const config = badgeConfig[type] || badgeConfig.featured;
              
              return (
                <span
                  key={type}
                  className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full ${
                    config.color === 'amber' ? 'bg-amber-100 text-amber-800' :
                    config.color === 'green' ? 'bg-green-100 text-green-800' :
                    config.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                    config.color === 'red' ? 'bg-red-100 text-red-800' :
                    config.color === 'purple' ? 'bg-purple-100 text-purple-800' :
                    config.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {config.icon} {config.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Rating */}
        {product.ratingAvg && product.ratingCount && (
          <div className="flex items-center gap-1 mb-3">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < Math.floor(product.ratingAvg!)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {product.ratingAvg.toFixed(1)} ({product.ratingCount})
            </span>
          </div>
        )}

        {/* Availability Status */}
        {(product.availability || product.stock !== undefined) && (
          <div className="mb-3">
            {product.availability === 'out_of_stock' && (
              <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs rounded">
                Out of Stock
              </span>
            )}
            {product.availability === 'preorder' && (
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">
                Pre-order
              </span>
            )}
            {product.availability === 'in_stock' && product.stock !== undefined && (
              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">
                In Stock ({product.stock} available)
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-between">
            <PriceDisplay 
              priceCents={product.priceCents}
              salePriceCents={product.salePriceCents}
              variant="default"
              showSavingsBadge={true}
            />
            {product.salePriceCents && product.salePriceCents > 0 && product.salePriceCents < product.priceCents && (
              <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                Sale
              </span>
            )}
          </div>
        </div>
        {/* Add to Cart Button */}
        {hasGateway && (
          <AddToCartButton
            product={{
              id: product.id,
              name: product.name,
              sku: product.sku,
              priceCents: product.priceCents,
              salePriceCents: product.salePriceCents,
              imageUrl: product.imageUrl,
              stock: product.stock,
              tenantId,
              tenantLogo,
              payment_gateway_type: defaultGatewayType || product.payment_gateway_type,
              has_variants: product.hasVariants
            }}
            tenantName={tenantName || ''}
            tenantLogo={tenantLogo}
            defaultGatewayType={defaultGatewayType || product.payment_gateway_type}
            className="w-full"
            layout="stacked"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Enhanced Layout - Modern design with improved visual hierarchy
 */
function EnhancedLayout({ product, className = '', trackingContext, tenantId, tenantName, tenantLogo, defaultGatewayType }: Pick<ProductCardProps, 'product' | 'className' | 'trackingContext' | 'tenantId' | 'tenantName' | 'tenantLogo' | 'defaultGatewayType'>) {
  const hasGateway = !!(defaultGatewayType || product.payment_gateway_type);
  const formattedPrice = (product.priceCents / 100).toFixed(2);
  const formattedSalePrice = product.salePriceCents ? (product.salePriceCents / 100).toFixed(2) : null;
  const isOnSale = product.salePriceCents && product.salePriceCents < product.priceCents;
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

  const handleProductClick = () => {
    if (trackingContext) {
      trackBehaviorClient({
        entityType: 'product',
        entityId: product.id,
        context: {
          tenant_id: product.tenantId,
          product_name: product.name,
          category: product.categoryName,
          featured_type: product.featuredType,
          position: trackingContext.position,
          source: trackingContext.source,
          search_query: trackingContext.searchQuery
        },
        pageType: trackingContext.source === 'storefront' ? 'storefront' : 'directory_home'
      });

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
    }
  };

  return (
    <div className={`group relative bg-white dark:bg-neutral-800 rounded-xl overflow-hidden hover:shadow-2xl transition-all duration-300 ${className}`}>
      {/* Gradient Border Effect - subtle border only */}
      <div className="absolute inset-0 rounded-xl pointer-events-none border-2 border-transparent group-hover:border-blue-500/50 transition-colors duration-300"></div>

      {/* Product Image */}
      <div className="relative aspect-square bg-gray-100 dark:bg-gray-700">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-400" />
          </div>
        )}

        {/* Featured Type Badges - Overlay on Image */}
        {(() => {
          // Parse featuredTypes as JSON if it's a string, otherwise use as array
          let featuredTypesArray: string[] = [];
          if (typeof product.featuredTypes === 'string') {
            try {
              featuredTypesArray = JSON.parse(product.featuredTypes);
            } catch (e) {
              featuredTypesArray = [];
            }
          } else if (Array.isArray(product.featuredTypes)) {
            featuredTypesArray = product.featuredTypes;
          }
          
          if (featuredTypesArray.length === 0) return null;
          
          return (
            <div className="absolute top-3 left-3 flex flex-wrap gap-2">
              {featuredTypesArray.map((type: string) => {
                const badgeConfig: Record<string, { label: string; color: string; icon: string }> = {
                  store_selection: { label: 'Featured', color: 'amber', icon: '⭐' },
                  new_arrival: { label: 'New', color: 'green', icon: '🆕' },
                  seasonal: { label: 'Seasonal', color: 'orange', icon: '🎄' },
                  sale: { label: 'Sale', color: 'red', icon: '💰' },
                  featured: { label: 'Featured', color: 'purple', icon: '⭐' },
                  staff_pick: { label: 'Staff Pick', color: 'blue', icon: '👨‍🔬' }
                };
                
                const config = badgeConfig[type] || badgeConfig.featured;
                
                return (
                  <span
                    key={type}
                    className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full shadow-lg ${
                      config.color === 'amber' ? 'bg-amber-100 text-amber-800' :
                      config.color === 'green' ? 'bg-green-100 text-green-800' :
                      config.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                      config.color === 'red' ? 'bg-red-100 text-red-800' :
                      config.color === 'purple' ? 'bg-purple-100 text-purple-800' :
                      config.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {config.icon} {config.label}
                  </span>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* Product Name */}
        <Link href={`/products/${product.id}`} onClick={handleProductClick}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2">
            {product.name}
          </h3>
        </Link>
        {product.availability === 'out_of_stock' && (
          <div className="absolute top-3 right-3">
            <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Enhanced Product Info */}
      <div className="p-5">       

        {/* Shop Info */}
        {(product.tenantName || product.shopName) && (
          <div className="flex items-center mb-3"> 
            {(tenantLogo || product.tenantLogoUrl) ? (
              <Image
                src={tenantLogo || product.tenantLogoUrl || ''}
                alt={product.tenantName || product.shopName || 'Shop'}
                width={24}
                height={24}
                className="rounded-full mr-2"
              />
            ) : (
              <Store className="w-6 h-6 text-gray-400 mr-2" />
            )}
            <Link 
              href={`/shops/${product.tenantSlug || product.shopSlug || product.tenantId}`}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 uppercase tracking-wide"
            >
              {product.tenantName || product.shopName} 
            </Link>
            
                {hoursStatus && (
                  <div
                    className={`w-2 h-2 rounded-full ml-2 ${getStatusColor()}`}
                    title={hoursStatus.label}
                  />
                )}
          </div>       
         
        )}
       
        {/* Header with Brand and Rating */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            {product.brand && (
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                {product.brand}
              </p>
            )}
            <Link href={`/products/${product.id}`} onClick={handleProductClick}>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2 group-hover:text-blue-700">
                {product.name}
              </h3>
            </Link>
          </div>
          {product.ratingAvg && (
            <div className="flex items-center gap-1 ml-3">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {product.ratingAvg.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* Meta Information */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {product.sku && (
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              SKU: {product.sku}
            </span>
          )}
          {product.categoryName && (
            <span className="inline-flex items-center px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full">
              🏷️ {product.categoryName}
            </span>
          )}
          {product.condition && (
            <span className="inline-flex items-center px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs rounded-full">
              ✅ {product.condition.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Stock and Price */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {product.availability === 'in_stock' && product.stock !== undefined && (
              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">
                In Stock: {product.stock}
              </span>
            )}
            {product.availability === 'preorder' && (
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">
                Pre-order
              </span>
            )}
          </div>
        </div>

        {/* Price Section */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center justify-between">
              <PriceDisplay 
                priceCents={product.priceCents}
                salePriceCents={product.salePriceCents}
                variant="large"
                showSavingsBadge={true}
              />
              {product.salePriceCents && product.salePriceCents > 0 && product.salePriceCents < product.priceCents && (
                <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                  Sale
                </span>
              )}
            </div>
            {product.ratingCount && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {product.ratingCount} reviews
              </p>
            )}
          </div>
          
          {/* Action Button */}
          {hasGateway && (
            <AddToCartButton
              product={{
                id: product.id,
                name: product.name,
                sku: product.sku,
                priceCents: product.priceCents,
                salePriceCents: product.salePriceCents,
                imageUrl: product.imageUrl,
                stock: product.stock,
                tenantId,
                tenantLogo,
                payment_gateway_type: defaultGatewayType || product.payment_gateway_type,
                has_variants: product.hasVariants
              }}
              tenantName={tenantName || ''}
              tenantLogo={tenantLogo}
              defaultGatewayType={defaultGatewayType || product.payment_gateway_type}
              className="w-full"
              layout="stacked"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Layout - Space-efficient design for grid views
 */
function CompactLayout({ product, className = '', trackingContext, tenantId, tenantName, tenantLogo, defaultGatewayType }: Pick<ProductCardProps, 'product' | 'className' | 'trackingContext' | 'tenantId' | 'tenantName' | 'tenantLogo' | 'defaultGatewayType'>) {
  const hasGateway = !!(defaultGatewayType || product.payment_gateway_type);
  const formattedPrice = (product.priceCents / 100).toFixed(2);
  const formattedSalePrice = product.salePriceCents ? (product.salePriceCents / 100).toFixed(2) : null;
  const isOnSale = product.salePriceCents && product.salePriceCents < product.priceCents;
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

  const handleProductClick = () => {
    if (trackingContext) {
      trackBehaviorClient({
        entityType: 'product',
        entityId: product.id,
        context: {
          tenant_id: product.tenantId,
          product_name: product.name,
          category: product.categoryName,
          featured_type: product.featuredType,
          position: trackingContext.position,
          source: trackingContext.source,
          search_query: trackingContext.searchQuery
        },
        pageType: trackingContext.source === 'storefront' ? 'storefront' : 'directory_home'
      });
    }
  };

  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow ${className}`}>
      <Link href={`/products/${product.id}`} className="block" onClick={handleProductClick}>
        <div className="flex items-center p-3">
          {/* Product Image */}
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 relative">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={64}
                height={64}
                className="w-full h-full object-cover"
                style={{ width: 'auto', height: 'auto' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-gray-400" />
              </div>
            )}
            
            {/* Featured Type Badges - Overlay on Image */}
            {(() => {
              // Parse featuredTypes as JSON if it's a string, otherwise use as array
              let featuredTypesArray: string[] = [];
              if (typeof product.featuredTypes === 'string') {
                try {
                  featuredTypesArray = JSON.parse(product.featuredTypes);
                } catch (e) {
                  featuredTypesArray = [];
                }
              } else if (Array.isArray(product.featuredTypes)) {
                featuredTypesArray = product.featuredTypes;
              }
              
              if (featuredTypesArray.length === 0) return null;
              
              return (
                <div className="absolute top-1 left-1 flex flex-wrap gap-1">
                  {featuredTypesArray.slice(0, 2).map((type: string) => {
                    const badgeConfig: Record<string, { label: string; color: string; icon: string }> = {
                      store_selection: { label: '⭐', color: 'amber', icon: '' },
                      new_arrival: { label: '🆕', color: 'green', icon: '' },
                      seasonal: { label: '🎄', color: 'orange', icon: '' },
                      sale: { label: '💰', color: 'red', icon: '' },
                      featured: { label: '⭐', color: 'purple', icon: '' },
                      staff_pick: { label: '👥', color: 'purple', icon: '' }
                    };
                    const config = badgeConfig[type];

                    if (!config) return null;

                    return (
                      <span
                        key={type}
                        className={`inline-flex items-center px-1 py-0.5 text-xs font-medium rounded-full ${
                          config.color === 'amber' ? 'bg-amber-100 text-amber-800' :
                          config.color === 'green' ? 'bg-green-100 text-green-800' :
                          config.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                          config.color === 'red' ? 'bg-red-100 text-red-800' :
                          config.color === 'purple' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {config.label}
                      </span>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          
          {/* Product Info */}
          <div className="ml-3 flex-1 min-w-0">
             
            {/* Shop Info */}
            {(product.tenantName || product.shopName) && (
              <div className="flex items-center mb-1"> 
                {(tenantLogo || product.tenantLogoUrl) ? (
                  <Image
                    src={tenantLogo || product.tenantLogoUrl || ''}
                    alt={product.tenantName || product.shopName || 'Shop'}
                    width={16}
                    height={16}
                    className="rounded-full mr-1"
                  />
                ) : (
                  <Store className="w-4 h-4 text-gray-400 mr-1" />
                )}
                <Link 
                  href={`/shops/${product.tenantSlug || product.shopSlug || product.tenantId}`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium truncate"
                >
                  {product.tenantName || product.shopName} 
                </Link>
                
                {hoursStatus && (
                  <div
                    className={`w-2 h-2 rounded-full ml-2 ${getStatusColor()}`}
                    title={hoursStatus.label}
                  />
                )}
              </div>
            )}
           
            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {product.name}
            </h3>
            
            {/* Brand and SKU */}
            <div className="flex items-center gap-2 mt-1">
              {product.brand && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {product.brand}
                </p>
              )}
              {product.sku && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  SKU: {product.sku}
                </p>
              )}
            </div>

            {/* Category and Condition */}
            <div className="flex items-center gap-1 mt-1">
              {product.categoryName && (
                <span className="inline-flex items-center px-1 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded">
                  {product.categoryName}
                </span>
              )}
              {product.condition && (
                <span className="inline-flex items-center px-1 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs rounded">
                  {product.condition.replace('_', ' ')}
                </span>
              )}
            </div>

            {/* Rating */}
            {product.ratingAvg && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {product.ratingAvg.toFixed(1)}
                </span>
              </div>
            )}

            {/* Price and Stock */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center justify-between">
                <PriceDisplay 
                  priceCents={product.priceCents}
                  salePriceCents={product.salePriceCents}
                  variant="compact"
                  showSavingsBadge={true}
                />
                {product.salePriceCents && product.salePriceCents > 0 && product.salePriceCents < product.priceCents && (
                  <span className="bg-red-600 text-white px-1.5 py-0.5 rounded-full text-xs font-medium">
                    Sale
                  </span>
                )}
              </div>
              {product.availability === 'in_stock' && product.stock !== undefined && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  {product.stock} left
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Add to Cart Button - Outside Link to avoid conflicts */}
      <div className="px-3 pb-3">
        {hasGateway && (
          <AddToCartButton
            product={{
              id: product.id,
              name: product.name,
              sku: product.sku,
              priceCents: product.priceCents,
              salePriceCents: product.salePriceCents,
              imageUrl: product.imageUrl,
              stock: product.stock,
              tenantId,
              tenantLogo,
              payment_gateway_type: defaultGatewayType || product.payment_gateway_type,
              has_variants: product.hasVariants
            }}
            tenantName={tenantName || ''}
            tenantLogo={tenantLogo}
            defaultGatewayType={defaultGatewayType || product.payment_gateway_type}
            className="w-full"
            layout="stacked"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Premium Layout - High-end design with luxury styling
 */
function PremiumLayout({ product, className = '', trackingContext, tenantId, tenantName, tenantLogo, defaultGatewayType }: Pick<ProductCardProps, 'product' | 'className' | 'trackingContext' | 'tenantId' | 'tenantName' | 'tenantLogo' | 'defaultGatewayType'>) {
  const hasGateway = !!(defaultGatewayType || product.payment_gateway_type);
  const formattedPrice = (product.priceCents / 100).toFixed(2);
  const formattedSalePrice = product.salePriceCents ? (product.salePriceCents / 100).toFixed(2) : null;
  const isOnSale = product.salePriceCents && product.salePriceCents < product.priceCents;
   const { status: hoursStatus } = useStoreStatus(product.tenantId, true); // Public scope
    // Status indicator color
  const getStatusColor = () => {
    if (!hoursStatus) return 'bg-gray-400 ';
    switch (hoursStatus.status) {
      case 'open': return 'bg-green-500  ';
      case 'closed': return 'bg-red-500  ';
      case 'opening-soon': return 'bg-blue-500  ';
      case 'closing-soon': return 'bg-yellow-500  ';
      default: return 'bg-gray-400  ';
    }
  };

  const handleProductClick = () => {
    if (trackingContext) {
      trackBehaviorClient({
        entityType: 'product',
        entityId: product.id,
        context: {
          tenant_id: product.tenantId,
          product_name: product.name,
          category: product.categoryName,
          featured_type: product.featuredType,
          position: trackingContext.position,
          source: trackingContext.source,
          search_query: trackingContext.searchQuery
        },
        pageType: trackingContext.source === 'storefront' ? 'storefront' : 'directory_home'
      });
    }
  };

  return (
    <div className={`group relative bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-500 border border-gray-100 dark:border-gray-700 ${className}`}>
      {/* Premium Gradient Border - subtle border only */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none border-2 border-transparent group-hover:border-amber-500/50 transition-colors duration-500"></div>

      {/* Product Image */}
      <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-16 h-16 text-gray-300" />
          </div>
        )}

        {/* Premium Badges */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {/* Featured Type Badges */}
          {(() => {
            // Parse featuredTypes as JSON if it's a string, otherwise use as array
            let featuredTypesArray: string[] = [];
            if (typeof product.featuredTypes === 'string') {
              try {
                featuredTypesArray = JSON.parse(product.featuredTypes);
              } catch (e) {
                featuredTypesArray = [];
              }
            } else if (Array.isArray(product.featuredTypes)) {
              featuredTypesArray = product.featuredTypes;
            }
            
            if (featuredTypesArray.length === 0) return null;
            
            return (
              <div className="flex flex-col gap-1">
                {featuredTypesArray.map((type: string) => {
                  const badgeConfig: Record<string, { label: string; color: string }> = {
                    store_selection: { label: '⭐ Featured', color: 'from-amber-500 to-orange-500' },
                    new_arrival: { label: '🆕 New', color: 'from-green-500 to-emerald-500' },
                    seasonal: { label: '🎄 Seasonal', color: 'from-orange-500 to-red-500' },
                    sale: { label: '💰 Sale', color: 'from-red-500 to-pink-500' },
                    featured: { label: '⭐ Featured', color: 'from-purple-500 to-indigo-500' },
                    staff_pick: { label: '👥 Staff Pick', color: 'from-blue-500 to-cyan-500' }
                  };
                  const config = badgeConfig[type];

                  if (!config) return null;

                  return (
                    <span
                      key={type}
                      className={`inline-flex items-center px-3 py-1.5 ${config.color} text-white text-sm font-bold rounded-full shadow-lg`}
                    >
                      {config.label}
                    </span>
                  );
                })}
              </div>
            );
          })()}

          {/* Fallback to generic featured badge if no specific types */}
          {(!product.featuredType || !product.featuredType.length) && product.isFeatured && (
            <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-xl">
              ⭐ Featured
            </span>
          )}

          {/* Sale Badge */}
          {isOnSale && (
            <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-xl">
              💰 Sale
            </span>
          )}
        </div>

        {/* Stock Status */}
        {product.availability === 'out_of_stock' && (
          <div className="absolute top-4 right-4">
            <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-xl">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Premium Product Info */}
      <div className="p-6">

        
        {/* Shop Info */}
        {(product.tenantName || product.shopName) && (
          <div className="flex items-center mb-4"> 
            {(tenantLogo || product.tenantLogoUrl) ? (
              <Image
                src={tenantLogo || product.tenantLogoUrl || ''}
                alt={product.tenantName ? product.tenantName : product.shopName ? product.shopName : 'Shop'}
                width={40}
                height={40}
                style={{ borderRadius: '50%', padding: '2px' }}
                className="rounded-full mr-3 border-2 border-white shadow-sm"
              />
            ) : (
              <Store className="w-8 h-8 text-gray-400 mr-3" />
            )}
            <Link 
              href={`/shops/${product.tenantSlug || product.shopSlug || product.tenantId}`}
              className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {product.tenantName || product.shopName}
            </Link>
            
            {hoursStatus && (
              <div
                className={`w-4 h-4 rounded-full ml-4 ${getStatusColor()}`}
                title={hoursStatus.label}

              />
            )}
          </div>
        )}
       
        
        {/* Brand and Name */}
        <div className="mb-4">
          {product.brand && (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
              {product.brand}
            </p>
          )}
          <Link href={`/products/${product.id}`} onClick={handleProductClick}>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 transition-colors line-clamp-2">
              {product.name}
            </h3>
          </Link>
        </div>

        {/* SKU and Meta */}
        <div className="flex items-center gap-3 mb-4 text-sm text-gray-600 dark:text-gray-400">
          {product.sku && (
            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              SKU: {product.sku}
            </span>
          )}
          {product.categoryName && (
            <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-1 rounded">
              {product.categoryName}
            </span>
          )}
          {product.condition && (
            <span className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 rounded">
              {product.condition.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3 text-sm leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Rating */}
        {product.ratingAvg && product.ratingCount && (
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-5 h-5 ${
                    i < Math.floor(product.ratingAvg!)
                      ? 'text-amber-400 fill-current'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {product.ratingAvg.toFixed(1)} ({product.ratingCount} reviews)
            </span>
          </div>
        )}

        {/* Stock Status */}
        <div className="mb-4">
          {product.availability === 'in_stock' && product.stock !== undefined && (
            <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm rounded-full">
              ✅ In Stock ({product.stock} available)
            </span>
          )}
          {product.availability === 'preorder' && (
            <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-sm rounded-full">
              🕐 Pre-order
            </span>
          )}
        </div>

        {/* Premium Price Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-3">
                <div className="flex items-center justify-between">
                <PriceDisplay 
                  priceCents={product.priceCents}
                  salePriceCents={product.salePriceCents}
                  variant="large"
                  showSavingsBadge={true}
                />
                {product.salePriceCents && product.salePriceCents > 0 && product.salePriceCents < product.priceCents && (
                  <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                    Sale
                  </span>
                )}
              </div>
            </div>
            </div>
            
            {/* Premium Action Button */}
            {hasGateway && (
              <AddToCartButton
                product={{
                  id: product.id,
                  name: product.name,
                  sku: product.sku,
                  priceCents: product.priceCents,
                  salePriceCents: product.salePriceCents,
                  imageUrl: product.imageUrl,
                  stock: product.stock,
                  tenantId,
                  tenantLogo,
                  payment_gateway_type: defaultGatewayType || product.payment_gateway_type,
                  has_variants: product.hasVariants
                }}
                tenantName={tenantName || ''}
                tenantLogo={tenantLogo}
                defaultGatewayType={defaultGatewayType || product.payment_gateway_type}
                className="w-full"
                layout="stacked"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Product Card Component with Layout Variants
 */
export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  variant = 'classic', 
  className = '', 
  trackingContext,
  tenantId,
  tenantName,
  tenantLogo,
  defaultGatewayType,
}) => {
  // Get payment context directly (like SmartProductCard does)
  const contextPayment = useTenantPaymentOptional();
  
  // Fallback for defaultGatewayType - priority: prop > product data > context
  // API returns defaultGatewayType (camelCase), also check payment_gateway_type for backwards compatibility
  const effectiveGatewayType = defaultGatewayType 
    ?? (product as any).defaultGatewayType 
    ?? product.payment_gateway_type
    ?? contextPayment?.defaultGatewayType;
     // Status indicator color
 

  // Data integrity check - ensure all required fields are present
  if (!product || !product.id || !product.name || !product.priceCents) {
    console.error(`[ProductCard] Missing required data for product:`, {
      productId: product?.id || 'unknown',
      hasProduct: !!product,
      hasId: !!product?.id,
      hasName: !!product?.name,
      hasPriceCents: !!product?.priceCents,
      productData: product ? {
        id: product.id,
        name: product.name,
        priceCents: product.priceCents,
        sku: product.sku,
        imageUrl: product.imageUrl,
        brand: product.brand,
        description: product.description,
        // Show all available fields to debug
        allFields: Object.keys(product)
      } : 'No product object'
    });
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-4 text-center ${className}`}>
        <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Product information unavailable</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          ID: {product?.id || 'unknown'}
        </p>
      </div>
    );
  }
  // console.log('ProductCard - product:', JSON.stringify(product, null, 2));
  // console.log('ProductCard - effectiveGatewayType:', effectiveGatewayType);
 const { status: hoursStatus } = useStoreStatus(product.tenantId, true); // Public scope
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
  // Status indicator color
   

  // Render based on variant
  switch (variant) {
    case 'enhanced':
      return <EnhancedLayout product={product} className={className} trackingContext={trackingContext} tenantId={tenantId} tenantName={tenantName} tenantLogo={tenantLogo} defaultGatewayType={effectiveGatewayType} />;
    case 'classic':
      return <ClassicLayout product={product} className={className} trackingContext={trackingContext} tenantId={tenantId} tenantName={tenantName} tenantLogo={tenantLogo} defaultGatewayType={effectiveGatewayType} />;
    case 'premium':
      return <PremiumLayout product={product} className={className} trackingContext={trackingContext} tenantId={tenantId} tenantName={tenantName} tenantLogo={tenantLogo} defaultGatewayType={effectiveGatewayType} />;
    case 'zoom':
      // For featured products, use the catalog's ZoomLayout
      // Import dynamically to avoid circular dependency
      const zoomHasGateway = !!(effectiveGatewayType || product.payment_gateway_type);
      return (
        <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-110 hover:z-10 ${className}`}>
          {/* Product Image with Zoom Effect */}
          <div className="relative aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden">
            {product.imageUrl ? (
              <>
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-125"
                />
                {/* Zoom Overlay - only bottom half, subtle */}
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
            )}

            {/* Featured Badge */}
            {product.isFeatured && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
                  ⭐
                </span>
              </div>
            )}

            {/* Featured Type Badges - Overlay on Image */}
            {(() => {
              // Parse featuredTypes as JSON if it's a string, otherwise use as array
              let featuredTypesArray: string[] = [];
              if (typeof product.featuredTypes === 'string') {
                try {
                  featuredTypesArray = JSON.parse(product.featuredTypes);
                } catch (e) {
                  featuredTypesArray = [];
                }
              } else if (Array.isArray(product.featuredTypes)) {
                featuredTypesArray = product.featuredTypes;
              }
              
              if (featuredTypesArray.length === 0) return null;
              
              return (
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  {featuredTypesArray.map((type: string) => {
                    const badgeConfig: Record<string, { label: string; color: string; icon: string }> = {
                      store_selection: { label: '⭐', color: 'amber', icon: '' },
                      new_arrival: { label: '🆕', color: 'green', icon: '' },
                      seasonal: { label: '🎄', color: 'orange', icon: '' },
                      sale: { label: '💰', color: 'red', icon: '' },
                      featured: { label: '⭐', color: 'purple', icon: '' },
                      staff_pick: { label: '👥', color: 'purple', icon: '' }
                    };
                    const config = badgeConfig[type];

                    if (!config) return null;

                    return (
                      <span
                        key={type}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shadow-lg ${
                          config.color === 'amber' ? 'bg-amber-100 text-amber-800' :
                          config.color === 'green' ? 'bg-green-100 text-green-800' :
                          config.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                          config.color === 'red' ? 'bg-red-100 text-red-800' :
                          config.color === 'purple' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {config.label}
                      </span>
                    );
                  })}
                </div>
              );
            })()}

            {/* Stock Status */}
            {product.availability === 'out_of_stock' && (
              <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {/* Minimal Info (visible always) - compact */}
          <div className="p-1">
           
            {/* Shop Info */}
            {(product.tenantName || product.shopName) && (
              <div className="flex items-center mb-1">
                
                {(tenantLogo || product.tenantLogoUrl) ? (
                  <Image
                    src={tenantLogo || product.tenantLogoUrl || ''}
                    alt={product.tenantName || product.shopName || 'Shop'}
                    width={12}
                    height={12}
                    className="rounded-full mr-1"
                  />
                ) : (
                  <Store className="w-3 h-3 text-gray-400 mr-1" />
                )}
                <Link 
                  href={`/shops/${product.tenantSlug || product.shopSlug || product.tenantId}`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate"
                >
                  {product.tenantName || product.shopName}
                   
                </Link>
                
               {/* Hours Badge - Status */}
           <HoursStatusBadge status={hoursStatus} />
              </div>
            )}
           
            <h3 className="text-xs font-medium text-gray-900 dark:text-white truncate">
              {product.name}
            </h3>
            
            {/* Category - Always show */}
            <div className="mt-0.5">
              {product.categoryName ? (
                <span className="inline-flex items-center px-1 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded">
                  {product.categoryName}
                </span>
              ) : (
                <span className="inline-flex items-center px-1 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
                  No Cat
                </span>
              )}
            </div>
            
            {/* Stock - Always show */}
            <div className="mt-0.5">
              {product.availability === 'out_of_stock' ? (
                <span className="inline-flex items-center px-1 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs rounded">
                  Out
                </span>
              ) : product.availability === 'preorder' ? (
                <span className="inline-flex items-center px-1 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs rounded">
                  Pre
                </span>
              ) : product.stock !== undefined ? (
                <span className="inline-flex items-center px-1 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs rounded">
                  {product.stock}
                </span>
              ) : (
                <span className="inline-flex items-center px-1 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs rounded">
                  ?
                </span>
              )}
            </div>


            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                ${(product.priceCents / 100).toFixed(2)}
                 {product.ratingAvg && (
                <div className="flex items-center gap-0.5">
                  <Star className="w-2 h-2 text-yellow-400 fill-current" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {product.ratingAvg!.toFixed(1)}
                  </span>
                </div>
              )}
              </span>
             
              
           
            </div>
             {/* Add to Cart Button */}
            {zoomHasGateway && (
              <AddToCartButton
                product={{
                  id: product.id,
                  name: product.name,
                  sku: product.sku,
                  priceCents: product.priceCents,
                  salePriceCents: product.salePriceCents,
                  imageUrl: product.imageUrl,
                  stock: product.stock,
                  tenantId,
                  tenantLogo,
                  payment_gateway_type: defaultGatewayType || product.payment_gateway_type,
                  has_variants: product.hasVariants
                }}
                tenantName={tenantName || ''}
                tenantLogo={tenantLogo}
                defaultGatewayType={defaultGatewayType || product.payment_gateway_type}
                className="w-full"
                layout="stacked"
              />
            )}
          </div>
        </div>
      );
    default:
      return <ClassicLayout product={product} className={className} trackingContext={trackingContext} tenantId={tenantId} tenantName={tenantName} tenantLogo={tenantLogo} defaultGatewayType={effectiveGatewayType} />;
  }
}

export type { ProductData };
