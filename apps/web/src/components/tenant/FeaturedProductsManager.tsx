'use client';

import { useState, useEffect } from 'react';
import { Search, Star, Sparkles, Eye, ArrowUp, ArrowDown, AlertTriangle, Timer, Clock, Layers, Package, AlertCircle, Calendar, Tag, Award, DollarSign, TrendingUp, Check, ShoppingBag, Download, FileText, Edit2, X, Power, Pause, Play } from 'lucide-react';
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

const getFeaturedBadgeText = (typeId: string, currentTypeName?: string): string => {
  // Use the current type name if available, otherwise fall back to static mapping
  if (currentTypeName && currentTypeName !== 'Directory Featured') {
    switch (typeId) {
      case 'store_selection':
        return currentTypeName;
      case 'new_arrival':
        return currentTypeName;
      case 'seasonal':
        return currentTypeName;
      case 'sale':
        return currentTypeName;
      case 'staff_pick':
        return currentTypeName;
      default:
        return currentTypeName || 'FEATURED';
    }
  }
  
  // Fallback to static mapping
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

// Product type icon helper function
const getProductTypeIcon = (productType?: string) => {
  switch (productType?.toLowerCase()) {
    case 'physical':
      return <ShoppingBag className="w-3 h-3" />;
    case 'digital':
      return <Download className="w-3 h-3" />;
    case 'service':
      return <FileText className="w-3 h-3" />;
    default:
      return <Package className="w-3 h-3" />; // Default to package for unknown/common
  }
};

// Stock status helper function
const getStockStatus = (product: FeaturedProduct) => {
  const stock = product.stock;
  const availability = product.availability;
  
  if (availability === 'discontinued') {
    return (
      <div className="flex items-center gap-1 text-xs text-red-600">
        <AlertCircle className="w-3 h-3" />
        <span>Discontinued</span>
      </div>
    );
  }
  
  if (availability === 'out_of_stock' || stock === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-red-600">
        <AlertCircle className="w-3 h-3" />
        <span>Out of stock</span>
      </div>
    );
  }
  
  if (availability === 'limited' || (stock && stock <= 5)) {
    return (
      <div className="flex items-center gap-1 text-xs text-amber-600">
        <AlertCircle className="w-3 h-3" />
        <span>Low stock ({stock || 'Limited'})</span>
      </div>
    );
  }
  
  if (availability === 'pre_order') {
    return (
      <div className="flex items-center gap-1 text-xs text-blue-600">
        <Package className="w-3 h-3" />
        <span>Pre-order</span>
      </div>
    );
  }
  
  if (stock && stock > 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-green-600">
        <Check className="w-3 h-3" />
        <span>In stock ({stock})</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 text-xs text-gray-600">
      <Package className="w-3 h-3" />
      <span>Available</span>
    </div>
  );
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
  inventory_item_id: string;
  name: string;
  title?: string;
  sku: string;
  price_cents: number;
  price?: string;
  image_url?: string;
  imageUrl?: string;
  brand?: string;
  category_path?: string[];
  featured_type: string;
  featured_priority: number;
  featured_at?: string;
  featured_expires_at?: string;
  days_until_expiration?: number;
  auto_unfeature?: boolean;
  is_featured: boolean;
  is_active?: boolean;
  stock?: number;
  availability?: string;
  has_variants?: boolean;
  product_type?: string;
  featuredTypes?: string[];
  tenantCategory?: string;
  tenantCategoryId?: string;
  categoryPath?: string[];
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
    maxProducts: 6 // Default, will be updated from API
  },
  {
    id: 'new_arrival',
    name: 'New Arrivals',
    description: 'Latest products for your storefront',
    icon: <Package className="w-4 h-4" />,
    color: 'green',
    maxProducts: 12 // Default, will be updated from API
  },
  {
    id: 'seasonal',
    name: 'Seasonal',
    description: 'Seasonal promotions and special items',
    icon: <Calendar className="w-4 h-4" />,
    color: 'orange',
    maxProducts: 8 // Default, will be updated from API
  },
  {
    id: 'sale',
    name: 'On Sale',
    description: 'Products on sale or promotion',
    icon: <DollarSign className="w-4 h-4" />,
    color: 'red',
    maxProducts: 10 // Default, will be updated from API
  },
  {
    id: 'staff_pick',
    name: 'Staff Picks',
    description: 'Hand-picked favorites by your team',
    icon: <Tag className="w-4 h-4" />,
    color: 'purple',
    maxProducts: 8 // Default, will be updated from API
  }
];

export default function FeaturedProductsManager({ tenantId }: { tenantId: string }) {
  const [featuredProducts, setFeaturedProducts] = useState<Record<string, FeaturedProduct[]>>({});
  const [availableProducts, setAvailableProducts] = useState<FeaturedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentType, setCurrentType] = useState<FeaturedType>(featuredTypes[0]);
  const [selectedType, setSelectedType] = useState<string>(featuredTypes[0].id);
  const [featuredLimits, setFeaturedLimits] = useState<Record<string, number>>({});
  const [availablePage, setAvailablePage] = useState(1);
  const [forceUpdate, setForceUpdate] = useState(0); // Force re-render
  const [editingExpiration, setEditingExpiration] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState('');
  const [togglingActive, setTogglingActive] = useState(false);
  
  const itemsPerPage = 12;

  // Fetch featured products limits from admin settings
  const fetchFeaturedLimits = async () => {
    try {
      const response = await apiRequest('/api/tenant-limits/featured-products');
      if (response.ok) {
        const data = await response.json();
        setFeaturedLimits(data.limits);
        
        // Update featuredTypes with actual limits
        const updatedTypes = featuredTypes.map(type => ({
          ...type,
          maxProducts: data.limits[type.id as keyof typeof data.limits] || type.maxProducts
        }));
        
        // Update currentType if needed
        setCurrentType(updatedTypes.find(t => t.id === selectedType) || updatedTypes[0]);
      }
    } catch (error) {
      console.log('Featured limits not available, using defaults');
    }
  };

  const currentFeatured = featuredProducts[selectedType] || [];
  
  // Filter expired products
  const expiredFeatured = currentFeatured.filter(product => {
    const status = getExpirationStatus(product);
    return status.isExpired;
  });

  useEffect(() => {
    fetchFeaturedLimits();
    fetchFeaturedProducts();
  }, [tenantId]);

  useEffect(() => {
    if (selectedType) {
      setAvailablePage(1); // Reset to page 1 when type changes
      fetchAvailableProducts();
    }
  }, [tenantId, selectedType, searchQuery]);

  const fetchFeaturedProducts = async () => {
    try {
      // Use the new management API that returns all products (no limits)
      const response = await apiRequest(`/api/featured-products/management?tenantId=${tenantId}&_t=${Date.now()}`);
      const data = await response.json();
      
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
      setIsLoading(true);
      // Use the same apiRequest helper that handles authentication properly
      const response = await apiRequest(`/api/items/complete?tenant_id=${tenantId}&page=1&limit=50&_t=${Date.now()}`);
      const data = await response.json();
      
      if (data && data.items) {
        // Filter for only active products that are ready to be featured
        const availableItems = data.items.filter((item: any) => {
          // Only show active products - payment gateway not required for featuring
          const isActive = item.item_status === 'active';
          
          // Check if this product is already featured for the selected type
          // This is the source of truth - we manage featuring here
          const currentFeaturedForType = featuredProducts[selectedType] || [];
          const isAlreadyFeaturedForType = currentFeaturedForType.some(
            (featured: any) => featured.inventory_item_id === item.id
          );
          
          // Only show active products that aren't already featured for this type
          return isActive && !isAlreadyFeaturedForType;
        });
        
        console.log(`[fetchAvailableProducts] Available items after filtering: ${availableItems.length}`);
        
        // Transform to the expected format
        const transformedItems = availableItems.map((item: any) => ({
          id: item.id, // Use the actual inventory item ID from API
          inventory_item_id: item.id, // Same for inventory_item_id
          name: item.name,
          sku: item.sku,
          price_cents: item.price_cents || Math.round((item.price || 0) * 100),
          price: item.price,
          image_url: item.imageUrl || item.image_url || `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9Ijc1IiB5PSI3NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2NjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=`, // Local SVG placeholder
          brand: item.brand,
          category_path: item.category_path, // Use category_path from API
          featured_type: item.featured_type || 'none',
          featured_priority: item.featured_priority || 0,
          featured_at: item.featured_at,
          is_featured: item.is_featured || false,
          stock: item.stock,
          availability: item.availability,
          has_variants: item.has_variants,
          product_type: item.product_type,
          featuredTypes: [] // Initialize empty array since API doesn't provide this
        }));
        
        setAvailableProducts(transformedItems);
      } else {
        setAvailableProducts([]);
      }
    } catch (error) {
      console.error('Error fetching available products:', error);
      setAvailableProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeature = async (productId: string) => {
    if (currentFeatured.length >= currentType.maxProducts) {
      alert(`You've reached your featuring limit (${currentType.maxProducts} products for ${currentType.name})`);
      return;
    }

    setProcessing(true);
    try {
      // Calculate expiration date (default: 30 days from now)
      const defaultExpiration = new Date();
      defaultExpiration.setDate(defaultExpiration.getDate() + 30);
      
      // Use our new multi-type featured products API with expiration
      const response = await apiRequest(`/api/items/${productId}/featured-types`, {
        method: 'POST',
        body: JSON.stringify({
          featured_type: selectedType,
          featured_priority: 50,
          featured_expires_at: defaultExpiration.toISOString(),
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
        // Add a longer delay to ensure database transaction commits completely
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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

  const handleToggleActive = async (productId: string, isActive: boolean) => {
    setTogglingActive(true);
    try {
      const response = await apiRequest(`/api/items/${productId}/featured-types/${selectedType}`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_active: isActive
        })
      });

      if (response.ok) {
        await fetchFeaturedProducts();
      } else {
        const error = await response.json();
        console.error('Failed to toggle active status:', error);
        alert(error.message || 'Failed to toggle active status');
      }
    } catch (error) {
      console.error('Error toggling active status:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setTogglingActive(false);
    }
  };

  const handleUpdateExpiration = async (productId: string, newExpirationDate: string) => {
    setProcessing(true);
    try {
      const response = await apiRequest(`/api/items/${productId}/featured-types/${selectedType}`, {
        method: 'PATCH',
        body: JSON.stringify({
          featured_expires_at: newExpirationDate ? new Date(newExpirationDate).toISOString() : null
        })
      });

      if (response.ok) {
        await fetchFeaturedProducts();
        setEditingExpiration(null);
        setExpirationDate('');
      } else {
        const error = await response.json();
        console.error('Failed to update expiration:', error);
        alert(error.message || 'Failed to update expiration');
      }
    } catch (error) {
      console.error('Error updating expiration:', error);
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
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination for available products
  const totalPages = Math.ceil(filteredAvailable.length / itemsPerPage);
  const startIndex = (availablePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAvailable = filteredAvailable.slice(startIndex, endIndex);

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
              onClick={() => {
                setSelectedType(type.id);
                setCurrentType(type); // Update currentType to sync with selectedType
              }}
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
            {currentFeatured.map((product, index) => {
              console.log('Rendering featured product:', {
                name: product.name,
                stock: product.stock,
                availability: product.availability,
                has_variants: product.has_variants
              });
              
              return (
              <div key={`featured-${product.id || 'unknown'}-${index}`} className={`bg-white rounded-lg border-2 p-4 relative ${getFeaturedBorderColor(currentType.id)}`}>

                {/* Featured Badge */}
                <div className="absolute top-2 right-2 z-10">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full ${getFeaturedBadgeStyle(currentType.id)}`}>
                    {getFeaturedBadgeIcon(currentType.id)}
                    {getFeaturedBadgeText(currentType.id, currentType.name)}
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
                  
                  {/* Stock Status */}
                  <div className="mt-2 flex items-center gap-2">
                    {getStockStatus(product)}
                  </div>
                  
                  {/* Variants Indicator */}
                  {product.has_variants && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                      <Layers className="w-3 h-3" />
                      <span>Has variants</span>
                    </div>
                  )}
                </div>

                {/* Controls Row */}
                <div className="space-y-3">
                  {/* Active/Inactive Toggle */}
                  <div className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Display Status:</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        product.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {product.is_active !== false ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleActive(product.inventory_item_id, product.is_active === false)}
                      disabled={togglingActive}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        product.is_active !== false ? 'bg-green-600' : 'bg-gray-300'
                      } ${togglingActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      title={product.is_active !== false ? 'Pause featuring' : 'Resume featuring'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          product.is_active !== false ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                      <span className="absolute left-1 top-1/2 -translate-y-1/2">
                        {product.is_active !== false ? (
                          <Play className="w-2 h-2 text-white" />
                        ) : (
                          <Pause className="w-2 h-2 text-gray-600" />
                        )}
                      </span>
                    </button>
                  </div>

                  {/* Priority and Expiration Controls */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Priority Controls */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Priority:</span>
                      <button
                        onClick={() => handleUpdatePriority(product.inventory_item_id, Math.min(product.featured_priority + 10, 100))}
                        disabled={processing}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                        title="Increase priority"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <span className="font-semibold text-gray-900">{product.featured_priority}</span>
                      <button
                        onClick={() => handleUpdatePriority(product.inventory_item_id, Math.max(product.featured_priority - 10, 0))}
                        disabled={processing}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                        title="Decrease priority"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Expiration Controls */}
                    <div className="flex items-center gap-2">
                      {editingExpiration === product.inventory_item_id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            value={expirationDate}
                            onChange={(e) => setExpirationDate(e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => handleUpdateExpiration(product.inventory_item_id, expirationDate)}
                            disabled={processing}
                            className="p-1 hover:bg-green-100 rounded text-green-600"
                            title="Save expiration"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingExpiration(null);
                              setExpirationDate('');
                            }}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                            title="Cancel"
                          >
                            <AlertTriangle className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingExpiration(product.inventory_item_id);
                              setExpirationDate(product.featured_expires_at ? new Date(product.featured_expires_at).toISOString().split('T')[0] : '');
                            }}
                            disabled={processing}
                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                            title="Edit expiration"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {(() => {
                            const status = getExpirationStatus(product);
                            return (
                              <span className={`text-xs flex items-center gap-1 ${status.statusColor}`}>
                                {status.isExpired && <AlertTriangle className="w-3 h-3" />}
                                {status.isExpiringSoon && <Timer className="w-3 h-3" />}
                                {!status.isExpired && !status.isExpiringSoon && <Clock className="w-3 h-3" />}
                                <span className="text-gray-600">{status.statusText}</span>
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Unfeature Button */}
                <button
                  onClick={() => handleUnfeature(product.inventory_item_id)}
                  disabled={processing}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {processing ? 'Processing...' : 'Remove from Featured'}
                </button>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expired Featured Products */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          Expired {currentType.name} ({expiredFeatured.length})
        </h2>

        {expiredFeatured.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Check className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Expired {currentType.name}</h3>
            <p className="text-gray-600">
              All your {currentType.name.toLowerCase()} are still active
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-700">
                ⚠️ You have {expiredFeatured.length} expired {currentType.name.toLowerCase()}. Choose whether to renew them or remove them from featuring.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {expiredFeatured.map((product, index) => (
                <div key={`expired-${product.id || 'unknown'}-${index}`} className="bg-white rounded-lg border-2 border-red-200 p-4 relative opacity-75">
                  {/* Expired Badge */}
                  <div className="absolute top-2 right-2 z-10">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-300">
                      <AlertTriangle className="w-3 h-3" />
                      EXPIRED
                    </span>
                  </div>

                  {/* Product Image */}
                  <div className="relative h-32 bg-gray-100 rounded-lg mb-3">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        className="object-cover rounded-lg opacity-75"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <Eye className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="mb-3">
                    <h3 className="font-medium text-gray-900 line-clamp-2 text-sm mb-1">
                      {product.name}
                    </h3>
                    <p className="text-sm font-bold text-gray-900">
                      ${(product.price_cents ? (product.price_cents / 100).toFixed(2) : '0.00')}
                    </p>
                    <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                    
                    {/* Expiration Info */}
                    <div className="mt-2 text-xs text-red-600">
                      {(() => {
                        const status = getExpirationStatus(product);
                        return (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Expired {status.daysRemaining === 0 ? 'today' : `${Math.abs(status.daysRemaining)} days ago`}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingExpiration(product.id);
                        setExpirationDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Default to 30 days from now
                      }}
                      disabled={processing}
                      className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Timer className="w-3 h-3" />
                      Renew
                    </button>
                    <button
                      onClick={() => handleUnfeature(product.inventory_item_id)}
                      disabled={processing}
                      className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Remove
                    </button>
                  </div>

                  {/* Renewal Edit Mode */}
                  {editingExpiration === product.id && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-xs font-medium text-gray-700">New expiration date:</label>
                        <input
                          type="date"
                          value={expirationDate}
                          onChange={(e) => setExpirationDate(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateExpiration(product.inventory_item_id, expirationDate)}
                          disabled={processing}
                          className="flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Save Renewal
                        </button>
                        <button
                          onClick={() => {
                            setEditingExpiration(null);
                            setExpirationDate('');
                          }}
                          className="flex-1 px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedAvailable.map((product: FeaturedProduct, index: number) => {
            return (
            <div key={`product-${product.id || 'unknown'}-${index}`} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
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
                  <h3 className="font-medium text-gray-900 line-clamp-2 text-sm">{product.name}</h3>
                  <p className="text-xs text-gray-500 mb-1">SKU: {product.sku}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    ${(product.price_cents ? (product.price_cents / 100).toFixed(2) : '0.00')}
                  </p>
                  
                  {/* Stock Status */}
                  <div className="mt-1 flex items-center gap-2">
                    {getStockStatus(product)}
                  </div>
                  
                  {/* Variants Indicator */}
                  {product.has_variants && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                      <Layers className="w-3 h-3" />
                      <span>Has variants</span>
                    </div>
                  )}
                  
                  {/* Product Type */}
                  <div className="mt-1 flex items-center gap-1 text-xs text-purple-600">
                    {getProductTypeIcon(product.product_type || 'physical')}
                    <span>{product.product_type || 'physical'}</span>
                  </div>
                  
                  {/* Featured Types */}
                  {product.featuredTypes && product.featuredTypes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {product.featuredTypes.map((type: string) => (
                        <span
                          key={type}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${getFeaturedBadgeStyle(type)}`}
                        >
                          {getFeaturedBadgeIcon(type)}
                          {getFeaturedBadgeText(type)}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Category Path */}
                  {product.category_path && product.category_path.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      📁 {product.category_path.join(' > ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Feature Button */}
              <button
                onClick={() => {
                  const productId = product.id || product.inventory_item_id;
                  handleFeature(productId);
                }}
                disabled={processing || currentFeatured.length >= currentType.maxProducts}
                className="mt-3 w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processing ? 'Processing...' : 
                 currentFeatured.length >= currentType.maxProducts ? 'Limit Reached' : 
                 `Add to ${currentType.name}`}
              </button>
            </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredAvailable.length)} of {filteredAvailable.length} products
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAvailablePage(Math.max(1, availablePage - 1))}
                disabled={availablePage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {availablePage} of {totalPages}
              </span>
              <button
                onClick={() => setAvailablePage(Math.min(totalPages, availablePage + 1))}
                disabled={availablePage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {filteredAvailable.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? 'No products found matching your search.' : 'No available products.'}
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
