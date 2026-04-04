'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SmartProductCard from './SmartProductCard';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import { storefrontSingletonService } from '@/services/StorefrontSingletonService';
import { Package, Calendar, DollarSign, Star, TrendingUp, Award, Zap, Flame, Crown, ThumbsUp, Sparkles } from 'lucide-react';

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
}

// Featured type configuration - supports all featured types in the system
const featuredTypeConfig: Record<string, { icon: React.ReactNode; bgColor: string; textColor: string; label: string; description: string }> = {
  store_selection: { 
    icon: <Star className="w-5 h-5" />, 
    bgColor: 'bg-amber-50', 
    textColor: 'text-amber-700',
    label: 'Featured Products', 
    description: 'Hand-picked favorites from our collection' 
  },
  new_arrival: { 
    icon: <Package className="w-5 h-5" />, 
    bgColor: 'bg-green-50', 
    textColor: 'text-green-700',
    label: 'New Arrivals', 
    description: 'Fresh products just added to our store' 
  },
  seasonal: { 
    icon: <Calendar className="w-5 h-5" />, 
    bgColor: 'bg-orange-50', 
    textColor: 'text-orange-700',
    label: 'Seasonal Specials', 
    description: 'Perfect for this time of year' 
  },
  sale: { 
    icon: <DollarSign className="w-5 h-5" />, 
    bgColor: 'bg-red-50', 
    textColor: 'text-red-700',
    label: 'Sale Items', 
    description: 'Great deals on selected products' 
  },
  staff_pick: { 
    icon: <ThumbsUp className="w-5 h-5" />, 
    bgColor: 'bg-purple-50', 
    textColor: 'text-purple-700',
    label: 'Staff Picks', 
    description: 'Hand-picked favorites by our team' 
  },
  bestseller: { 
    icon: <Award className="w-5 h-5" />, 
    bgColor: 'bg-yellow-50', 
    textColor: 'text-yellow-700',
    label: 'Bestsellers', 
    description: 'Our most popular products' 
  },
  clearance: { 
    icon: <Zap className="w-5 h-5" />, 
    bgColor: 'bg-pink-50', 
    textColor: 'text-pink-700',
    label: 'Clearance', 
    description: 'Last chance to grab these deals' 
  },
  trending: { 
    icon: <TrendingUp className="w-5 h-5" />, 
    bgColor: 'bg-cyan-50', 
    textColor: 'text-cyan-700',
    label: 'Trending', 
    description: 'Hot products everyone is viewing' 
  },
  recommended: { 
    icon: <Sparkles className="w-5 h-5" />, 
    bgColor: 'bg-indigo-50', 
    textColor: 'text-indigo-700',
    label: 'Recommended', 
    description: 'Products we think you\'ll love' 
  },
  featured: { 
    icon: <Flame className="w-5 h-5" />, 
    bgColor: 'bg-rose-50', 
    textColor: 'text-rose-700',
    label: 'Featured', 
    description: 'Spotlight on special products' 
  },
  premium: { 
    icon: <Crown className="w-5 h-5" />, 
    bgColor: 'bg-violet-50', 
    textColor: 'text-violet-700',
    label: 'Premium Selection', 
    description: 'Top-tier products for discerning buyers' 
  },
};

export function FeaturedTypeProducts({ currentProductId, tenantId, featuredTypes, showAllBuckets = true }: FeaturedTypeProductsProps) {
  const [productsByType, setProductsByType] = useState<Record<string, FeaturedTypeProduct[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!featuredTypes || featuredTypes.length === 0) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchFeaturedProducts = async () => {
      /* console.log('[FeaturedTypeProducts] Fetching featured products:', {
        tenantId,
        currentProductId,
        featuredTypes,
        hasTenantId: !!tenantId,
        hasFeaturedTypes: featuredTypes.length > 0
      }) */;
      
      try {
        // Use singleton service to fetch featured products grouped by type
        const groupedProducts = await storefrontSingletonService.getFeaturedProductsByType(
          tenantId,
          undefined, // Get all types
          6 // Limit per type
        );
        // console.log('[FeaturedTypeProducts] API response:', groupedProducts);
        
        // console.log('[FeaturedTypeProducts] API response:', {
        //   groupedProductsKeys: Object.keys(groupedProducts || {}),
        //   groupedProductsCounts: Object.fromEntries(
        //     Object.entries(groupedProducts || {}).map(([k, v]) => [k, v?.length || 0])
        //   )
        // });
        
        if (isMounted) {
          const grouped: Record<string, FeaturedTypeProduct[]> = {};
          
          // Determine which types to process
          // When showAllBuckets is true, show all buckets with products
          // Otherwise, only show types the current product belongs to
          const typesToProcess = showAllBuckets 
            ? Object.keys(groupedProducts || {})
            : featuredTypes;
          
          // Process each featured type
          for (const type of typesToProcess) {
            if (groupedProducts[type] && groupedProducts[type].length > 0) {
              // Filter out current product and limit to 4
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
          
          // console.log('[FeaturedTypeProducts] Final grouped products:', {
          //   types: Object.keys(grouped),
          //   counts: Object.fromEntries(
          //     Object.entries(grouped).map(([k, v]) => [k, v.length])
          //   )
          // });
          
          setProductsByType(grouped);
        }
      } catch (error) {
        console.error('[FeaturedTypeProducts] Error fetching featured type products:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchFeaturedProducts();

    return () => {
      isMounted = false;
    };
  }, [currentProductId, tenantId, featuredTypes, showAllBuckets]);

  if (loading || Object.keys(productsByType).length === 0) {
    return null;
  }

  return (
    <>
      {Object.entries(productsByType).map(([type, products]) => {
        // Get config or use fallback for unknown types
        const config = featuredTypeConfig[type] || {
          icon: <Star className="w-5 h-5" />,
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-700',
          label: type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          description: `More ${type.replace(/_/g, ' ')} products`
        };
        
        if (products.length === 0) return null;

        return (
          <div key={type} id={`featured-${type}`} className="mt-12 border-t border-neutral-200 dark:border-neutral-800 pt-8 scroll-mt-20">
            <div className="flex items-center gap-3 mb-6">
              <span className={`p-2 rounded-lg ${config.bgColor} ${config.textColor}`}>
                {config.icon}
              </span>
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                  More {config.label}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {config.description}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <SmartProductCard
                  key={product.id}
                  tenantId={product.tenantId}
                  hasActivePaymentGateway={product.hasActivePaymentGateway}
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
                    featuredTypes: product.featuredTypes as string[],
                    categoryName: product.categoryName,
                    categorySlug: product.categorySlug,
                  }}
                  variant="grid"
                  showCategory={true}
                  showDescription={true}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
