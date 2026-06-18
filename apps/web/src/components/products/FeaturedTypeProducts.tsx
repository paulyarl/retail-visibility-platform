'use client';

import { useEffect, useMemo, useState } from 'react';
import SmartProductCard from './SmartProductCard';
import { FEATURED_TYPES } from '@/types/product-display';

interface FeaturedTypeProduct {
  id: string;
  name: string;
  title: string;
  price: number;
  priceCents?: number;
  listPriceCents?: number;
  salePriceCents?: number;
  isOnSale?: boolean;
  discountPercentage?: string;
  stock: number;
  sku?: string;
  currency: string;
  imageUrl?: string;
  brand?: string;
  tenantId: string;
  featuredType: string;
  featuredTypes?: string[];
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string | null;
  availability?: string;
  categoryName?: string;
  categorySlug?: string;
}

interface FeaturedTypeProductsProps {
  currentProductId: string;
  tenantId: string;
  featuredTypes: string[];
  showAllBuckets?: boolean; // If true, show all buckets with products, not just current product's types
  groupedProducts: Record<string, any[]>; // Pre-fetched and merchant-gate filtered from page root
  /** Only show badges for these featured types (gated types filtered out) */
  allowedFeaturedTypes?: string[];
}

// Featured type configuration - supports all featured types in the system
const featuredTypeConfig: Record<string, { icon: string; bgColor: string; textColor: string; label: string; description: string }> = {
  store_selection: {
    icon: '⭐',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    label: 'Featured Products',
    description: 'Hand-picked favorites from our collection'
  },
  new_arrival: {
    icon: '✨',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    label: 'New Arrivals',
    description: 'Fresh products just added to our store'
  },
  seasonal: {
    icon: '🗓️',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    label: 'Seasonal Specials',
    description: 'Perfect for this time of year'
  },
  sale: {
    icon: '🏷️',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    label: 'Sale Items',
    description: 'Great deals on selected products'
  },
  staff_pick: {
    icon: '👥',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    label: 'Staff Picks',
    description: 'Hand-picked favorites by our team'
  },
  bestseller: {
    icon: '🥇',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    label: 'Bestsellers',
    description: 'Our most popular products'
  },
  clearance: {
    icon: '🔥',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-700',
    label: 'Clearance',
    description: 'Last chance to grab these deals'
  },
  trending: {
    icon: '📈',
    bgColor: 'bg-cyan-50',
    textColor: 'text-cyan-700',
    label: 'Trending',
    description: 'Hot products everyone is viewing'
  },
  recommended: {
    icon: '🏆',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    label: 'Recommended',
    description: 'Products we think you\'ll love'
  },
  featured: {
    icon: '👑',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    label: 'Featured',
    description: 'Spotlight on special products'
  },
  premium: {
    icon: '💎',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    label: 'Premium Selection',
    description: 'Top-tier products for discerning buyers'
  },
};

export function FeaturedTypeProducts({ currentProductId, tenantId, featuredTypes, showAllBuckets = false, groupedProducts = {}, allowedFeaturedTypes }: FeaturedTypeProductsProps) {
  const [activeTab, setActiveTab] = useState(0);

  const productsByType = useMemo(() => {
    // By default (showAllBuckets=false), only show buckets matching the product's own featuredTypes.
    // This means if Product A is "new_arrival" + "sale", only those pills appear.
    // When showAllBuckets=true, show all store buckets regardless of product's types.
    const availableTypes = showAllBuckets
      ? Object.keys(groupedProducts || {})
      : (featuredTypes || []);

    if (availableTypes.length === 0) return {};

    const grouped: Record<string, FeaturedTypeProduct[]> = {};

    const typesToProcess = availableTypes;

    for (const type of typesToProcess) {
      if (groupedProducts[type] && groupedProducts[type].length > 0) {
        const filteredProducts = groupedProducts[type]
          .filter((p: any) => p.id !== currentProductId)
          .slice(0, 4);

        if (filteredProducts.length > 0) {
          grouped[type] = filteredProducts.map((p: any) => ({
            id: p.id,
            name: p.name,
            title: p.title || p.name,
            price: p.price || 0,
            priceCents: p.priceCents,
            listPriceCents: p.listPriceCents,
            salePriceCents: p.salePriceCents,
            isOnSale: p.isOnSale,
            discountPercentage: p.discountPercentage,
            stock: p.stock || 0,
            sku: p.sku,
            currency: p.currency || 'USD',
            imageUrl: p.imageUrl,
            brand: p.brand,
            tenantId: p.tenantId || tenantId,
            featuredType: type,
            featuredTypes: p.featuredTypes || [type],
            hasActivePaymentGateway: p.hasActivePaymentGateway,
            defaultGatewayType: p.defaultGatewayType,
            availability: p.availability,
            categoryName: p.categoryName,
            categorySlug: p.categorySlug,
          }));
        }
      }
    }

    return grouped;
  }, [currentProductId, tenantId, featuredTypes, showAllBuckets, groupedProducts]);

  // Build ordered list of buckets with products
  const bucketsWithProducts = useMemo(() => {
    return Object.entries(productsByType)
      .filter(([, products]) => products.length > 0)
      .map(([type, products]) => {
        const config = featuredTypeConfig[type] || {
          icon: '⭐',
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-700',
          label: type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          description: `More ${type.replace(/_/g, ' ')} products`
        };
        return { type, products, config, count: products.length };
      });
  }, [productsByType]);

  // Sync active tab with URL hash (#featured-<type>) so pills can deep-link to buckets
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#featured-')) {
        const type = hash.replace('#featured-', '');
        const index = bucketsWithProducts.findIndex(b => b.type === type);
        if (index !== -1) {
          setActiveTab(index);
        }
        // Scroll to the stable top-of-section anchor so we never jump past the featured list
        const topAnchor = document.getElementById('featured-products');
        if (topAnchor) {
          topAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [bucketsWithProducts]);

  if (bucketsWithProducts.length === 0) {
    return null;
  }

  const activeTabIndex = activeTab < bucketsWithProducts.length ? activeTab : 0;

  return (
    <div id="featured-products" className="mt-12 border-t border-neutral-200 dark:border-neutral-800 pt-8 scroll-mt-20">
      {/* Section header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
          More from this store
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {bucketsWithProducts.length} featured {bucketsWithProducts.length === 1 ? 'collection' : 'collections'} available
        </p>
      </div>

      {/* Pill navigation bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {bucketsWithProducts.map((bucket, index) => (
          <button
            key={bucket.type}
            onClick={() => setActiveTab(index)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              index === activeTab
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
          >
            <span>{bucket.config.icon}</span>
            {bucket.config.label}
            <span className="text-xs opacity-60">({bucket.count})</span>
          </button>
        ))}
      </div>

      {/* Active bucket content */}
      {bucketsWithProducts.map((bucket, index) => (
        <div key={bucket.type}>
          {index === activeTabIndex && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {bucket.products.map((product) => (
                <SmartProductCard
                  key={product.id}
                  tenantId={product.tenantId}
                  defaultGatewayType={product.defaultGatewayType || undefined}
                  product={{
                    id: product.id,
                    name: product.name,
                    title: product.title,
                    priceCents: product.listPriceCents || product.priceCents || Math.round((product.price || 0) * 100),
                    salePriceCents: product.salePriceCents,
                    listPriceCents: product.listPriceCents,
                    isOnSale: product.isOnSale,
                    discountPercentage: product.discountPercentage,
                    currency: product.currency,
                    imageUrl: product.imageUrl,
                    brand: product.brand,
                    tenantId: product.tenantId,
                    sku: product.sku || '',
                    stock: product.stock,
                  availability: product.availability as 'in_stock' | 'out_of_stock' | 'preorder' | undefined,
                    has_active_payment_gateway: product.hasActivePaymentGateway,
                    payment_gateway_type: product.defaultGatewayType,
                    featuredTypes: product.featuredTypes || (product.featuredType ? [product.featuredType] : (bucket.type ? [bucket.type] : [])),
                    featuredType: product.featuredType || bucket.type || undefined,
                    categoryName: product.categoryName,
                    categorySlug: product.categorySlug,
                  }}
                  variant="grid"
                  showCategory={true}
                  showDescription={true}
                  buttonLayout="stacked"
                  allowedFeaturedTypes={allowedFeaturedTypes}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
