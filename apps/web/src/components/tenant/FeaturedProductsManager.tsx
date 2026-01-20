'use client';

import { useState, useEffect } from 'react';
import { Search, Package, Tag, Calendar, DollarSign, Star, Plus, X, ArrowUpDown, Eye, Sparkles, TrendingUp, Check, ArrowUp, ArrowDown, Clock, Zap, Award, ShoppingBag, AlertTriangle, Timer } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import Image from 'next/image';

// Helper functions for featured type badges
const getFeaturedBadgeStyle = (typeId: string): string => {
  switch (typeId) {
    case 'store_selection':
      return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
    case 'new_arrival':
      return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
    case 'seasonal':
      return 'bg-gradient-to-r from-orange-500 to-red-500 text-white';
    case 'sale':
      return 'bg-gradient-to-r from-red-500 to-pink-500 text-white';
    case 'staff_pick':
      return 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white';
    default:
      return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
  }
};

const getFeaturedBadgeIcon = (typeId: string) => {
  switch (typeId) {
    case 'store_selection':
      return <Star className="w-3 h-3 fill-white" />;
    case 'new_arrival':
      return <Sparkles className="w-3 h-3 fill-white" />;
    case 'seasonal':
      return <Calendar className="w-3 h-3 fill-white" />;
    case 'sale':
      return <Tag className="w-3 h-3 fill-white" />;
    case 'staff_pick':
      return <Award className="w-3 h-3 fill-white" />;
    default:
      return <Star className="w-3 h-3 fill-white" />;
  }
};

const getFeaturedBadgeText = (typeId: string): string => {
  switch (typeId) {
    case 'store_selection':
      return 'DIRECTORY';
    case 'new_arrival':
      return 'NEW';
    case 'seasonal':
      return 'SEASONAL';
    case 'sale':
      return 'SALE';
    case 'staff_pick':
      return 'STAFF PICK';
    default:
      return 'FEATURED';
  }
};

const getFeaturedBorderColor = (typeId: string): string => {
  switch (typeId) {
    case 'store_selection':
      return 'border-blue-200';
    case 'new_arrival':
      return 'border-green-200';
    case 'seasonal':
      return 'border-orange-200';
    case 'sale':
      return 'border-red-200';
    case 'staff_pick':
      return 'border-purple-200';
    default:
      return 'border-amber-200';
  }
};

// Expiration helper functions
const getExpirationStatus = (product: FeaturedProduct): {
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number;
  statusColor: string;
  statusText: string;
} => {
  if (!product.featured_expires_at) {
    return {
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: -1,
      statusColor: 'text-gray-500',
      statusText: 'No expiration'
    };
  }

  const now = new Date();
  const expiresAt = new Date(product.featured_expires_at);
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  const isExpired = daysRemaining < 0;
  const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 3;

  let statusColor = 'text-green-600';
  let statusText = `${daysRemaining} days`;

  if (isExpired) {
    statusColor = 'text-red-600';
    statusText = 'Expired';
  } else if (isExpiringSoon) {
    statusColor = 'text-amber-600';
    statusText = daysRemaining === 0 ? 'Expires today' : `${daysRemaining} days`;
  }

  return {
    isExpired,
    isExpiringSoon,
    daysRemaining,
    statusColor,
    statusText
  };
};

const getExpirationIcon = (product: FeaturedProduct) => {
  const { isExpired, isExpiringSoon } = getExpirationStatus(product);
  
  if (isExpired) {
    return <AlertTriangle className="w-3 h-3" />;
  } else if (isExpiringSoon) {
    return <Timer className="w-3 h-3" />;
  } else {
    return <Clock className="w-3 h-3" />;
  }
};

interface FeaturedProduct {
  id: string;
  name: string;
  title?: string;
  sku: string;
  price_cents: number;
  price?: string;
  image_url?: string;
  brand?: string;
  category_path?: string[];
  featured_type: string;
  featured_priority: number;
  featured_at?: string;
  featured_expires_at?: string;
  days_until_expiration?: number;
  auto_unfeature?: boolean;
  is_featured: boolean;
  stock?: number;
  availability?: string;
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
  const [processing, setProcessing] = useState(false);

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
      // Use our new multi-type featured products API
      const response = await apiRequest(`/api/tenants/${tenantId}/featured-products/storefront`);
      const data = await response.json();
      console.log('Featured products API response:', data);
      
      if (data && typeof data === 'object') {
        // The new API returns grouped data by featured type
        setFeaturedProducts(data);
      } else {
        // Fallback empty state
        setFeaturedProducts({
          'store_selection': [],
          'new_arrival': [],
          'seasonal': [],
          'sale': [],
          'staff_pick': []
        });
      }
    } catch (error) {
      console.error('Error fetching featured products:', error);
      // Fallback empty state
      setFeaturedProducts({
        'store_selection': [],
        'new_arrival': [],
        'seasonal': [],
        'sale': [],
        'staff_pick': []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableProducts = async () => {
    try {
      // Use our new items API to get products that aren't already featured for this type
      const response = await apiRequest(`/api/items?tenant_id=${tenantId}&limit=50${searchTerm ? `&search=${searchTerm}` : ''}`);
      const data = await response.json();
      console.log('Available products API response:', data);
      
      if (data && data.items) {
        // Filter out products that are already featured for this type
        const availableItems = data.items.filter((item: any) => {
          // Check if this item is already featured for the selected type
          const isAlreadyFeatured = item.featuredTypes && item.featuredTypes.includes(selectedType);
          return !isAlreadyFeatured;
        });
        
        // Transform to the expected format
        const transformedItems = availableItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          price_cents: Math.round((item.price || 0) * 100), // Convert price to cents
          price: item.price,
          image_url: item.imageUrl,
          brand: item.brand,
          category_path: item.categoryPath || [],
          featured_type: 'none',
          featured_priority: 0,
          featured_at: undefined,
          is_featured: false,
          stock: item.stock,
          availability: item.availability
        }));
        
        setAvailableProducts(transformedItems);
      } else {
        setAvailableProducts([]);
      }
    } catch (error) {
      console.error('Error fetching available products:', error);
      setAvailableProducts([]);
    }
  };

  const handleFeature = async (productId: string) => {
    if (currentFeatured.length >= currentType.maxProducts) {
      alert(`You've reached your featuring limit (${currentType.maxProducts} products for ${currentType.name})`);
      return;
    }

    setProcessing(true);
    try {
      // Use our new multi-type featured products API
      const response = await apiRequest(`/api/items/${productId}/featured-types`, {
        method: 'POST',
        body: JSON.stringify({
          featured_type: selectedType,
          featured_priority: 50,
          auto_unfeature: true
        })
      });

      if (response.ok) {
        await fetchFeaturedProducts();
        await fetchAvailableProducts(); // Refresh available products
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to feature product');
      }
    } catch (error) {
      console.error('Error featuring product:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleUnfeature = async (productId: string) => {
    setProcessing(true);
    try {
      // Use our new multi-type featured products API
      const response = await apiRequest(`/api/items/${productId}/featured-types/${selectedType}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchFeaturedProducts();
        await fetchAvailableProducts(); // Refresh available products
      } else {
        alert('Failed to unfeature product');
      }
    } catch (error) {
      console.error('Error unfeaturing product:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdatePriority = async (productId: string, newPriority: number) => {
    setProcessing(true);
    try {
      // For now, we'll skip priority updates as our new API doesn't support it yet
      // In a future enhancement, we could add a PUT endpoint for updating priority
      console.log('Priority updates not yet implemented in multi-type system');
      
      // Alternative: Remove and re-add with new priority
      await apiRequest(`/api/items/${productId}/featured-types/${selectedType}`, {
        method: 'DELETE'
      });
      
      await apiRequest(`/api/items/${productId}/featured-types`, {
        method: 'POST',
        body: JSON.stringify({
          featured_type: selectedType,
          featured_priority: newPriority,
          auto_unfeature: true
        })
      });

      await fetchFeaturedProducts();
    } catch (error) {
      console.error('Error updating priority:', error);
      alert('Failed to update priority');
    } finally {
      setProcessing(false);
    }
  };

  const filteredAvailable = availableProducts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading featured products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-amber-500" />
          Featured Products Management
        </h1>
        <p className="mt-2 text-gray-600">
          Manage featured products for directory and storefront displays
        </p>
      </div>

      {/* Type Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Featured Type</h2>
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

      {/* Status Card */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-100 border-2 border-amber-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-600" />
              {currentType.name} Status
            </h3>
            <p className="mt-1 text-gray-700">
              Using <span className="font-semibold">{currentFeatured.length}</span> of{' '}
              <span className="font-semibold">{currentType.maxProducts}</span> featured slots
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Type: <span className="font-semibold">{currentType.name}</span>
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-amber-600">
              {currentType.maxProducts - currentFeatured.length}
            </div>
            <div className="text-sm text-gray-600">slots available</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                currentFeatured.length >= currentType.maxProducts
                  ? 'bg-red-500'
                  : currentFeatured.length / currentType.maxProducts > 0.8
                  ? 'bg-amber-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min((currentFeatured.length / currentType.maxProducts) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        {currentFeatured.length >= currentType.maxProducts && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">
              ⚠️ You've reached your featuring limit. Remove some products to feature more.
            </p>
          </div>
        )}
      </div>

      {/* Current Featured Products */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
          Currently Featured {currentType.name} ({currentFeatured.length})
        </h2>

        {currentFeatured.length === 0 ? (
          <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No {currentType.name} Yet</h3>
            <p className="text-gray-600">
              Add products to {currentType.name.toLowerCase()} to give them prominent display styling
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentFeatured.map((product) => (
              <div key={product.id} className={`bg-white rounded-lg border-2 p-4 relative ${getFeaturedBorderColor(currentType.id)}`}>
                {/* Featured Badge */}
                <div className="absolute top-2 left-2 z-10">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full ${getFeaturedBadgeStyle(currentType.id)}`}>
                    {getFeaturedBadgeIcon(currentType.id)}
                    {getFeaturedBadgeText(currentType.id)}
                  </span>
                </div>

                {/* Product Image */}
                <div className="relative h-48 bg-gray-100 rounded-lg mb-4">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className="object-cover rounded-lg"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <Eye className="w-12 h-12" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="mb-4">
                  {product.category_path && product.category_path.length > 0 && (
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{product.category_path[0]}</p>
                  )}
                  <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                    {product.name}
                  </h3>
                  <p className="text-lg font-bold text-gray-900">
                    ${(product.price_cents ? (product.price_cents / 100).toFixed(2) : '0.00')}
                  </p>
                  <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                </div>

                {/* Priority Controls */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-gray-600">Priority:</span>
                  <button
                    onClick={() => handleUpdatePriority(product.id, Math.min(product.featured_priority + 10, 100))}
                    disabled={processing}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                    title="Increase priority"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-gray-900">{product.featured_priority}</span>
                  <button
                    onClick={() => handleUpdatePriority(product.id, Math.max(product.featured_priority - 10, 0))}
                    disabled={processing}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                    title="Decrease priority"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Unfeature Button */}
                <button
                  onClick={() => handleUnfeature(product.id)}
                  disabled={processing}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {processing ? 'Processing...' : 'Remove from Featured'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Products */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Add Products to {currentType.name}
        </h2>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAvailable.slice(0, 12).map((product) => (
            <div key={product.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex gap-3">
                {/* Thumbnail */}
                <div className="relative w-16 h-16 bg-gray-100 rounded flex-shrink-0">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className="object-cover rounded"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <Eye className="w-6 h-6" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-gray-900 truncate">
                    {product.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    ${(product.price_cents ? (product.price_cents / 100).toFixed(2) : '0.00')}
                  </p>
                  <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                  {product.category_path && product.category_path.length > 0 && (
                    <p className="text-xs text-gray-400">{product.category_path[0]}</p>
                  )}
                </div>
              </div>

              {/* Feature Button */}
              <button
                onClick={() => handleFeature(product.id)}
                disabled={processing || currentFeatured.length >= currentType.maxProducts}
                className="w-full mt-3 px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Star className="w-4 h-4" />
                {processing ? 'Processing...' : 'Feature This Product'}
              </button>
            </div>
          ))}
        </div>

        {filteredAvailable.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchTerm ? 'No products found matching your search.' : 'No available products.'}
          </div>
        )}
      </div>

      {/* Benefits Section */}
      <div className="mt-12 bg-gray-50 rounded-lg p-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          Why Feature Products?
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Stand Out</h4>
              <p className="text-gray-600 text-sm">Featured badge and gradient styling make products impossible to miss</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Boost Sales</h4>
              <p className="text-gray-600 text-sm">Featured products get 3x more clicks and 2x higher conversion rates</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Premium Display</h4>
              <p className="text-gray-600 text-sm">Larger images, enhanced typography, and prominent call-to-action buttons</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Check className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Easy Management</h4>
              <p className="text-gray-600 text-sm">Feature and unfeature products instantly, adjust priorities with one click</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
