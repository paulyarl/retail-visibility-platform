"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Package, ShoppingCart, Star } from 'lucide-react';
import { useProductLayout } from '@/contexts/ProductLayoutContext';

// Enhanced product interface for catalog
interface CatalogProduct {
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
  categoryName?: string; // From API response
  categorySlug?: string;
  condition?: string;
  availability?: 'in_stock' | 'out_of' | 'preorder';
  ratingAvg?: number;
  ratingCount?: number;
  isFeatured?: boolean;
  featuredType?: string;
  featuredTypes?: string[]; // New field for multiple featured types
  hasVariants?: boolean;
  metadata?: Record<string, any>;
  // Additional catalog-specific fields
  price?: number;
  salePrice?: number;
  currency?: string;
  tenantCategory?: {
    id: string;
    name: string;
    slug: string;
  };
  images?: ProductImage[];
}

interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  isPrimary?: boolean;
}

// Helper function to render featured type badges
const renderFeaturedTypeBadges = (featuredTypes: string[] | undefined, className: string = '', compact: boolean = false) => {
  if (!featuredTypes || featuredTypes.length === 0) return null;
  
  const getBadgeConfig = (type: string) => {
    switch (type) {
      case 'staff_pick':
        return { icon: '⭐', gradient: 'from-purple-500 to-indigo-500', label: 'Staff Pick' };
      case 'new_arrival':
        return { icon: '✨', gradient: 'from-green-500 to-emerald-500', label: 'New' };
      case 'sale':
        return { icon: '💰', gradient: 'from-red-500 to-pink-500', label: 'Sale' };
      case 'seasonal':
        return { icon: '🍂', gradient: 'from-orange-500 to-red-500', label: 'Seasonal' };
      case 'store_selection':
        return { icon: '🏪', gradient: 'from-blue-500 to-cyan-500', label: 'Store Selection' };
      default:
        return { icon: '⭐', gradient: 'from-amber-500 to-orange-500', label: 'Featured' };
    }
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {featuredTypes.map((type) => {
        const config = getBadgeConfig(type);
        return (
          <span
            key={type}
            className={`inline-flex items-center ${
              compact ? 'px-1.5 py-0.5' : 'px-2 py-1'
            } bg-gradient-to-r ${config.gradient} text-white text-xs font-bold rounded-full ${
              !compact && 'shadow-lg'
            }`}
          >
            {compact ? config.icon : `${config.icon} ${config.label}`}
          </span>
        );
      })}
    </div>
  );
};

interface CatalogLayoutProps {
  products: CatalogProduct[];
  tenantId: string;
  variant?: 'classic' | 'enhanced' | 'compact' | 'premium' | 'zoom';
  initialPageSize?: number;
  showPagination?: boolean;
  className?: string;
  // External pagination state for server-side pagination
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  totalCount?: number;
}

/**
 * Classic Catalog Layout - Traditional grid display
 */
function ClassicCatalogLayout({ products, tenantId, className = '' }: Pick<CatalogLayoutProps, 'products' | 'tenantId' | 'className'>) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}>
      {products.map((product) => (
        <Link key={product.id} href={`/products/${product.id}`} className="block group">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-200">
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
                <div className="absolute top-2 right-2">
                  <span className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                    Featured
                  </span>
                </div>
              )}

              {/* Featured Type Badges */}
              {renderFeaturedTypeBadges(product.featuredTypes, "absolute top-2 left-2")}
              
              {/* Stock Status */}
              {product.availability === 'out_of' && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate mb-1">
                {product.name}
              </h3>
              
              {/* Category - Always show */}
              <div className="mb-2">
                {product.categoryName ? (
                  <span className="inline-flex items-center px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded">
                    🏷️ {product.categoryName}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
                    No Category
                  </span>
                )}
              </div>

              {/* Brand */}
              {product.brand && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                  {product.brand}
                </p>
              )}

              {/* Stock - Always show */}
              <div className="mb-2">
                {product.availability === 'out_of' ? (
                  <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs rounded">
                    Out of Stock
                  </span>
                ) : product.availability === 'preorder' ? (
                  <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">
                    Pre-order
                  </span>
                ) : product.stock !== undefined ? (
                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">
                    In Stock: {product.stock}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs rounded">
                    Stock: Unknown
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  ${(product.price || (product.priceCents / 100)).toFixed(2)}
                </span>
                {(product.salePrice || product.salePriceCents) && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 line-through">
                    ${((product.salePrice || product.salePriceCents!) / 100).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Rating */}
              {product.ratingAvg && (
                <div className="flex items-center gap-1 mt-2">
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {product.ratingAvg.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/**
 * Enhanced Catalog Layout - Modern with hover effects
 */
function EnhancedCatalogLayout({ products, tenantId, className = '' }: Pick<CatalogLayoutProps, 'products' | 'tenantId' | 'className'>) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}>
      {products.map((product) => (
        <Link key={product.id} href={`/products/${product.id}`} className="block group">
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
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
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
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
              {product.availability === 'out_of' && (
                <div className="absolute top-3 right-3">
                  <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate mb-1 group-hover:text-blue-600 transition-colors">
                {product.name}
              </h3>
              
              {/* Brand */}
              {product.brand && (
                <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">
                  {product.brand}
                </p>
              )}

              {/* Price */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  ${(product.price || (product.priceCents / 100)).toFixed(2)}
                </span>
                {(product.salePrice || product.salePriceCents) && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
                    ${((product.salePrice || product.salePriceCents!) / 100).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Stock - Always show */}
              <div className="mb-2">
                {product.availability === 'out_of' ? (
                  <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs rounded">
                    Out of Stock
                  </span>
                ) : product.availability === 'preorder' ? (
                  <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">
                    Pre-order
                  </span>
                ) : product.stock !== undefined ? (
                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">
                    In Stock: {product.stock}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs rounded">
                    Stock: Unknown
                  </span>
                )}
              </div>

              {/* Rating */}
              {product.ratingAvg && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {product.ratingAvg.toFixed(1)} ({product.ratingCount})
                  </span>
                </div>
              )}

              {/* Quick Action */}
              <button className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                <ShoppingCart className="w-4 h-4" />
                Add to Cart
              </button>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/**
 * Compact Catalog Layout - Space-efficient with zoom
 */
function CompactCatalogLayout({ products, tenantId, className = '' }: Pick<CatalogLayoutProps, 'products' | 'tenantId' | 'className'>) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 ${className}`}>
      {products.map((product) => (
        <Link key={product.id} href={`/products/${product.id}`} className="block group">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-all duration-200 transform hover:scale-105">
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
                  <Package className="w-6 h-6 text-gray-400" />
                </div>
              )}

              {/* Featured Badge */}
              {product.isFeatured && (
                <div className="absolute top-1 right-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                    ⭐
                  </span>
                </div>
              )}

              {/* Featured Type Badges */}
              {renderFeaturedTypeBadges(product.featuredTypes, "absolute top-1 left-1 flex-col gap-0.5", true)}

              {/* Stock Status */}
              {product.availability === 'out_of' && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>

            {/* Product Info */}
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
                {product.availability === 'out_of' ? (
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
              
              {/* Price */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  ${(product.price || (product.priceCents / 100)).toFixed(2)}
                </span>
                {(product.salePrice || product.salePriceCents) && (
                  <span className="text-xs text-red-600 dark:text-red-400 line-through">
                    ${((product.salePrice || product.salePriceCents!) / 100).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Rating */}
              {product.ratingAvg && (
                <div className="flex items-center gap-0.5 mt-1">
                  <Star className="w-2 h-2 text-yellow-400 fill-current" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {product.ratingAvg.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/**
 * Premium Catalog Layout - Luxury styling with zoom
 */
function PremiumCatalogLayout({ products, tenantId, className = '' }: Pick<CatalogLayoutProps, 'products' | 'tenantId' | 'className'>) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 ${className}`}>
      {products.map((product) => (
        <Link key={product.id} href={`/products/${product.id}`} className="block group">
          <div className="relative bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-gray-100 dark:border-gray-700">
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
                  className="object-cover group-hover:scale-115 transition-transform duration-700"
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
                {(product.salePrice || product.salePriceCents) && (
                  <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-xl">
                    💰 Sale
                  </span>
                )}
              </div>

              {/* Stock Status */}
              {product.availability === 'out_of' && (
                <div className="absolute top-4 right-4">
                  <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-xl">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>

            {/* Premium Product Info */}
            <div className="p-5">
              {/* Brand and Name */}
              <div className="mb-3">
                {product.brand && (
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                    {product.brand}
                  </p>
                )}
                <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate group-hover:text-amber-600 transition-colors">
                  {product.name}
                </h3>
              </div>

              {/* Price */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${(product.price || (product.priceCents / 100)).toFixed(2)}
                    </span>
                    {(product.salePrice || product.salePriceCents) && (
                      <span className="text-lg text-gray-500 dark:text-gray-400 line-through">
                        ${((product.salePrice || product.salePriceCents!) / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {(product.salePrice || product.salePriceCents) && (
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                      Save ${((product.priceCents - (product.salePriceCents || 0)) / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {/* Rating */}
              {product.ratingAvg && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(product.ratingAvg!)
                            ? 'text-amber-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {product.ratingAvg.toFixed(1)} ({product.ratingCount})
                  </span>
                </div>
              )}

              {/* Premium Action Button */}
              <button className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
              </button>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/**
 * Zoom Catalog Layout - Small cards with prominent zoom effect
 */
function ZoomCatalogLayout({ products, tenantId, className = '' }: Pick<CatalogLayoutProps, 'products' | 'tenantId' | 'className'>) {
  return (
    <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4 ${className}`}>
      {products.map((product) => (
        <Link key={product.id} href={`/products/${product.id}`} className="block group">
          <div className="relative bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-110 hover:z-10">
            {/* Product Image with Zoom Effect */}
            <div className="relative aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden">
              {product.imageUrl ? (
                <>
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-125"
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

              {/* Featured Type Badges */}
              {renderFeaturedTypeBadges(product.featuredTypes, "absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex-col gap-1")}

              {/* Stock Status */}
              {product.availability === 'out_of' && (
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
                  ${(product.price || (product.priceCents / 100)).toFixed(2)}
                </p>
                {product.categoryName && (
                  <p className="text-white text-xs opacity-90">
                    {product.categoryName}
                  </p>
                )}
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
                {product.availability === 'out_of' ? (
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
                  ${(product.price || (product.priceCents / 100)).toFixed(2)}
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
        </Link>
      ))}
    </div>
  );
}

/**
 * Main Catalog Component with Layout Variants
 */
export default function CatalogLayout({ 
  products, 
  tenantId, 
  variant = 'classic', 
  initialPageSize = 12,
  showPagination = true,
  className = '',
  currentPage: externalCurrentPage,
  totalPages: externalTotalPages,
  onPageChange: externalOnPageChange,
  totalCount: externalTotalCount
}: CatalogLayoutProps) {
  const { variant: layoutVariant } = useProductLayout();
  
  // Use external pagination state if provided, otherwise use internal state
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);
  const currentPage = externalCurrentPage !== undefined ? externalCurrentPage : internalCurrentPage;
  const setCurrentPage = externalOnPageChange !== undefined ? externalOnPageChange : setInternalCurrentPage;
  
  const productsPerPage = initialPageSize;
  
  // Filter out products with missing required data
  const validProducts = products.filter(product => 
    product && 
    product.id && 
    product.name && 
    (product.priceCents || product.price)
  );
  
  // Calculate pagination - use external totals if provided
  const totalPages = externalTotalPages !== undefined ? externalTotalPages : Math.ceil(validProducts.length / productsPerPage);
  const totalCount = externalTotalCount !== undefined ? externalTotalCount : validProducts.length;
  
  // Calculate pagination - use external page if provided
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = validProducts.slice(indexOfFirstProduct, indexOfLastProduct);

  // Render based on variant
  switch (layoutVariant) {
    case 'enhanced':
      return (
        <div className={className}>
          <EnhancedCatalogLayout products={currentProducts} tenantId={tenantId} />
          {showPagination && totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalCount={totalCount}
              productsPerPage={productsPerPage}
            />
          )}
        </div>
      );
    case 'compact':
      return (
        <div className={className}>
          <CompactCatalogLayout products={currentProducts} tenantId={tenantId} />
          {showPagination && totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalCount={totalCount}
              productsPerPage={productsPerPage}
            />
          )}
        </div>
      );
    case 'premium':
      return (
        <div className={className}>
          <PremiumCatalogLayout products={currentProducts} tenantId={tenantId} />
          {showPagination && totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalCount={totalCount}
              productsPerPage={productsPerPage}
            />
          )}
        </div>
      );
    case 'zoom':
      return (
        <div className={className}>
          <ZoomCatalogLayout products={currentProducts} tenantId={tenantId} />
          {showPagination && totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalCount={totalCount}
              productsPerPage={productsPerPage}
            />
          )}
        </div>
      );
    case 'classic':
    default:
      return (
        <div className={className}>
          <ClassicCatalogLayout products={currentProducts} tenantId={tenantId} />
          {showPagination && totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalCount={totalCount}
              productsPerPage={productsPerPage}
            />
          )}
        </div>
      );
  }
}

// Pagination Controls Component
interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount: number;
  productsPerPage: number;
}

function PaginationControls({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  totalCount, 
  productsPerPage 
}: PaginationControlsProps) {
  const startItem = (currentPage - 1) * productsPerPage + 1;
  const endItem = Math.min(currentPage * productsPerPage, totalCount);

  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
      <div className="text-sm text-gray-700 dark:text-gray-300">
        Showing {startItem}-{endItem} of {totalCount} products
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// Export individual layouts for direct use
export { 
  ClassicCatalogLayout, 
  EnhancedCatalogLayout, 
  CompactCatalogLayout, 
  PremiumCatalogLayout, 
  ZoomCatalogLayout 
};
export type { CatalogProduct };
