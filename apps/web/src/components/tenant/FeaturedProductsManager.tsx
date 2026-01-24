/**
 * Refactored FeaturedProductsManager using Singleton Pattern
 * 
 * This component demonstrates the migration to the singleton system.
 * It's much cleaner, with all business logic moved to the singleton.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Search, Star, Sparkles, Eye, ArrowUp, ArrowDown, AlertTriangle, Timer, Clock, 
  Layers, Package, AlertCircle, Calendar, Tag, Award, DollarSign, TrendingUp, Check, 
  ShoppingBag, Download, FileText, Edit2, X, Power, Pause, Play, Edit, Zap, PowerOff
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import Image from 'next/image';
import { Tooltip } from "@/components/ui/Tooltip";

// Import existing ProductSingleton for universal product integration
import { useProduct } from '@/providers/ProductProvider';
import { PublicProduct } from '@/providers/data/ProductSingleton';
import { useTenantFeaturedProducts } from '@/hooks/useTenantFeaturedProducts';

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
  if (currentTypeName && currentTypeName !== 'Directory Featured') {
    switch (typeId) {
      case 'store_selection':
        return currentTypeName;
      case 'new_arrival':
        return 'New';
      case 'seasonal':
        return 'Seasonal';
      case 'sale':
        return 'Sale';
      case 'staff_pick':
        return 'Staff Pick';
      default:
        return 'Featured';
    }
  }
  
  switch (typeId) {
    case 'store_selection':
      return 'Directory';
    case 'new_arrival':
      return 'New';
    case 'seasonal':
      return 'Seasonal';
    case 'sale':
      return 'Sale';
    case 'staff_pick':
      return 'Staff Pick';
    default:
      return 'Featured';
  }
};

const getExpirationStatus = (product: any) => {
  if (!product.featured_expires_at) {
    return { isExpired: false, daysRemaining: null, status: 'permanent' };
  }

  const now = new Date();
  const expirationDate = new Date(product.featured_expires_at);
  const diffTime = expirationDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    isExpired: diffDays < 0,
    daysRemaining: diffDays,
    status: diffDays < 0 ? 'expired' : diffDays <= 7 ? 'expiring' : 'active'
  };
};

const getStockStatus = (product: any) => {
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
  
  if (stock === 0 || availability === 'out_of_stock') {
    return (
      <div className="flex items-center gap-1 text-xs text-red-600">
        <X className="w-3 h-3" />
        <span>Out of Stock</span>
      </div>
    );
  }
  
  if (stock <= 5) {
    return (
      <div className="flex items-center gap-1 text-xs text-amber-600">
        <AlertTriangle className="w-3 h-3" />
        <span>Low Stock ({stock})</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 text-xs text-green-600">
      <Check className="w-3 h-3" />
      <span>In Stock ({stock})</span>
    </div>
  );
};

const getProductTypeIcon = (productType: string) => {
  switch (productType) {
    case 'physical':
      return <Package className="w-3 h-3" />;
    case 'digital':
      return <Download className="w-3 h-3" />;
    case 'service':
      return <FileText className="w-3 h-3" />;
    default:
      return <Package className="w-3 h-3" />;
  }
};

export default function FeaturedProductsManager({ tenantId }: { tenantId: string }) {
  // Get ProductSingleton for universal product integration
  const productProvider = useProduct();
  
  console.log('FeaturedProductsManager: Component rendering', { tenantId, productProvider: !!productProvider });
  
  const {
    // State
    isLoading,
    selectedType,
    searchQuery,
    availablePage,
    processing,
    togglingActive,
    currentFeatured,
    activeFeatured,
    expiredFeatured,
    paginatedInStock,
    paginatedOutOfStock,
    filteredAvailable,
    featuredTypes,
    featuredProductsByType,
    activeFeaturedByType,
    inactiveProducts,
    totalPages,
    totalAvailableProducts,
    setSelectedType,
    setSearchQuery,
    setAvailablePage,
    setEditingExpiration: setSingletonEditingExpiration,
    featureProduct,
    unfeatureProduct,
    toggleProductActive,
    updateProductExpiration
  } = useTenantFeaturedProducts(tenantId, productProvider);

  // Get current type info
  const currentType = featuredTypes.find(t => t.id === selectedType);

  console.log('FeaturedProductsManager: Hook state', { 
    isLoading, 
    selectedType,
    currentFeaturedCount: currentFeatured?.length || 0,
    activeFeaturedCount: activeFeatured?.length || 0,
    featuredProductsKeys: Object.keys(featuredProductsByType || {}),
    featuredTypesCount: featuredTypes.length,
    inactiveProductsCount: inactiveProducts?.length || 0,
    inStockCount: paginatedInStock?.length || 0,
    outOfStockCount: paginatedOutOfStock?.length || 0,
    totalAvailableCount: totalAvailableProducts || 0,
    sampleCurrentFeatured: currentFeatured?.slice(0, 2).map(p => ({ 
      id: p.id, 
      name: p.name, 
      is_active: p.is_active,
      inventory_item_id: p.inventory_item_id 
    })),
    sampleFeaturedProductsByType: Object.keys(featuredProductsByType || {}).reduce((acc, key) => {
      acc[key] = featuredProductsByType[key]?.length || 0;
      return acc;
    }, {} as any),
    detailedFeaturedProductsByType: Object.keys(featuredProductsByType || {}).reduce((acc, key) => {
      acc[key] = featuredProductsByType[key]?.map(p => ({ id: p.id, name: p.name, is_active: p.is_active }));
      return acc;
    }, {} as any),
    sampleInactiveProducts: inactiveProducts?.slice(0, 2).map(p => ({ 
      id: p.id, 
      name: p.name, 
      inventory_item_id: p.inventory_item_id 
    }))
  });

  // Local state for modals and UI
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [editingExpiration, setEditingExpiration] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState('');

  // Helper function to find which type a paused product belongs to
  const getPausedProductType = (pausedProduct: any) => {
    // Use the featured_type from the API response directly
    if (pausedProduct.featured_type) {
      console.log(`getPausedProductType: Using API returned type "${pausedProduct.featured_type}" for paused product "${pausedProduct.name}"`);
      return pausedProduct.featured_type;
    }
    
    // Fallback to the old matching logic if API doesn't provide featured_type
    console.log(`getPausedProductType: API didn't provide featured_type, falling back to matching logic for "${pausedProduct.name}"`);
    
    for (const [typeId, products] of Object.entries(featuredProductsByType)) {
      const found = products.find(p => 
        p.inventory_item_id === pausedProduct.id || 
        p.id === pausedProduct.id ||
        p.inventory_item_id === pausedProduct.inventory_item_id ||
        p.id === pausedProduct.inventory_item_id
      );
      
      if (found) {
        console.log(`getPausedProductType: Found match for paused product "${pausedProduct.name}" in type "${typeId}"`);
        return typeId;
      }
    }
    
    console.log(`getPausedProductType: No match found for paused product "${pausedProduct.name}"`);
    return null;
  };

  // Helper function to get type info for a paused product
  const getPausedProductTypeInfo = (pausedProduct: any) => {
    const typeId = getPausedProductType(pausedProduct);
    return typeId ? featuredTypes.find(t => t.id === typeId) : null;
  };

  // Filter paused products by selected type
  const filteredInactiveProducts = useMemo(() => {
    if (!inactiveProducts || inactiveProducts.length === 0) return [];
    
    return inactiveProducts.filter(product => {
      const productType = getPausedProductType(product);
      return productType === selectedType;
    });
  }, [inactiveProducts, selectedType]);

  // Error handling
  const handleError = async (action: () => Promise<void>, errorMessage: string) => {
    try {
      await action();
    } catch (error) {
      console.error(errorMessage, error);
      alert(error instanceof Error ? error.message : errorMessage);
    }
  };

  // Expiration handling
  const handleSetExpiration = async (productId: string) => {
    if (!expirationDate) {
      alert('Please select an expiration date');
      return;
    }

    // Validate expiration date is not in the past
    const selectedDate = new Date(expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison
    
    if (selectedDate < today) {
      alert('Expiration date cannot be in the past');
      return;
    }

    await handleError(async () => {
      await updateProductExpiration(productId, expirationDate);
      setEditingExpiration(null);
      setExpirationDate('');
    }, 'Failed to update expiration');
  };

  const handleStartEditExpiration = (product: any) => {
    setEditingExpiration(product.inventory_item_id);
    // Default to 30 days from now, or existing date
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    setExpirationDate(product.featured_expires_at ? new Date(product.featured_expires_at).toISOString().split('T')[0] : defaultDate.toISOString().split('T')[0]);
  };

  const handleCancelEditExpiration = () => {
    setEditingExpiration(null);
    setExpirationDate('');
  };

  // Product-level bulk operations
  const handleProductPauseAllTypes = async (product: any) => {
    if (!confirm(`Are you sure you want to pause "${product.name}" across all featured types? This will pause it in every type where it's currently featured.`)) {
      return;
    }

    await handleError(async () => {
      // Find all types where this product is featured and pause it in each
      const pausePromises = featuredTypes.map(async (type) => {
        const typeProducts = featuredProductsByType[type.id] || [];
        const productInType = typeProducts.find(p => p.inventory_item_id === product.inventory_item_id);
        
        if (productInType && productInType.is_active !== false) {
          return toggleProductActive(product.inventory_item_id, false);
        }
        return Promise.resolve();
      });

      await Promise.all(pausePromises);
    }, 'Failed to pause product across all types');
  };

  const handleProductFeatureAllTypes = async (product: any) => {
    if (!confirm(`Are you sure you want to feature "${product.name}" across all types? This will add it to every featured type.`)) {
      return;
    }

    await handleError(async () => {
      // Feature the product in all types
      const featurePromises = featuredTypes.map(async (type) => {
        // Check if product is already featured in this type
        const typeProducts = featuredProductsByType[type.id] || [];
        const alreadyFeatured = typeProducts.find(p => p.inventory_item_id === product.inventory_item_id);
        
        if (!alreadyFeatured) {
          return featureProduct(product.inventory_item_id);
        }
        return Promise.resolve();
      });

      await Promise.all(featurePromises);
    }, 'Failed to feature product across all types');
  };

  if (isLoading) {
    console.log('FeaturedProductsManager: Still loading...');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading featured products...</p>
          <p className="text-xs text-gray-500 mt-2">Debug: Loading state active</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Star className="w-8 h-8 text-blue-600" />
          Featured Products Management
        </h1>
        <p className="text-gray-600 mt-2">
          Manage your featured products across different categories and promotional types.
        </p>
      </div>

      {/* Featured Type Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Featured Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedType === type.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg bg-${type.color}-100 flex items-center justify-center`}>
                  {getFeaturedBadgeIcon(type.id)}
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">{type.name}</h3>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {activeFeaturedByType[type.id]?.length || 0} / {type.maxProducts} products
                </span>
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`bg-${type.color}-500 h-2 rounded-full`}
                    style={{ width: `${Math.min(((activeFeaturedByType[type.id]?.length || 0) / type.maxProducts) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Current Featured Products */}
      {activeFeatured.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Currently Featured {currentType?.name}
            </h2>
            <span className="text-sm text-gray-500">
              {activeFeatured.length} / {currentType?.maxProducts} products
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeFeatured.map((product, index) => (
              <div key={product.id || index} className={`border rounded-lg p-4 relative ${product.is_active === false ? 'border-orange-200 bg-orange-50 opacity-75' : 'border-gray-200'}`}>
                {/* Badges Container */}
                <div className="absolute top-2 left-2 right-2 z-10 flex justify-between">
                  {/* Featured Type Badge - Left */}
                  <div className={`inline-flex items-center gap-1 px-2 py-1 text-white text-xs font-bold rounded-full ${getFeaturedBadgeStyle(selectedType)}`}>
                    {getFeaturedBadgeIcon(selectedType)}
                    {getFeaturedBadgeText(selectedType, currentType?.name)}
                  </div>
                  
                  {/* Paused Badge - Right */}
                  {product.is_active === false && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">
                      <Pause className="w-3 h-3" />
                      PAUSED
                    </span>
                  )}
                </div>
                
                <div className="flex gap-3 mt-8">
                  <div className="relative w-16 h-16 bg-gray-100 rounded flex-shrink-0">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        className={`object-cover rounded ${product.is_active === false ? 'opacity-50' : ''}`}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <Eye className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-medium text-sm ${product.is_active === false ? 'text-orange-700' : 'text-gray-900'}`}>{product.name}</h3>
                    <p className="text-xs text-gray-500">{product.sku}</p>
                    <div className="mt-1">
                      {getStockStatus(product)}
                    </div>
                    <div className="mt-1 text-xs text-amber-600">
                      {(() => {
                        const status = getExpirationStatus(product);
                        return status.isExpired 
                          ? `Expired ${Math.abs(status.daysRemaining || 0)} days ago`
                          : status.daysRemaining !== null 
                            ? `Expires in ${status.daysRemaining} days`
                            : 'No expiration';
                      })()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleError(() => toggleProductActive(product.inventory_item_id, product.is_active === false), 'Failed to toggle product status')}
                    disabled={togglingActive}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      (product.is_active !== false && product.is_active !== undefined) ? 'bg-green-600' : 'bg-orange-500'
                    } ${togglingActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    title={(product.is_active !== false && product.is_active !== undefined) ? 'Pause featuring' : 'Resume featuring'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (product.is_active !== false && product.is_active !== undefined) ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                    <span className="absolute left-1 top-1/2 -translate-y-1/2">
                      {(product.is_active !== false && product.is_active !== undefined) ? (
                        <Play className="w-2 h-2 text-white" />
                      ) : (
                        <Pause className="w-2 h-2 text-white" />
                      )}
                    </span>
                  </button>
                  
                  {/* Expiration Setting */}
                  {editingExpiration === product.inventory_item_id ? (
                    <div className="flex gap-1 items-center">
                      <input
                        type="date"
                        value={expirationDate}
                        onChange={(e) => setExpirationDate(e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={() => handleSetExpiration(product.inventory_item_id)}
                        disabled={processing}
                        className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleCancelEditExpiration}
                        className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <Tooltip content="Set expiration date">
                      <button
                        onClick={() => handleStartEditExpiration(product)}
                        disabled={processing}
                        className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <Calendar className="w-3 h-3" />
                      </button>
                    </Tooltip>
                  )}
                  
                  {/* Product-level bulk operations */}
                  <Tooltip content="Pause across all types">
                    <button
                      onClick={() => handleProductPauseAllTypes(product)}
                      disabled={togglingActive}
                      className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <PowerOff className="w-3 h-3" />
                    </button>
                  </Tooltip>
                  
                  <button
                    onClick={() => handleError(() => unfeatureProduct(product.inventory_item_id), 'Failed to unfeature product')}
                    disabled={processing}
                    className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Remove from Featured
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expired/Inactive Products */}
      {expiredFeatured.length > 0 && (
        <div className="bg-white rounded-lg border border-amber-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Inactive Featured Products
            </h2>
            <span className="text-sm text-amber-600">
              {expiredFeatured.length} products need attention
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expiredFeatured.map((product, index) => (
              <div key={product.id || index} className="border border-amber-200 rounded-lg p-4 opacity-75">
                <div className="flex gap-3">
                  <div className="relative w-16 h-16 bg-gray-100 rounded flex-shrink-0">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        className="object-cover rounded opacity-50"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <Eye className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 text-sm">{product.name}</h3>
                    <p className="text-xs text-gray-500">{product.sku}</p>
                    <div className="mt-1 text-xs text-amber-600">
                      {(() => {
                        const status = getExpirationStatus(product);
                        return status.isExpired 
                          ? `Expired ${Math.abs(status.daysRemaining || 0)} days ago`
                          : `Expires in ${status.daysRemaining} days`;
                      })()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleError(() => toggleProductActive(product.inventory_item_id, true), 'Failed to reactivate product')}
                    disabled={togglingActive}
                    className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Reactivate
                  </button>
                  <button
                    onClick={() => handleError(() => unfeatureProduct(product.inventory_item_id), 'Failed to remove product')}
                    disabled={processing}
                    className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Products - Paused Only */}
      {filteredInactiveProducts.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-100 border-2 border-orange-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-orange-800 flex items-center gap-2">
                <Pause className="w-5 h-5" />
                Paused Products ({filteredInactiveProducts.length})
              </h2>
              <p className="text-sm text-orange-700 mt-1">
                {selectedType === 'store_selection' && 'Store Selection products currently paused'}
                {selectedType === 'new_arrival' && 'New Arrival products currently paused'}
                {selectedType === 'seasonal' && 'Seasonal products currently paused'}
                {selectedType === 'sale' && 'Sale products currently paused'}
                {selectedType === 'staff_pick' && 'Staff Pick products currently paused'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInactiveProducts.map((product) => {
              const productTypeInfo = getPausedProductTypeInfo(product);
              const typeId = getPausedProductType(product);
              
              return (
              <div key={product.id} className="bg-white rounded-lg border-2 border-orange-200 p-4 relative opacity-75">
                {/* Featured Type Badge */}
                {productTypeInfo && (
                  <div className="absolute top-2 left-2 z-10">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 text-white text-xs font-bold rounded-full ${getFeaturedBadgeStyle(typeId)}`}>
                      {getFeaturedBadgeIcon(typeId)}
                      {getFeaturedBadgeText(typeId, productTypeInfo.name)}
                    </div>
                  </div>
                )}
                
                {/* Paused Badge */}
                <div className="absolute top-2 right-2 z-10">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">
                    <Pause className="w-3 h-3" />
                    PAUSED
                  </span>
                </div>

                {/* Product Image */}
                <div className="relative h-48 bg-gray-100 rounded-lg mb-4">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className="object-cover rounded-lg opacity-50"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <Package className="w-12 h-12" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                    {product.name}
                  </h3>
                  <p className="text-lg font-bold text-gray-900">
                    ${((product.price_cents || 0) / 100).toFixed(2)}
                  </p>
                  <p className="text-sm text-orange-600 font-medium">SKU: {product.sku}</p>
                  {productTypeInfo && (
                    <p className="text-xs text-gray-500 mt-1">
                      Featured in: {productTypeInfo.name}
                    </p>
                  )}
                </div>

                {/* Resume Button */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => handleError(() => toggleProductActive(product.id || product.inventory_item_id, true), 'Failed to resume featuring')}
                    disabled={togglingActive}
                    className="w-full px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Resume Featuring
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Products */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Add Products to {currentType?.name}
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

        {/* In-Stock Products */}
        {paginatedInStock.length > 0 && (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              In Stock ({paginatedInStock.length} of {totalAvailableProducts})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {paginatedInStock.map((product, index) => (
                <div key={`product-${product.id || 'unknown'}-${index}`} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex gap-3">
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
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 text-sm">{product.name}</h3>
                      <p className="text-xs text-gray-500">{product.sku}</p>
                      <div className="mt-1">
                        {getStockStatus(product)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-3">
                    {/* Feature All Types Button */}
                    <Tooltip content="Feature across all types">
                      <button
                        onClick={() => handleProductFeatureAllTypes(product)}
                        disabled={processing}
                        className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3" />
                      </button>
                    </Tooltip>
                    
                    <button
                      onClick={() => handleError(() => featureProduct(product.inventory_item_id), 'Failed to feature product')}
                      disabled={processing}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add to {currentType?.name}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Out-of-Stock Products - Dedicated Section */}
      {paginatedOutOfStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Out-of-Stock Products ({paginatedOutOfStock.length} of {totalAvailableProducts})
            </h2>
            <div className="text-sm text-red-600">
              These products cannot be featured until restocked
            </div>
          </div>

          <div className="bg-red-100 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">
                Out-of-stock products cannot be added to featured lists. 
                Use "Manage Stock" to update inventory levels.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedOutOfStock.map((product, index) => (
              <div key={`product-outofstock-${product.id || 'unknown'}-${index}`} className="bg-white border-2 border-red-200 rounded-lg p-4 opacity-75">
                {/* Out of Stock Badge */}
                <div className="absolute top-2 right-2 z-10">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                    <X className="w-3 h-3" />
                    OUT OF STOCK
                  </span>
                </div>

                {/* Product Image */}
                <div className="flex gap-3">
                  <div className="relative w-16 h-16 bg-gray-100 rounded flex-shrink-0">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        className="object-cover rounded opacity-50"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 text-sm">{product.name}</h3>
                    <p className="text-xs text-gray-500">{product.sku}</p>
                    <div className="mt-1">
                      {getStockStatus(product)}
                    </div>
                    <p className="text-xs text-red-600 font-medium mt-1">
                      ${((product.price_cents || 0) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3">
                  <Tooltip content="Edit product to update stock quantity and availability">
                    <a
                      href={`/t/${tenantId}/items/${product.inventory_item_id}`}
                      className="flex-1 px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 flex items-center justify-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      Manage Stock
                    </a>
                  </Tooltip>
                  
                  {/* Feature All Types Button (disabled) */}
                  <Tooltip content="Cannot feature out-of-stock products. Restock first.">
                    <button
                      disabled={true}
                      className="px-2 py-1 bg-gray-100 text-gray-400 text-xs rounded cursor-not-allowed flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination for Out-of-Stock */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-red-200">
              <div className="text-sm text-gray-700">
                Showing {paginatedOutOfStock.length} out-of-stock products
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAvailablePage(Math.max(1, availablePage - 1))}
                  disabled={availablePage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {availablePage} of {totalPages}
                </span>
                <button
                  onClick={() => setAvailablePage(Math.min(totalPages, availablePage + 1))}
                  disabled={availablePage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing {paginatedInStock.length + paginatedOutOfStock.length} products ({paginatedInStock.length} in stock, {paginatedOutOfStock.length} out of stock) of {totalAvailableProducts} total
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAvailablePage(Math.max(1, availablePage - 1))}
                disabled={availablePage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {availablePage} of {totalPages}
              </span>
              <button
                onClick={() => setAvailablePage(Math.min(totalPages, availablePage + 1))}
                disabled={availablePage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {paginatedInStock.length === 0 && paginatedOutOfStock.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? 'No products found matching your search.' : 'No available products.'}
          </div>
        )}
      </div>
    </div>
  );
}
