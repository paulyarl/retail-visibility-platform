"use client";

import { useState, useEffect } from 'react';
import { featuredProductsSingleton } from '@/providers/data/FeaturedProductsSingleton';
import { FeaturedProduct } from '@/providers/data/FeaturedProductsSingleton';
import { PublicProduct } from '@/providers/data/ProductSingleton';
import { UniversalProductCard } from '@/components/products/UniversalProductCard';
import { useProduct } from '@/providers/ProductProvider';

interface FeaturedProductsSectionProps {
  tenantId: string;
  maxProducts?: number;
  showType?: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
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
  const [featuredData, setFeaturedData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get ProductSingleton for universal product data
  const productSingleton = useProduct();

  useEffect(() => {
    const loadFeaturedProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Integrate ProductSingleton with FeaturedProductsSingleton
        featuredProductsSingleton.setProductSingleton(productSingleton);
        
        // Get featured products in universal format
        let products: PublicProduct[] = [];
        if (showType) {
          products = await featuredProductsSingleton.getFeaturedProductsAsUniversal(tenantId, showType, maxProducts);
        } else {
          // Get all featured products
          const allFeatured = await featuredProductsSingleton.getAllFeaturedProducts(tenantId, maxProducts);
          products = allFeatured.buckets.flatMap(bucket => bucket.products)
            .slice(0, maxProducts)
            .map(product => ({
              id: product.id,
              tenantId: product.tenantId,
              sku: product.sku,
              name: product.name,
              description: product.description,
              brand: product.brand,
              priceCents: product.priceCents,
              salePriceCents: product.salePriceCents || undefined,
              stock: product.stock,
              imageUrl: product.imageUrl,
              availability: product.availability as 'in_stock' | 'out_of_stock' | 'preorder' | 'discontinued',
              hasVariants: product.hasVariants,
              featuredType: product.featuredType,
              featuredPriority: product.featuredPriority,
              featuredAt: product.featuredAt,
              featuredExpiresAt: product.featuredExpiresAt,
              metadata: product.metadata,
              hasGallery: product.hasGallery,
              hasDescription: product.hasDescription,
              hasBrand: product.hasBrand,
              hasPrice: product.hasPrice
            }));
        }
        
        setFeaturedData({ products, totalCount: products.length });
      } catch (err) {
        console.error('Failed to load featured products:', err);
        setError(err instanceof Error ? err.message : 'Failed to load featured products');
      } finally {
        setLoading(false);
      }
    };

    if (tenantId) {
      loadFeaturedProducts();
    }
  }, [tenantId, showType, maxProducts, productSingleton]);

  // Don't show anything if loading, error, or no featured products
  if (loading || error || !featuredData || featuredData.totalCount === 0) {
    return null;
  }

  // Get featured badge configuration
  const getFeaturedBadge = (featuredType: string) => {
    const config = {
      store_selection: {
        text: 'Featured',
        icon: '⭐',
        gradient: 'from-blue-500 to-cyan-500'
      },
      new_arrival: {
        text: 'New',
        icon: '✨',
        gradient: 'from-green-500 to-emerald-500'
      },
      seasonal: {
        text: 'Seasonal',
        icon: '🗓️',
        gradient: 'from-orange-500 to-red-500'
      },
      sale: {
        text: 'Sale',
        icon: '🏷️',
        gradient: 'from-red-500 to-pink-500'
      },
      staff_pick: {
        text: 'Staff Pick',
        icon: '👥',
        gradient: 'from-purple-500 to-indigo-500'
      }
    };
    
    return config[featuredType as keyof typeof config] || config.store_selection;
  };

  const sectionTitle = title || getFeaturedBadge(showType || 'store_selection').text + ' Products';

  return (
    <div className="featured-products-section mb-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${getFeaturedBadge(showType || 'store_selection').gradient} flex items-center justify-center text-white`}>
            <span className="text-lg">{getFeaturedBadge(showType || 'store_selection').icon}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{sectionTitle}</h2>
            <p className="text-gray-600">
              {featuredData.totalCount} {featuredData.totalCount === 1 ? 'product' : 'products'}
            </p>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {featuredData.products.map((product: PublicProduct) => (
          <UniversalProductCard
            key={product.id}
            productId={product.id}
            tenantId={product.tenantId}
          />
        ))}
      </div>

      {/* View More Link */}
      {featuredData.totalCount >= maxProducts && (
        <div className="text-center">
          <a
            href={`/t/${tenantId}/featured/${showType || 'all'}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-colors"
          >
            View All {getFeaturedBadge(showType || 'store_selection').text}
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
