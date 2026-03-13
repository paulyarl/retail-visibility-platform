"use client";

import { useState, useEffect, useMemo } from 'react';
import { useProduct } from '@/providers/ProductProvider';
import { UniversalProductCard } from '@/components/products/UniversalProductCard';
import { Star, Sparkles, Calendar, Tag, Award } from 'lucide-react';
import { storefrontService } from '@/services/StorefrontService';

// Featured type configuration (matches producer)
const featuredTypeConfig = {
  store_selection: {
    name: 'Featured',
    icon: <Star className="w-4 h-4" />,
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500'
  },
  new_arrival: {
    name: 'New Arrivals',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'green',
    gradient: 'from-green-500 to-emerald-500'
  },
  seasonal: {
    name: 'Seasonal',
    icon: <Calendar className="w-4 h-4" />,
    color: 'orange',
    gradient: 'from-orange-500 to-red-500'
  },
  sale: {
    name: 'Sale',
    icon: <Tag className="w-4 h-4" />,
    color: 'red',
    gradient: 'from-red-500 to-pink-500'
  },
  staff_pick: {
    name: 'Staff Picks',
    icon: <Award className="w-4 h-4" />,
    color: 'purple',
    gradient: 'from-purple-500 to-indigo-500'
  }
};

interface FeaturedProductsSectionProps {
  tenantId: string;
  maxProducts?: number;
  showType?: string;
  title?: string;
}

/**
 * Featured Products Section for Storefront
 * 
 * Displays featured products using the universal product middleware.
 * Integrates with ProductSingleton for consistent product data.
 * Only shows when there are featured products available.
 */
export default function FeaturedProductsSection({ 
  tenantId, 
  maxProducts = 8,
  showType,
  title 
}: FeaturedProductsSectionProps) {
  // Get ProductSingleton for universal product data
  const productSingleton = useProduct();

  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);

  useEffect(() => {
    const loadFeaturedProducts = async () => {
      try {
        // Use StorefrontService instead of direct fetch
        const response = await storefrontService.getFeaturedProducts(tenantId, {
          limit: maxProducts,
          search: undefined // Could add search support later
        });

        // Filter by featured type if specified
        let filteredProducts = response.items;
        if (showType) {
          filteredProducts = response.items.filter(product =>
            product.featuredTypes?.includes(showType)
          );
        }

        setFeaturedProducts(filteredProducts);
      } catch (err) {
        console.error('Failed to load featured products:', err);
        setFeaturedProducts([]);
      }
    };

    if (tenantId) {
      loadFeaturedProducts();
    }
  }, [tenantId, showType, maxProducts]);

  // Filter active and in-stock products
  const displayProducts = useMemo(() => {
    if (!featuredProducts.length) return [];
    return featuredProducts.filter((product: any) => 
      product.is_active !== false && 
      product.availability !== 'discontinued'
    );
  }, [featuredProducts]);

  const config = featuredTypeConfig[showType as keyof typeof featuredTypeConfig] || featuredTypeConfig.store_selection;
  const sectionTitle = title || config.name;

  if (!displayProducts.length) {
    return null; // Don't show empty sections
  }

  return (
    <div className="featured-products-section mb-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${config.gradient} flex items-center justify-center text-white`}>
            <span className="text-lg">{config.icon}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{sectionTitle}</h2>
            <p className="text-gray-600">
              {displayProducts.length} {displayProducts.length === 1 ? 'product' : 'products'}
            </p>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {displayProducts.map((product: any) => (
          <UniversalProductCard
            key={product.id}
            productId={product.id}
            tenantId={product.tenantId}
          />
        ))}
      </div>

      {/* View More Link */}
      {displayProducts.length >= maxProducts && (
        <div className="text-center">
          <a
            href={`/t/${tenantId}/featured/${showType || 'all'}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-colors"
          >
            View All {config.name}
            <span className="text-lg">→</span>
          </a>
        </div>
      )}
    </div>
  );
}

// Multi-type featured products showcase
export function FeaturedProductsShowcase({ tenantId }: { tenantId: string }) {
  return (
    <div className="space-y-12">
      {/* Primary Featured Products */}
      <FeaturedProductsSection
        tenantId={tenantId}
        showType="store_selection"
        maxProducts={8}
        title="Featured Products"
      />

      {/* New Arrivals */}
      <FeaturedProductsSection
        tenantId={tenantId}
        showType="new_arrival"
        maxProducts={4}
        title="Just In"
      />

      {/* Seasonal Favorites */}
      <FeaturedProductsSection
        tenantId={tenantId}
        showType="seasonal"
        maxProducts={4}
        title="Seasonal Collection"
      />

      {/* Staff Picks */}
      <FeaturedProductsSection
        tenantId={tenantId}
        showType="staff_pick"
        maxProducts={4}
        title="Our Favorites"
      />
    </div>
  );
}

// Helper function to get featured type label
function getFeaturedTypeLabel(featuredType: string): string {
  switch (featuredType) {
    case 'staff_pick':
      return 'Staff Pick';
    case 'seasonal':
      return 'Seasonal';
    case 'sale':
      return 'Sale';
    case 'new_arrival':
      return 'New';
    case 'store_selection':
      return 'Featured';
    default:
      return 'Featured';
  }
}
