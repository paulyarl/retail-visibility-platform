'use client';

import { useState, useEffect } from 'react';
import { Package, Calendar, DollarSign, Star, Tag } from 'lucide-react';
import Link from 'next/link';
import SmartProductCard from '@/components/products/SmartProductCard';

interface FeaturedProduct {
  id: string;
  sku?: string;
  name: string;
  title?: string;
  description?: string;
  price: number;
  priceCents: number;
  salePriceCents?: number;
  currency: string;
  stock: number;
  imageUrl?: string;
  brand?: string;
  availability?: string;
  tenantCategory?: any;
  has_variants?: boolean;
  hasActivePaymentGateway?: boolean;
  paymentGatewayType?: string;
}

interface FeaturedSectionProps {
  tenantId: string;
  type: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  maxProducts?: number;
}

const featuredTypeConfig = {
  store_selection: {
    title: 'Featured Products',
    description: 'Hand-picked favorites from our collection',
    icon: <Star className="w-5 h-5" />,
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    buttonColor: 'bg-amber-600 hover:bg-amber-700'
  },
  new_arrival: {
    title: 'New Arrivals',
    description: 'Fresh products just added to our store',
    icon: <Package className="w-5 h-5" />,
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    buttonColor: 'bg-green-600 hover:bg-green-700'
  },
  seasonal: {
    title: 'Seasonal Specials',
    description: 'Perfect for this time of year',
    icon: <Calendar className="w-5 h-5" />,
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    buttonColor: 'bg-orange-600 hover:bg-orange-700'
  },
  sale: {
    title: 'Sale Items',
    description: 'Great deals on selected products',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    buttonColor: 'bg-red-600 hover:bg-red-700'
  },
  staff_pick: {
    title: 'Staff Picks',
    description: 'Hand-picked favorites by our team',
    icon: <Star className="w-5 h-5" />,
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    buttonColor: 'bg-purple-600 hover:bg-purple-700'
  }
};

function FeaturedSection({ tenantId, type, title, description, icon, color, maxProducts = 8 }: FeaturedSectionProps) {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const config = featuredTypeConfig[type];

  useEffect(() => {
    let abortController = new AbortController();
    let isMounted = true;

    const fetchFeaturedProducts = async () => {
      try {
        // Use the public storefront featured products API (no auth required)
        const response = await fetch(`/api/storefront/${tenantId}/featured-products?limit=${maxProducts}`, {
          signal: abortController.signal,
        });
        const data = await response.json();
        
        if (response.ok && isMounted) {
          // The API returns items array, filter by featured type
          const typeProducts = data.items?.filter((product: any) => product.featuredType === type) || [];
          console.log(`FeaturedSection ${type}: Found ${typeProducts.length} products`);
          
          // Transform the data to match the expected format
          const transformedProducts = typeProducts.map((product: any) => ({
            id: product.id,
            sku: product.sku,
            name: product.name,
            title: product.title,
            description: product.description,
            price: product.price || 0,
            priceCents: product.priceCents,
            salePriceCents: product.salePriceCents,
            currency: 'USD',
            stock: product.stock || 0,
            imageUrl: product.imageUrl,
            brand: product.brand,
            availability: product.availability,
            tenantCategory: product.tenantCategory,
            has_variants: product.has_variants,
            hasActivePaymentGateway: false,
            paymentGatewayType: null,
            // Add multi-type support
            featuredTypes: [type], // This product is featured for this type
            featuredType: type, // Backward compatibility
            isFeatured: true
          }));
          
          setProducts(transformedProducts);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError' && isMounted) {
          console.error('Error fetching featured products:', error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchFeaturedProducts();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [tenantId, type]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="flex items-center space-x-3 mb-6">
          <div className={`w-10 h-10 rounded-lg ${config.bgColor}`}></div>
          <div>
            <div className="h-6 bg-gray-200 rounded w-32 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-48"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-48"></div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null; // Don't show empty sections
  }

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-lg ${config.bgColor} ${config.textColor}`}>
              {icon}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
              <p className="text-gray-600 mt-1">{description}</p>
            </div>
          </div>
          <Link
            href={`/tenant/${tenantId}?view=grid&featured=${type}&products_only=true`}
            className={`px-4 py-2 rounded-lg text-white font-medium ${config.buttonColor} transition-colors`}
          >
            View All
          </Link>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <SmartProductCard
              key={product.id}
              product={{
                id: product.id,
                sku: product.sku || product.id,
                name: product.name,
                title: product.title || product.name,
                brand: product.brand || '',
                description: product.description || '',
                priceCents: product.priceCents,
                salePriceCents: product.salePriceCents,
                stock: product.stock || 0,
                imageUrl: product.imageUrl,
                tenantId: tenantId,
                availability: (product.availability as any) || 'in_stock',
                tenantCategory: product.tenantCategory,
                has_variants: product.has_variants || false,
                has_active_payment_gateway: product.hasActivePaymentGateway,
                payment_gateway_type: product.paymentGatewayType,
                featuredType: type, // Pass the featured type
              }}
              variant="featured"
              showCategory={true}
              showDescription={true}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function StorefrontFeaturedProducts({ tenantId }: { tenantId: string }) {
  const [activeSections, setActiveSections] = useState<string[]>([]);

  useEffect(() => {
    let abortController = new AbortController();
    let isMounted = true;

    const checkActiveSections = async () => {
      try {
        // Single API call to get all featured products
        const response = await fetch(`/api/storefront/${tenantId}/featured-products?limit=50`, {
          signal: abortController.signal,
        });
        const data = await response.json();
        
        if (response.ok && data.items && isMounted) {
          // Debug: Log what types we have
          console.log('Featured products data:', data.items.map((item: any) => item.featuredType));
          
          // Check which types have products (include store_selection)
          const types: Array<'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick'> = ['store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick'];
          const active: string[] = [];
          
          for (const type of types) {
            const hasProducts = data.items.some((product: any) => product.featuredType === type);
            console.log(`Type ${type}: ${hasProducts ? 'HAS' : 'NO'} products`);
            if (hasProducts) {
              active.push(type);
            }
          }
          
          console.log('Active sections:', active);
          setActiveSections(active);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError' && isMounted) {
          console.error('Error checking active sections:', error);
        }
      }
    };

    checkActiveSections();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [tenantId]);

  if (activeSections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0">
      {activeSections.includes('new_arrival') && (
        <FeaturedSection
          tenantId={tenantId}
          type="new_arrival"
          {...featuredTypeConfig.new_arrival}
          maxProducts={8}
        />
      )}
      {activeSections.includes('seasonal') && (
        <FeaturedSection
          tenantId={tenantId}
          type="seasonal"
          {...featuredTypeConfig.seasonal}
          maxProducts={8}
        />
      )}
      {activeSections.includes('sale') && (
        <FeaturedSection
          tenantId={tenantId}
          type="sale"
          {...featuredTypeConfig.sale}
          maxProducts={8}
        />
      )}
      {activeSections.includes('staff_pick') && (
        <FeaturedSection
          tenantId={tenantId}
          type="staff_pick"
          {...featuredTypeConfig.staff_pick}
          maxProducts={8}
        />
      )}
    </div>
  );
}
