'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Package, Star, ShoppingCart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useProductSingleton } from '@/providers/data/ProductSingleton';
import { useStoreData } from '@/providers/StoreProviderSingleton';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { Badge as MantineBadge } from '@mantine/core';

// ====================
// UNIVERSAL PRODUCT CARD
// ====================
interface UniversalProductCardProps {
  productId: string;
  tenantId?: string;
  variant?: 'compact' | 'detailed' | 'minimal';
  showStoreInfo?: boolean;
  showQuickActions?: boolean;
  className?: string;
  productData?: any; // Pre-fetched product data to avoid additional fetch
  // Payment gateway status from parent page/shop
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string;
}

// Featured type configuration
const FEATURED_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  // Merchant-controlled types
  staff_pick: { icon: '⭐', label: 'Staff Pick', color: 'from-amber-500 to-yellow-500' },
  new_arrival: { icon: '✨', label: 'New', color: 'from-emerald-500 to-green-500' },
  sale: { icon: '💰', label: 'Sale', color: 'from-red-500 to-rose-500' },
  seasonal: { icon: '🍂', label: 'Seasonal', color: 'from-orange-500 to-amber-500' },
  store_selection: { icon: '🏪', label: 'Featured', color: 'from-blue-500 to-indigo-500' },
  clearance: { icon: '🔥', label: 'Clearance', color: 'from-yellow-500 to-orange-500' },
  featured: { icon: '👑', label: 'Premium', color: 'from-indigo-500 to-purple-500' },
  
  // Platform-controlled types (algorithmic)
  trending: { icon: '📈', label: 'Trending', color: 'from-pink-500 to-rose-500' },
  recommended: { icon: '🏆', label: 'Recommended', color: 'from-teal-500 to-cyan-500' },
  bestseller: { icon: '🥇', label: 'Bestseller', color: 'from-amber-500 to-yellow-500' },
  random_featured: { icon: '✨', label: 'Discover', color: 'from-cyan-500 to-blue-500' },
  premium: { icon: '💎', label: 'Premium', color: 'from-violet-500 to-purple-500' },
};

// Get featured type badges to display (with fallback for unknown types)
const getFeaturedTypeBadges = (types: string[] | undefined) => {
  if (!types || types.length === 0) return [];
  return types.map(type => {
    // Use configured type or generate fallback
    if (FEATURED_TYPE_CONFIG[type]) {
      return { ...FEATURED_TYPE_CONFIG[type], type };
    }
    // Fallback for unknown types - format the type name nicely
    return {
      icon: '🏷️',
      label: type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      color: 'from-gray-500 to-slate-500',
      type
    };
  });
};



export function UniversalProductCard({ 
  productId, 
  tenantId, 
  variant = 'detailed', 
  showStoreInfo = true, 
  showQuickActions = true,
  className = '',
  productData, // Pre-fetched product data
  hasActivePaymentGateway: propHasActivePaymentGateway, // From parent page
  defaultGatewayType: propDefaultGatewayType, // From parent page
}: UniversalProductCardProps) {
   const { status: hoursStatus } = useStoreStatus(tenantId, true); // Public scope
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
  const { actions } = useProductSingleton();
  const [product, setProduct] = useState<any>(productData || null);
  const [loading, setLoading] = useState(!productData);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // If productData is provided, use it directly
    if (productData) {
      setProduct(productData);
      setLoading(false);
      return;
    }
    
    // Otherwise fetch the product
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const fetchedProduct = await actions.fetchProductById(productId, tenantId);
        setProduct(fetchedProduct);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch product');
      } finally {
        setLoading(false);
      }
    };
    
    if (productId) {
      fetchProduct();
    }
  }, [productId, tenantId, productData]);
  
  const storeData = tenantId ? useStoreData(tenantId) : { store: null, loading: false, error: null };
  const { store } = storeData;

  // Payment gateway status: props > product data
  const hasActivePaymentGateway = propHasActivePaymentGateway ?? product?.hasActivePaymentGateway ?? false;
  const defaultGatewayType = propDefaultGatewayType ?? product?.defaultGatewayType;

  // Format price - handle both raw values and pre-formatted values
  const formatPrice = (value: number | string | undefined): string => {
    if (value === undefined || value === null) return '0.00';
    if (typeof value === 'string') return value;
    // If value looks like cents (large number), convert to dollars
    if (value > 1000) return (value / 100).toFixed(2);
    return value.toFixed(2);
  };

  // Get formatted prices
  const formattedPrice = product?.formattedPrice || formatPrice(product?.price ?? product?.priceCents);
  const formattedSalePrice = product?.formattedSalePrice || formatPrice(product?.salePrice ?? product?.salePriceCents);

  if (loading) {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden ${className}`}>
        <div className="animate-pulse">
          <div className="aspect-square bg-gray-200 dark:bg-gray-700"></div>
          <div className="p-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden ${className}`}>
        <div className="p-4 text-center">
          <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Product not available</p>
        </div>
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    const featuredBadges = getFeaturedTypeBadges(product.featuredTypes);
    
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow ${className}`}>
        <Link href={`/products/${product.id}`} className="block">
          <div className="flex items-center p-3">
            {/* Product Image */}
            <div className="relative w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
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
              {/* Featured type icons overlay */}
              {featuredBadges.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-0.5 bg-black/40 px-1 py-0.5">
                  {featuredBadges.slice(0, 3).map((badge) => (
                    <span key={badge.type} title={badge.label} className="text-xs">
                      {badge.icon}
                    </span>
                  ))}
                  {featuredBadges.length > 3 && (
                    <span className="text-xs text-white">+{featuredBadges.length - 3}</span>
                  )}
                </div>
              )}
            </div>
            
            {/* Product Info */}
            <div className="ml-3 flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                
                {product.name}
              </h3>
              {/* SKU */}
              {product.sku && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  SKU: {product.sku}
                </p>
              )}
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
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  ${formattedPrice}
                </span>
                <div className="flex items-center gap-1">
                  {product.isOnSale && (
                    <span className="text-xs text-red-600 dark:text-red-400 line-through">
                      ${formattedSalePrice}
                    </span>
                  )}
                  {product.hasActivePaymentGateway && (
                    <ShoppingCart className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
              </div>
            </div>
            {showStoreInfo && store && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {store.name}
              </p>
            )}
          </div>
        </Link>
      </div>
    );
  }

  // Minimal variant
  if (variant === 'minimal') {
    const featuredBadges = getFeaturedTypeBadges(product.featuredTypes);
    
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow ${className}`}>
        <Link href={`/products/${product.id}`} className="block">
          <div className="p-3">
            <div className="flex items-center">
              {/* Product Image */}
              <div className="relative w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                {/* Featured type icons overlay */}
                {featuredBadges.length > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-0.5 bg-black/40 px-0.5 py-px">
                    {featuredBadges.slice(0, 2).map((badge) => (
                      <span key={badge.type} title={badge.label} className="text-[10px]">
                        {badge.icon}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Product Info */}
              <div className="ml-2 flex-1 min-w-0">
                <h3 className="text-xs font-medium text-gray-900 dark:text-white truncate">
                  
                  {product.name}
                </h3>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  ${formattedPrice}
                </span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  // Detailed variant (default)
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
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-400" />
          </div>
        )}
        
        {/* Featured Type Badges - displayed in a column on top-left */}
        {product.featuredTypes && product.featuredTypes.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {getFeaturedTypeBadges(product.featuredTypes).map((badge) => (
              <span
                key={badge.type}
                className={`inline-flex items-center px-2 py-0.5 bg-gradient-to-r ${badge.color} text-white text-xs font-medium rounded-full shadow-sm`}
              >
                <span className="mr-1">{badge.icon}</span>
                {badge.label}
              </span>
            ))}
          </div>
        )}
        
        {/* Stock Status */}
        {product.stockStatus === 'out_of_stock' && (
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
        <Link href={`/products/${product.id}`}>
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
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              ${formattedPrice}
            </span>
            {product.isOnSale && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 line-through">
                ${formattedSalePrice}
              </span>
            )}
          </div>
          {product.isOnSale && (
            <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">
              Sale
            </span>
          )}
        </div>

        {/* Store Info */}
        {showStoreInfo && store && (
          <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Sold by <span className="font-medium text-gray-900 dark:text-white">{store.name}</span>
            </p>
            {store.city && store.state && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {store.city}, {store.state}
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
              </p>
            )}
          </div>
        )}

        {/* Quick Actions */}
        {showQuickActions && (
          <div className="flex items-center gap-2">
            {hasActivePaymentGateway ? (
              <>
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart
                </button>
                {defaultGatewayType && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    {defaultGatewayType === 'paypal' && (
                      <span className="text-blue-600">💳</span>
                    )}
                    {defaultGatewayType === 'stripe' && (
                      <span className="text-purple-600">💳</span>
                    )}
                    {defaultGatewayType === 'square' && (
                      <span className="text-green-600">💳</span>
                    )}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                Contact store for purchase
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
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ====================
// BATCH PRODUCT CARD
// ====================
interface BatchProductCardProps {
  productIds: string[];
  maxColumns?: number;
  className?: string;
}

export function BatchProductCard({ productIds, maxColumns = 4, className = '' }: BatchProductCardProps) {
  const { actions } = useProductSingleton();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      
      try {
        const fetchedProducts = await Promise.all(
          productIds.map(id => actions.fetchProductById(id))
        );
        setProducts(fetchedProducts.filter(Boolean));
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (productIds.length > 0) {
      fetchProducts();
    }
  }, [productIds]);
  
  const isLoading = loading;

  if (isLoading) {
    return (
      <div className={`grid grid-cols-${maxColumns} gap-4 ${className}`}>
        {Array.from({ length: productIds.length }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-lg aspect-square"></div>
            <div className="mt-2 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-${maxColumns} gap-4 ${className}`}>
      {products.map((product: any) => (
        <UniversalProductCard
          key={product.id}
          productId={product.id}
          tenantId={product.tenantId}
          variant="compact"
        />
      ))}
    </div>
  );
}
