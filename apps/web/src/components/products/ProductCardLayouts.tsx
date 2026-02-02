/**
 * Product Card Layout Variants
 * 
 * Provides different layout options while maintaining data integrity
 * All variants display the same data fields with different visual presentation
 */

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Package, ShoppingCart, Star } from 'lucide-react';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

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
  hasVariants?: boolean;
  metadata?: Record<string, any>;
}

interface ProductCardProps {
  product: ProductData;
  variant?: 'classic' | 'enhanced' | 'compact' | 'premium' | 'zoom';
  tenantId: string;
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
function ClassicLayout({ product, className = '', trackingContext }: Pick<ProductCardProps, 'product' | 'className' | 'trackingContext'>) {
  const formattedPrice = (product.priceCents / 100).toFixed(2);
  const formattedSalePrice = product.salePriceCents ? (product.salePriceCents / 100).toFixed(2) : null;
  const isOnSale = product.salePriceCents && product.salePriceCents < product.priceCents;

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
          <div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              ${formattedPrice}
            </span>
            {isOnSale && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 line-through">
                ${formattedSalePrice}
              </span>
            )}
          </div>
          {isOnSale && (
            <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">
              Sale
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Enhanced Layout - Modern design with improved visual hierarchy
 */
function EnhancedLayout({ product, className = '', trackingContext }: Pick<ProductCardProps, 'product' | 'className' | 'trackingContext'>) {
  const formattedPrice = (product.priceCents / 100).toFixed(2);
  const formattedSalePrice = product.salePriceCents ? (product.salePriceCents / 100).toFixed(2) : null;
  const isOnSale = product.salePriceCents && product.salePriceCents < product.priceCents;

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
    <div className={`group relative bg-white dark:bg-neutral-800 rounded-xl overflow-hidden hover:shadow-2xl transition-all duration-300 ${className}`}>
      {/* Gradient Border Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ padding: '2px' }}>
        <div className="w-full h-full bg-white dark:bg-neutral-800 rounded-xl"></div>
      </div>

      {/* Product Image */}
      <div className="relative aspect-square bg-gray-100 dark:bg-gray-700">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-400" />
          </div>
        )}

        {/* Featured Badge */}
        {product.isFeatured && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
              ⭐ Featured
            </span>
          </div>
        )}

        {/* Stock Status */}
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
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                ${formattedPrice}
              </span>
              {isOnSale && (
                <span className="text-lg text-gray-500 dark:text-gray-400 line-through">
                  ${formattedSalePrice}
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
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl">
            <ShoppingCart className="w-4 h-4" />
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Layout - Space-efficient design for grid views
 */
function CompactLayout({ product, className = '', trackingContext }: Pick<ProductCardProps, 'product' | 'className' | 'trackingContext'>) {
  const formattedPrice = (product.priceCents / 100).toFixed(2);
  const formattedSalePrice = product.salePriceCents ? (product.salePriceCents / 100).toFixed(2) : null;
  const isOnSale = product.salePriceCents && product.salePriceCents < product.priceCents;

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
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </div>
          
          {/* Product Info */}
          <div className="ml-3 flex-1 min-w-0">
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
              <div>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  ${formattedPrice}
                </span>
                {isOnSale && (
                  <span className="text-xs text-red-600 dark:text-red-400 line-through ml-1">
                    ${formattedSalePrice}
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
    </div>
  );
}

/**
 * Premium Layout - High-end design with luxury styling
 */
function PremiumLayout({ product, className = '', trackingContext }: Pick<ProductCardProps, 'product' | 'className' | 'trackingContext'>) {
  const formattedPrice = (product.priceCents / 100).toFixed(2);
  const formattedSalePrice = product.salePriceCents ? (product.salePriceCents / 100).toFixed(2) : null;
  const isOnSale = product.salePriceCents && product.salePriceCents < product.priceCents;

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
      {/* Premium Gradient Border */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" style={{ padding: '3px' }}>
        <div className="w-full h-full bg-white dark:bg-neutral-800 rounded-2xl"></div>
      </div>

      {/* Product Image */}
      <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-16 h-16 text-gray-300" />
          </div>
        )}

        {/* Premium Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {product.isFeatured && (
            <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-xl">
              ⭐ Featured
            </span>
          )}
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
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  ${formattedPrice}
                </span>
                {isOnSale && (
                  <span className="text-xl text-gray-500 dark:text-gray-400 line-through">
                    ${formattedSalePrice}
                  </span>
                )}
              </div>
              {isOnSale && (
                <p className="text-sm text-red-600 dark:text-red-400 font-medium mt-1">
                  Save ${(product.priceCents - product.salePriceCents!) / 100}
                </p>
              )}
            </div>
            
            {/* Premium Action Button */}
            <button className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
              <ShoppingCart className="w-5 h-5" />
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Product Card Component with Layout Variants
 */
export default function ProductCard({ 
  product, 
  variant = 'classic', 
  tenantId, 
  className = '',
  trackingContext 
}: ProductCardProps) {
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

  // Render based on variant
  switch (variant) {
    case 'enhanced':
      return <EnhancedLayout product={product} className={className} trackingContext={trackingContext} />;
    case 'compact':
      return <CompactLayout product={product} className={className} trackingContext={trackingContext} />;
    case 'premium':
      return <PremiumLayout product={product} className={className} trackingContext={trackingContext} />;
    case 'zoom':
      // For featured products, use the catalog's ZoomLayout
      // Import dynamically to avoid circular dependency
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
                {/* Zoom Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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

            {/* Stock Status */}
            {product.availability === 'out_of_stock' && (
              <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">
                  Out of Stock
                </span>
              </div>
            )}

            {/* Hover Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <p className="text-white text-xs font-medium truncate">
                {product.name}
              </p>
              <p className="text-white text-xs">
                ${(product.priceCents / 100).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Minimal Info (visible always) */}
          <div className="p-2">
            <h3 className="text-xs font-medium text-gray-900 dark:text-white truncate mb-1">
              {product.name}
            </h3>
            
            {/* Category - Always show */}
            <div className="mb-1">
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
            <div className="mb-1">
              {product.availability === 'out_of_stock' ? (
                <span className="inline-flex items-center px-1 py-0.5 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs rounded">
                  Out
                </span>
              ) : product.availability === 'preorder' ? (
                <span className="inline-flex items-center px-1 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">
                  Pre
                </span>
              ) : product.stock !== undefined ? (
                <span className="inline-flex items-center px-1 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">
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
              </span>
              {product.ratingAvg && (
                <div className="flex items-center gap-0.5">
                  <Star className="w-2 h-2 text-yellow-400 fill-current" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {product.ratingAvg.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    case 'classic':
    default:
      return <ClassicLayout product={product} className={className} trackingContext={trackingContext} />;
  }
}

// Export individual layouts for direct use
export { ClassicLayout, EnhancedLayout, CompactLayout, PremiumLayout };
export type { ProductData };
