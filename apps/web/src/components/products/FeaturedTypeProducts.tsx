'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SmartProductCard from './SmartProductCard';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import { storefrontService } from '@/services/StorefrontService';
import { Package, Calendar, DollarSign, Star } from 'lucide-react';

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
}

interface FeaturedTypeProductsProps {
  currentProductId: string;
  tenantId: string;
  featuredTypes: string[];
}

// Featured type configuration matching TierBasedLandingPage
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
    icon: <Star className="w-5 h-5" />, 
    bgColor: 'bg-purple-50', 
    textColor: 'text-purple-700',
    label: 'Staff Picks', 
    description: 'Hand-picked favorites by our team' 
  },
};

export function FeaturedTypeProducts({ currentProductId, tenantId, featuredTypes }: FeaturedTypeProductsProps) {
  const [productsByType, setProductsByType] = useState<Record<string, FeaturedTypeProduct[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!featuredTypes || featuredTypes.length === 0) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchFeaturedProducts = async () => {
      try {
        // Fetch products for each featured type
        const results = await Promise.all(
          featuredTypes.map(async (type) => {
            try {
              const response = await fetch(`/api/storefront/${tenantId}/featured-products/${type}?limit=6`);
              if (!response.ok) return { type, products: [] };
              
              const json = await response.json();
              // API returns { success: true, data: { products: [...] } }
              const products = json?.data?.products || [];
              // Filter out current product
              const filteredProducts = products.filter(
                (p: FeaturedTypeProduct) => p.id !== currentProductId
              ).slice(0, 4); // Limit to 4 other products
              
              return { type, products: filteredProducts };
            } catch {
              return { type, products: [] };
            }
          })
        );

        if (isMounted) {
          const grouped: Record<string, FeaturedTypeProduct[]> = {};
          results.forEach(({ type, products }) => {
            if (products.length > 0) {
              grouped[type] = products;
            }
          });
          setProductsByType(grouped);
        }
      } catch (error) {
        console.error('Error fetching featured type products:', error);
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
  }, [currentProductId, tenantId, featuredTypes]);

  if (loading || Object.keys(productsByType).length === 0) {
    return null;
  }

  return (
    <>
      {Object.entries(productsByType).map(([type, products]) => {
        const config = featuredTypeConfig[type];
        if (!config || products.length === 0) return null;

        return (
          <div key={type} className="mt-12 border-t border-neutral-200 dark:border-neutral-800 pt-8">
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
                    featuredTypes: product.featuredTypes as ('store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick')[],
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
