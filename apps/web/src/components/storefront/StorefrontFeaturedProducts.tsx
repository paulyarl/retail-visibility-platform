'use client';

import { useState, useEffect } from 'react';
import { Package, Calendar, DollarSign, Star, Tag, Grid, List } from 'lucide-react';
import Link from 'next/link';
import SmartProductCard from '@/components/products/SmartProductCard';
import { Button } from '@/components/ui/Button';

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
  isFeatured?: boolean;
  featuredTypes?: string[];
  featuredType?: string;
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
    buttonColor: 'bg-amber-600 hover:bg-amber-700',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  new_arrival: {
    title: 'New Arrivals',
    description: 'Fresh products just added to our store',
    icon: <Package className="w-5 h-5" />,
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    buttonColor: 'bg-green-600 hover:bg-green-700',
    badgeColor: 'bg-green-100 text-green-800 border-green-200'
  },
  seasonal: {
    title: 'Seasonal Specials',
    description: 'Perfect for this time of year',
    icon: <Calendar className="w-5 h-5" />,
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    buttonColor: 'bg-orange-600 hover:bg-orange-700',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-200'
  },
  sale: {
    title: 'Sale Items',
    description: 'Great deals on selected products',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    buttonColor: 'bg-red-600 hover:bg-red-700',
    badgeColor: 'bg-red-100 text-red-800 border-red-200'
  },
  staff_pick: {
    title: 'Staff Picks',
    description: 'Hand-picked favorites by our team',
    icon: <Star className="w-5 h-5" />,
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    buttonColor: 'bg-purple-600 hover:bg-purple-700',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200'
  }
};

// Helper function to render featured type badges
function FeaturedTypeBadges({ featuredTypes }: { featuredTypes?: string[] }) {
  if (!featuredTypes || featuredTypes.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {featuredTypes.map((type) => {
        const config = featuredTypeConfig[type as keyof typeof featuredTypeConfig];
        if (!config) return null;
        
        return (
          <span
            key={type}
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${config.badgeColor}`}
          >
            {config.icon}
            <span className="ml-1">{config.title}</span>
          </span>
        );
      })}
    </div>
  );
}

interface FeaturedSectionWithProductsProps {
  tenantId: string;
  type: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  products: FeaturedProduct[];
  loading: boolean;
  maxProducts?: number;
}

function FeaturedSection({ tenantId, type, title, description, icon, color, products, loading, maxProducts = 8 }: FeaturedSectionWithProductsProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const config = featuredTypeConfig[type];
  
  // Filter products by type (already done at parent level, but keep for safety)
  const typeProducts = products.filter(p => p.featuredType === type).slice(0, maxProducts);

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

  if (typeProducts.length === 0) {
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
          <div className="flex items-center space-x-3">
            {/* Grid/List Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="px-3 py-1.5"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="px-3 py-1.5"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Link
              href={`/tenant/${tenantId}?view=grid&featured=${type}&products_only=true`}
              className={`px-4 py-2 rounded-lg text-white font-medium ${config.buttonColor} transition-colors`}
            >
              View All
            </Link>
          </div>
        </div>

        {/* Products Display */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <SmartProductCard
                key={product.id}
                tenantId={tenantId}
                product={{
                  id: product.id,
                  sku: product.sku || product.id,
                  name: product.name,
                  title: product.title,
                  brand: product.brand,
                  description: product.description,
                  priceCents: product.priceCents,
                  stock: product.stock,
                  imageUrl: product.imageUrl,
                  tenantId: tenantId,
                  availability: (product.availability as 'in_stock' | 'out_of_stock' | 'preorder') || 'in_stock',
                  has_active_payment_gateway: product.hasActivePaymentGateway,
                  payment_gateway_type: product.paymentGatewayType,
                  tenantCategory: product.tenantCategory,
                  isFeatured: product.isFeatured,
                  metadata: {
                    featuredTypes: product.featuredTypes
                  }
                }}
                variant="featured"
                showCategory={true}
                showDescription={false}
                className="h-full"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <SmartProductCard
                key={product.id}
                tenantId={tenantId}
                product={{
                  id: product.id,
                  sku: product.sku || product.id,
                  name: product.name,
                  title: product.title,
                  brand: product.brand,
                  description: product.description,
                  priceCents: product.priceCents,
                  stock: product.stock,
                  imageUrl: product.imageUrl,
                  tenantId: tenantId,
                  availability: (product.availability as 'in_stock' | 'out_of_stock' | 'preorder') || 'in_stock',
                  has_active_payment_gateway: product.hasActivePaymentGateway,
                  payment_gateway_type: product.paymentGatewayType,
                  tenantCategory: product.tenantCategory,
                  isFeatured: product.isFeatured,
                  metadata: {
                    featuredTypes: product.featuredTypes
                  }
                }}
                variant="list"
                showCategory={true}
                showDescription={true}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function StorefrontFeaturedProducts({ tenantId }: { tenantId: string }) {
  const [allProducts, setAllProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abortController = new AbortController();
    let isMounted = true;

    const fetchAllProducts = async () => {
      try {
        // Single API call to get all featured products
        const response = await fetch(`/api/storefront/${tenantId}/featured-products?limit=50`, {
          signal: abortController.signal,
        });
        const data = await response.json();
        
        if (response.ok && data.items && isMounted) {
          // Transform the data to match the expected format
          const transformedProducts = data.items.map((product: any) => ({
            id: product.id,
            sku: product.sku,
            name: product.name,
            title: product.title,
            description: product.description,
            price: product.price || 0,
            priceCents: product.priceCents,
            salePriceCents: product.salePriceCents,
            currency: product.currency || 'USD',
            stock: product.stock || 0,
            imageUrl: product.imageUrl,
            brand: product.brand,
            availability: product.availability,
            tenantCategory: product.tenantCategory,
            has_variants: product.hasVariants,
            hasActivePaymentGateway: product.hasActivePaymentGateway || false,
            paymentGatewayType: product.defaultGatewayType || null,
            featuredTypes: product.featuredTypes || [product.featuredType],
            featuredType: product.featuredType,
            isFeatured: true
          }));
          
          setAllProducts(transformedProducts);
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

    fetchAllProducts();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [tenantId]);

  if (loading || allProducts.length === 0) {
    return null;
  }

  // Filter products by type for each section
  const productsByType = {
    new_arrival: allProducts.filter(p => p.featuredType === 'new_arrival'),
    seasonal: allProducts.filter(p => p.featuredType === 'seasonal'),
    sale: allProducts.filter(p => p.featuredType === 'sale'),
    staff_pick: allProducts.filter(p => p.featuredType === 'staff_pick'),
    store_selection: allProducts.filter(p => p.featuredType === 'store_selection')
  };

  return (
    <div className="space-y-0">
      {productsByType.new_arrival.length > 0 && (
        <FeaturedSection
          tenantId={tenantId}
          type="new_arrival"
          {...featuredTypeConfig.new_arrival}
          products={productsByType.new_arrival}
          loading={false}
          maxProducts={8}
        />
      )}
      {productsByType.seasonal.length > 0 && (
        <FeaturedSection
          tenantId={tenantId}
          type="seasonal"
          {...featuredTypeConfig.seasonal}
          products={productsByType.seasonal}
          loading={false}
          maxProducts={8}
        />
      )}
      {productsByType.sale.length > 0 && (
        <FeaturedSection
          tenantId={tenantId}
          type="sale"
          {...featuredTypeConfig.sale}
          products={productsByType.sale}
          loading={false}
          maxProducts={8}
        />
      )}
      {productsByType.staff_pick.length > 0 && (
        <FeaturedSection
          tenantId={tenantId}
          type="staff_pick"
          {...featuredTypeConfig.staff_pick}
          products={productsByType.staff_pick}
          loading={false}
          maxProducts={8}
        />
      )}
      {productsByType.store_selection.length > 0 && (
        <FeaturedSection
          tenantId={tenantId}
          type="store_selection"
          {...featuredTypeConfig.store_selection}
          products={productsByType.store_selection}
          loading={false}
          maxProducts={8}
        />
      )}
    </div>
  );
}
