'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Package, Star, ShoppingCart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useProductSingleton } from '@/providers/data/ProductSingleton';
import { useStoreData } from '@/providers/StoreProviderSingleton';

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
}

export function UniversalProductCard({ 
  productId, 
  tenantId, 
  variant = 'detailed', 
  showStoreInfo = true, 
  showQuickActions = true,
  className = '' 
}: UniversalProductCardProps) {
  const { actions } = useProductSingleton();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
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
  }, [productId, tenantId]);
  
  const storeData = tenantId ? useStoreData(tenantId) : { store: null, loading: false, error: null };
  const { store } = storeData;

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
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow ${className}`}>
        <Link href={`/products/${product.id}`} className="block">
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
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  ${product.formattedPrice}
                </span>
                {product.isOnSale && (
                  <span className="text-xs text-red-600 dark:text-red-400 line-through">
                    ${product.formattedSalePrice}
                  </span>
                )}
              </div>
              {showStoreInfo && store && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {store.name}
                </p>
              )}
            </div>
          </div>
        </Link>
      </div>
    );
  }

  // Minimal variant
  if (variant === 'minimal') {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow ${className}`}>
        <Link href={`/products/${product.id}`} className="block">
          <div className="p-3">
            <div className="flex items-center">
              {/* Product Image */}
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
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
              </div>
              
              {/* Product Info */}
              <div className="ml-2 flex-1 min-w-0">
                <h3 className="text-xs font-medium text-gray-900 dark:text-white truncate">
                  {product.name}
                </h3>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  ${product.formattedPrice}
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

        {/* Description */}
        {product.description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Price */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              ${product.formattedPrice}
            </span>
            {product.isOnSale && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 line-through">
                ${product.formattedSalePrice}
              </span>
            )}
          </div>
          {product.isOnSale && (
            <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">
              Sale
            </span>
          )}
        </div>

        {/* Category */}
        {product.category && (
          <div className="mb-3">
            <span className="inline-flex items-center px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full">
              {product.category.name}
            </span>
          </div>
        )}

        {/* Store Info */}
        {showStoreInfo && store && (
          <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Sold by <span className="font-medium text-gray-900 dark:text-white">{store.name}</span>
            </p>
            {store.city && store.state && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {store.city}, {store.state}
              </p>
            )}
          </div>
        )}

        {/* Quick Actions */}
        {showQuickActions && (
          <div className="flex items-center gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
              <ShoppingCart className="w-4 h-4" />
              Add to Cart
            </button>
            <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
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
