'use client';

import { useState, useEffect } from 'react';
import { Package, Calendar, DollarSign, Star, Tag } from 'lucide-react';
import Link from 'next/link';

interface FeaturedProduct {
  id: string;
  name: string;
  title: string;
  description: string;
  price: number;
  priceCents: number;
  currency: string;
  stock: number;
  imageUrl?: string;
  categorySlug?: string;
  featuredType: string;
}

interface FeaturedSectionProps {
  tenantId: string;
  type: 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  maxProducts?: number;
}

const featuredTypeConfig = {
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
    fetchFeaturedProducts();
  }, [tenantId, type]);

  const fetchFeaturedProducts = async () => {
    try {
      const response = await fetch(`/api/storefront/${tenantId}/featured-products?type=${type}&limit=${maxProducts}`);
      const data = await response.json();
      
      if (response.ok) {
        setProducts(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching featured products:', error);
    } finally {
      setLoading(false);
    }
  };

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
            href={`/catalog?featured=${type}`}
            className={`px-4 py-2 rounded-lg text-white font-medium ${config.buttonColor} transition-colors`}
          >
            View All
          </Link>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bgColor} ${config.textColor}`}>
                    {config.title.split(' ')[0]}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {product.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {product.description}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">
                    ${product.price.toFixed(2)}
                  </span>
                  {product.stock > 0 ? (
                    <span className="text-xs text-green-600 font-medium">In Stock</span>
                  ) : (
                    <span className="text-xs text-red-600 font-medium">Out of Stock</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function StorefrontFeaturedProducts({ tenantId }: { tenantId: string }) {
  const [activeSections, setActiveSections] = useState<string[]>([]);

  useEffect(() => {
    // Check which featured sections have products
    checkActiveSections();
  }, [tenantId]);

  const checkActiveSections = async () => {
    const types: Array<'new_arrival' | 'seasonal' | 'sale' | 'staff_pick'> = ['new_arrival', 'seasonal', 'sale', 'staff_pick'];
    const active: string[] = [];

    for (const type of types) {
      try {
        const response = await fetch(`/api/storefront/${tenantId}/featured-products?type=${type}&limit=1`);
        const data = await response.json();
        if (response.ok && data.items && data.items.length > 0) {
          active.push(type);
        }
      } catch (error) {
        console.error(`Error checking ${type} products:`, error);
      }
    }

    setActiveSections(active);
  };

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
