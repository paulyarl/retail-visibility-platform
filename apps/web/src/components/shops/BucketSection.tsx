import React from 'react';
import { ShoppingCart, Star } from 'lucide-react';
import { AddToCartButton } from '@/components/products/AddToCartButton';

/**
 * Bucket Section Component - Reusable container for shops discovery buckets
 * 
 * Provides consistent layout and styling for all bucket types.
 * Supports different bucket layouts (products, shops, categories).
 */
export interface BucketSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  className?: string;
  showViewAll?: boolean;
  viewAllUrl?: string;
  viewAllText?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}

export function BucketSection({
  title,
  subtitle,
  children,
  loading = false,
  error = null,
  className = '',
  showViewAll = false,
  viewAllUrl,
  viewAllText = 'View All',
  badge,
  action
}: BucketSectionProps) {
  if (loading) {
    return (
      <section className={`bucket-section ${className}`}>
        <div className="bucket-header">
          <div className="bucket-title-group">
            <h2 className="bucket-title">
              <div className="skeleton h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
            </h2>
            {subtitle && (
              <div className="skeleton h-4 w-48 bg-gray-100 rounded animate-pulse mt-1"></div>
            )}
          </div>
          {showViewAll && (
            <div className="skeleton h-8 w-20 bg-gray-100 rounded animate-pulse"></div>
          )}
        </div>
        <div className="bucket-content">
          <div className="bucket-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bucket-item">
                <div className="skeleton h-32 bg-gray-100 rounded-lg animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={`bucket-section ${className}`}>
        <div className="bucket-header">
          <div className="bucket-title-group">
            <h2 className="bucket-title">{title}</h2>
            {subtitle && <p className="bucket-subtitle">{subtitle}</p>}
          </div>
        </div>
        <div className="bucket-content">
          <div className="bucket-error">
            <div className="error-icon">⚠️</div>
            <div className="error-message">
              <p>Unable to load {title.toLowerCase()}</p>
              <p className="error-detail">{error}</p>
            </div>
            <button 
              className="error-retry"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`bucket-section ${className}`}>
      <div className="bucket-header">
        <div className="bucket-title-group">
          <h2 className="bucket-title text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {title}
            {badge && <span className="bucket-badge ml-2">{badge}</span>}
          </h2>
          {subtitle && <p className="bucket-subtitle text-gray-600 dark:text-gray-400">{subtitle}</p>}
        </div>
        <div className="bucket-actions">
          {action && action}
          {showViewAll && viewAllUrl && (
            <a 
              href={viewAllUrl} 
              className="bucket-view-all inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              {viewAllText}
              <span className="view-all-arrow ml-1">→</span>
            </a>
          )}
        </div>
      </div>
      <div className="bucket-content">
        {children}
      </div>
    </section>
  );
}

/**
 * Product Bucket Component - For product-focused buckets
 */
export interface ProductBucketProps {
  products: any[];
  loading?: boolean;
  error?: string | null;
  title: string;
  subtitle?: string;
  maxItems?: number;
  showViewAll?: boolean;
  viewAllUrl?: string;
  onProductClick?: (product: any) => void;
  viewMode?: 'grid' | 'list';
}

export function ProductBucket({
  products,
  loading,
  error,
  title,
  subtitle,
  maxItems = 8,
  showViewAll = false,
  viewAllUrl,
  onProductClick,
  viewMode = 'grid'
}: ProductBucketProps) {
  const displayProducts = products.slice(0, maxItems);

  return (
    <BucketSection
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      showViewAll={showViewAll}
      viewAllUrl={viewAllUrl}
      className="product-bucket"
    >
      <div 
        className={`${viewMode === 'list' ? 'bucket-grid-list' : 'bucket-grid bucket-grid-products'}`}
        style={viewMode === 'grid' ? {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.5rem',
          width: '100%'
        } : undefined}
      >
        {displayProducts.map((product, index) => (
          <div 
            key={product.id || product.inventory_item_id || product.inventoryItemId || index} 
            className={`bucket-item product-item group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer ${
              viewMode === 'list' ? 'flex' : ''
            }`}
            onClick={() => onProductClick?.(product)}
          >
            {/* Product Image */}
            <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-700 ${
              viewMode === 'list' ? 'w-32 h-32 flex-shrink-0' : 'aspect-square'
            }`}>
              {product.image_url || product.imageUrl ? (
                <img 
                  src={product.image_url || product.imageUrl} 
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
                  <span className="text-4xl">📦</span>
                </div>
              )}
              
              {/* Featured Badge */}
              {product.featuredType && (
                <div className="absolute top-2 left-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full shadow-sm flex items-center gap-1 ${
                    product.featuredType === 'store_selection' 
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                      : product.featuredType === 'new_arrival'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : product.featuredType === 'sale'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : product.featuredType === 'seasonal'
                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      : product.featuredType === 'staff_pick'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : product.featuredType === 'trending'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                  }`}>
                    <span className="text-xs">
                      {product.featuredType === 'store_selection' && '🏪'}
                      {product.featuredType === 'new_arrival' && '✨'}
                      {product.featuredType === 'sale' && '🏷️'}
                      {product.featuredType === 'seasonal' && '🍂'}
                      {product.featuredType === 'staff_pick' && '⭐'}
                      {product.featuredType === 'trending' && '🔥'}
                    </span>
                    <span className="text-xs font-medium">
                      {product.featuredType === 'store_selection' && 'Store Pick'}
                      {product.featuredType === 'new_arrival' && 'New'}
                      {product.featuredType === 'sale' && 'Sale'}
                      {product.featuredType === 'seasonal' && 'Seasonal'}
                      {product.featuredType === 'staff_pick' && 'Staff Pick'}
                      {product.featuredType === 'trending' && 'Trending'}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
              <div className="space-y-2">
                {/* Product Name */}
                <h3 className="product-name font-semibold text-gray-900 dark:text-white line-clamp-2 text-sm leading-tight">
                  {product.name.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')}
                </h3>
                
                {/* SKU */}
                {product.sku && (
                  <p className="product-sku text-xs text-gray-500 dark:text-gray-400 font-mono">
                    SKU: {product.sku}
                  </p>
                )}
                
                {/* Brand */}
                {product.brand && (
                  <p className="product-brand text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                    {product.brand}
                  </p>
                )}
                
                {/* Category */}
                {(product.tenantCategory?.name || product.categoryName) && (
                  <p className="product-category text-xs text-blue-600 dark:text-blue-400 font-medium">
                    {product.tenantCategory?.name || product.categoryName}
                  </p>
                )}
                
                {/* Description */}
                {product.description && (
                  <p className="product-description text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                    {product.description.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')}
                  </p>
                )}
                
                {/* Condition */}
                {product.condition && (
                  <p className="product-condition text-xs text-gray-500 dark:text-gray-400">
                    {product.condition === 'brand_new' && 'Brand New'}
                    {product.condition === 'new' && 'New'}
                    {product.condition === 'refurbished' && 'Refurbished'}
                    {product.condition === 'used' && 'Used'}
                    {!['brand_new', 'new', 'refurbished', 'used'].includes(product.condition) && product.condition}
                  </p>
                )}
                
                {/* Rating */}
                {product.ratingAvg && (
                  <div className="product-rating flex items-center gap-1">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${
                            i < Math.floor(product.ratingAvg)
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300 dark:text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {product.ratingAvg.toFixed(1)} ({product.ratingCount || 0})
                    </span>
                  </div>
                )}
                
                {/* Price */}
                <div className="product-price">
                  {(product.sale_price_cents || product.salePriceCents) && (product.sale_price_cents || product.salePriceCents) < (product.price_cents || product.priceCents) ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="sale-price text-lg font-bold text-red-600 dark:text-red-400">
                          ${((product.sale_price_cents || product.salePriceCents) / 100).toFixed(2)}
                        </span>
                        <span className="original-price text-sm text-gray-400 line-through">
                          ${((product.price_cents || product.priceCents) / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="discount-badge bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs font-medium px-2 py-0.5 rounded-full">
                          {Math.round(((1 - (product.sale_price_cents || product.salePriceCents) / (product.price_cents || product.priceCents)) * 100))}% OFF
                        </span>
                        <span className="savings text-xs text-green-600 dark:text-green-400 font-medium">
                          Save ${(((product.price_cents || product.priceCents) - (product.sale_price_cents || product.salePriceCents)) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : product.price_cents || product.priceCents ? (
                    <span className="price text-lg font-bold text-gray-900 dark:text-white">
                      ${((product.price_cents || product.priceCents) / 100).toFixed(2)}
                    </span>
                  ) : (
                    <span className="price-contact text-sm text-gray-600 dark:text-gray-400 italic">
                      Contact for price
                    </span>
                  )}
                </div>
                
                {/* Stock Status */}
                <div className="product-stock">
                  {(product.stock !== undefined) ? (
                    product.stock > 0 ? (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        {product.stock} in stock
                      </span>
                    ) : (
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                        Out of stock
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Availability unknown
                    </span>
                  )}
                </div>
                
                {/* Store Info with Logo */}
                <div className="product-shop border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <div 
                    className="flex items-center gap-2 group/shop cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-2 -m-2 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/shops/${product.tenant_id || product.tenantId}`;
                    }}
                  >
                    {/* Store Logo */}
                    {(() => {
                      const logoUrl = product.tenantLogoUrl || product.tenant_logo_url;
                      // Debug specifically for "Discover Something New" bucket
                      if (title.includes('Discover Something New') && index === 0) {
                        const populatedFields = Object.keys(product).filter(key => product[key] !== undefined && product[key] !== null);
                        const tenantFields = Object.keys(product).filter(key => key.includes('tenant')).reduce((obj: any, key) => {
                          obj[key] = product[key];
                          return obj;
                        }, {});
                        console.log('[BucketSection] Discover Something New Bucket Debug:', {
                          productId: product.inventoryItemId || product.inventory_item_id,
                          productName: product.productName || product.product_name,
                          tenantId: product.tenantId || product.tenant_id,
                          tenantName: product.tenantName || product.tenant_name,
                          tenantLogoUrl: product.tenantLogoUrl,
                          tenant_logo_url: product.tenant_logo_url,
                          logoUrl,
                          hasLogo: !!logoUrl,
                          totalKeys: Object.keys(product).length,
                          populatedKeys: populatedFields.length,
                          populatedFields: populatedFields.slice(0, 20), // First 20 fields
                          logoKeys: Object.keys(product).filter(k => k.includes('logo')),
                          tenantFields: tenantFields,
                          // Check if this looks like cached data vs API data
                          hasInventoryItemId: !!product.inventoryItemId,
                          hasInventory_item_id: !!product.inventory_item_id,
                          hasId: !!product.id
                        });
                      }
                      return logoUrl;
                    })() ? (
                      <img 
                        src={product.tenantLogoUrl || product.tenant_logo_url} 
                        alt={product.tenant_name || product.tenantName || 'Store'}
                        className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                        onError={(e) => {
                          console.error('Logo failed to load:', product.tenantLogoUrl || product.tenant_logo_url);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                        {(product.tenantName || product.tenant_name || 'S').charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    {/* Store Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover/shop:text-blue-600 dark:group-hover/shop:text-blue-400 truncate transition-colors">
                        {product.tenantName || product.tenant_name || 'Shop'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Visit Store →
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action Button */}
              <div className={`p-4 pt-0 ${viewMode === 'list' ? 'w-48 flex-shrink-0' : ''}`}>
                <div className="space-y-2">
                  {/* Payment Gateway Status */}
                  {product.hasActivePaymentGateway && (
                    <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span>Secure checkout available</span>
                    </div>
                  )}
                  
                  {/* Add to Cart Button */}
                  <AddToCartButton
                    product={{
                      id: product.inventoryItemId || product.inventory_item_id,
                      name: product.productName || product.product_name,
                      priceCents: product.priceCents || product.current_price_cents,
                      salePriceCents: product.salePriceCents || product.sale_price_cents,
                      imageUrl: product.imageUrl || product.image_url,
                      sku: product.sku,
                                            stock: product.stock,
                      has_variants: product.has_variants || false,
                      payment_gateway_type: product.defaultGatewayType,
                      tenantId: product.tenantId || product.tenant_id
                    }}
                    tenantName={product.tenantName || product.tenant_name || 'Shop'}
                    hasActivePaymentGateway={product.hasActivePaymentGateway}
                    defaultGatewayType={product.defaultGatewayType}
                    className="w-full text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
          )
        )}
      </div>
    </BucketSection>
  );
}

/**
 * Shop Bucket Component - For shop-focused buckets
 */
export interface ShopBucketProps {
  shops: any[];
  loading?: boolean;
  error?: string | null;
  title: string;
  subtitle?: string;
  maxItems?: number;
  showViewAll?: boolean;
  viewAllUrl?: string;
  onShopClick?: (shop: any) => void;
}

export function ShopBucket({
  shops,
  loading,
  error,
  title,
  subtitle,
  maxItems = 6,
  showViewAll = false,
  viewAllUrl,
  onShopClick
}: ShopBucketProps) {
  const displayShops = shops.slice(0, maxItems);

  return (
    <BucketSection
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      showViewAll={showViewAll}
      viewAllUrl={viewAllUrl}
      className="shop-bucket"
    >
      <div className="bucket-grid bucket-grid-shops">
        {displayShops.map((shop, index) => (
          <div 
            key={shop.id || index} 
            className="bucket-item shop-item"
            onClick={() => onShopClick?.(shop)}
          >
            <div className="shop-image">
              {shop.logo_url ? (
                <img 
                  src={shop.logo_url} 
                  alt={shop.name}
                  loading="lazy"
                />
              ) : (
                <div className="shop-image-placeholder">
                  <span className="placeholder-icon">🏪</span>
                </div>
              )}
              {shop.trending_score && (
                <div className="trending-badge">
                  🔥 Trending
                </div>
              )}
            </div>
            <div className="shop-info">
              <h3 className="shop-name">{shop.name}</h3>
              <p className="shop-description">
                {shop.business_description || 'Great products and service'}
              </p>
              <div className="shop-stats">
                <span className="product-count">
                  {shop.product_count || 0} products
                </span>
                {shop.rating_avg && (
                  <span className="rating">
                    ⭐ {shop.rating_avg.toFixed(1)} ({shop.rating_count})
                  </span>
                )}
              </div>
              <div className="shop-location">
                {shop.city && shop.state && (
                  <span className="location">
                    📍 {shop.city}, {shop.state}
                  </span>
                )}
              </div>
            </div>
          </div>
          ))}
      </div>
    </BucketSection>
  );
}

export default BucketSection;
