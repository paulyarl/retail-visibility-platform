'use client';

import { useState, useEffect } from 'react';
import { Search, Package, Tag, Calendar, DollarSign, Star, Plus, X, ArrowUpDown } from 'lucide-react';

interface FeaturedProduct {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  imageUrl?: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  featuredType: string;
  featuredPriority: number;
  featuredAt: string;
}

interface FeaturedType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  maxProducts: number;
}

const featuredTypes: FeaturedType[] = [
  {
    id: 'store_selection',
    name: 'Directory Featured',
    description: 'Best products to attract new customers',
    icon: <Star className="w-4 h-4" />,
    color: 'blue',
    maxProducts: 6
  },
  {
    id: 'new_arrival',
    name: 'New Arrivals',
    description: 'Latest products for your storefront',
    icon: <Package className="w-4 h-4" />,
    color: 'green',
    maxProducts: 12
  },
  {
    id: 'seasonal',
    name: 'Seasonal Items',
    description: 'Seasonal promotions and special items',
    icon: <Calendar className="w-4 h-4" />,
    color: 'orange',
    maxProducts: 8
  },
  {
    id: 'sale',
    name: 'Sale Items',
    description: 'Products on sale or promotion',
    icon: <DollarSign className="w-4 h-4" />,
    color: 'red',
    maxProducts: 10
  },
  {
    id: 'staff_pick',
    name: 'Staff Picks',
    description: 'Hand-picked favorites by your team',
    icon: <Tag className="w-4 h-4" />,
    color: 'purple',
    maxProducts: 8
  }
];

export default function FeaturedProductsManager({ tenantId }: { tenantId: string }) {
  const [selectedType, setSelectedType] = useState<string>('store_selection');
  const [featuredProducts, setFeaturedProducts] = useState<Record<string, FeaturedProduct[]>>({});
  const [availableProducts, setAvailableProducts] = useState<FeaturedProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isManaging, setIsManaging] = useState(false);

  const currentType = featuredTypes.find(t => t.id === selectedType)!;
  const currentFeatured = featuredProducts[selectedType] || [];

  useEffect(() => {
    fetchFeaturedProducts();
  }, [tenantId]);

  useEffect(() => {
    if (selectedType) {
      fetchAvailableProducts();
    }
  }, [tenantId, selectedType, searchTerm]);

  const fetchFeaturedProducts = async () => {
    try {
      const response = await fetch(`/api/tenants/${tenantId}/featured`);
      const data = await response.json();
      if (data.success) {
        setFeaturedProducts(data.data.grouped);
      }
    } catch (error) {
      console.error('Error fetching featured products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableProducts = async () => {
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/available-featured?type=${selectedType}&search=${searchTerm}`
      );
      const data = await response.json();
      if (data.success) {
        setAvailableProducts(data.data);
      }
    } catch (error) {
      console.error('Error fetching available products:', error);
    }
  };

  const handleSaveFeatured = async () => {
    setIsManaging(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/featured/${selectedType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: selectedProducts,
          priorities: selectedProducts.map((_, index) => selectedProducts.length - index)
        })
      });

      const data = await response.json();
      if (data.success) {
        await fetchFeaturedProducts();
        setSelectedProducts([]);
        setIsManaging(false);
      }
    } catch (error) {
      console.error('Error saving featured products:', error);
      setIsManaging(false);
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const removeFeaturedProduct = async (productId: string) => {
    try {
      const response = await fetch(`/api/tenants/${tenantId}/featured/${selectedType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: currentFeatured.filter(p => p.id !== productId).map(p => p.id),
          priorities: currentFeatured.filter(p => p.id !== productId).map((_, index) => currentFeatured.length - index - 1)
        })
      });

      if (response.ok) {
        await fetchFeaturedProducts();
      }
    } catch (error) {
      console.error('Error removing featured product:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Type Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Featured Products Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredTypes.map(type => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedType === type.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg bg-${type.color}-100 text-${type.color}-600`}>
                  {type.icon}
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">{type.name}</h3>
                  <p className="text-sm text-gray-500">{type.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {featuredProducts[type.id]?.length || 0} / {type.maxProducts} products
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Current Featured Products */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Current {currentType.name}
          </h3>
          <span className="text-sm text-gray-500">
            {currentFeatured.length} / {currentType.maxProducts}
          </span>
        </div>

        {currentFeatured.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentFeatured.map(product => (
              <div key={product.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <h4 className="font-medium text-gray-900">{product.name}</h4>
                      <p className="text-sm text-gray-500">{product.sku}</p>
                      <p className="text-sm font-medium text-gray-900">
                        ${(product.priceCents / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFeaturedProduct(product.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No {currentType.name.toLowerCase()} yet. Add some below!
          </div>
        )}
      </div>

      {/* Add New Featured Products */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Add to {currentType.name}
          </h3>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSaveFeatured}
              disabled={selectedProducts.length === 0 || isManaging}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isManaging ? 'Saving...' : `Add ${selectedProducts.length} Products`}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableProducts.map(product => (
            <div
              key={product.id}
              onClick={() => toggleProductSelection(product.id)}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedProducts.includes(product.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={selectedProducts.includes(product.id)}
                  onChange={() => {}}
                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{product.name}</h4>
                  <p className="text-sm text-gray-500">{product.sku}</p>
                  <p className="text-sm font-medium text-gray-900">
                    ${(product.priceCents / 100).toFixed(2)}
                  </p>
                  {product.category && (
                    <p className="text-xs text-gray-400">{product.category.name}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {availableProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? 'No products found matching your search.' : 'No available products.'}
          </div>
        )}
      </div>
    </div>
  );
}
