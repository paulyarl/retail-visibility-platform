/**
 * Refactored FeaturedProductsManager using Singleton Pattern
 * 
 * This component demonstrates the migration to the singleton system.
 * It's much cleaner, with all business logic moved to the singleton.
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Search, Star, Sparkles, Eye, ArrowUp, ArrowDown, AlertTriangle, Timer, Clock, 
  Layers, Package, AlertCircle, Calendar, Tag, Award, DollarSign, TrendingUp, Check, 
  ShoppingBag, Download, FileText, Edit2, X, Power, Pause, Play, Edit 
} from 'lucide-react';
import Image from 'next/image';
import { Tooltip } from "@/components/ui/Tooltip";
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

export default function FeaturedProductsManagerSingleton({ tenantId }: { tenantId: string }) {
  const {
    // State
    featuredTypes,
    isLoading,
    processing,
    searchQuery,
    selectedType,
    currentType,
    availablePage,
    editingExpiration,
    expirationDate,
    togglingActive,
    
    // Computed values
    currentFeatured,
    activeFeatured,
    expiredFeatured,
    paginatedInStock,
    paginatedOutOfStock,
    totalPages,
    startIndex,
    endIndex,
    
    // Actions
    featureProduct,
    unfeatureProduct,
    toggleProductActive,
    updateProductExpiration,
    setSelectedType,
    setSearchQuery,
    setAvailablePage,
    setEditingExpiration,
    isOutOfStock
  } = useTenantFeaturedProducts(tenantId);

  // Local state for modals and UI
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  // Error handling
  const handleError = async (action: () => Promise<void>, errorMessage: string) => {
    try {
      await action();
    } catch (error) {
      console.error(errorMessage, error);
      alert(error instanceof Error ? error.message : errorMessage);
    }
  };

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
                  {activeFeatured.length} / {type.maxProducts} products
                </span>
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`bg-${type.color}-500 h-2 rounded-full`}
                    style={{ width: `${Math.min((activeFeatured.length / type.maxProducts) * 100, 100)}%` }}
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
              <div key={product.id || index} className="border border-gray-200 rounded-lg p-4">
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
                <button
                  onClick={() => handleError(() => unfeatureProduct(product.inventory_item_id), 'Failed to unfeature product')}
                  disabled={processing}
                  className="mt-3 w-full px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Remove from Featured
                </button>
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
              In Stock ({paginatedInStock.length})
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
                  <Tooltip
                    content={`Add this product to ${currentType?.name}`}
                  >
                    <button
                      onClick={() => handleError(() => featureProduct(product.inventory_item_id), 'Failed to feature product')}
                      disabled={processing}
                      className="mt-3 w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add to {currentType?.name}
                    </button>
                  </Tooltip>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Out-of-Stock Products */}
        {paginatedOutOfStock.length > 0 && (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Out of Stock ({paginatedOutOfStock.length})
              <span className="text-sm font-normal text-gray-500 ml-2">
                - Click "Manage Stock" to replenish inventory
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {paginatedOutOfStock.map((product, index) => (
                <div key={`product-outofstock-${product.id || 'unknown'}-${index}`} className="border border-red-200 rounded-lg p-4 opacity-75">
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
                      <div className="mt-1">
                        {getStockStatus(product)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Tooltip
                      content="Edit product to update stock quantity. After restocking, return here to feature this product."
                    >
                      <a
                        href={`/t/${tenantId}/items/${product.inventory_item_id}`}
                        className="flex-1 px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 flex items-center justify-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        Manage Stock
                      </a>
                    </Tooltip>
                    <Tooltip
                      content="Cannot add out-of-stock products to featured list. Use 'Manage Stock' to replenish inventory."
                    >
                      <button
                        disabled={true}
                        className="flex-1 px-3 py-2 bg-gray-400 text-white text-sm rounded-lg cursor-not-allowed"
                      >
                        Out of Stock
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing {paginatedInStock.length + paginatedOutOfStock.length} products ({paginatedInStock.length} in stock, {paginatedOutOfStock.length} out of stock) of {paginatedInStock.length + paginatedOutOfStock.length} total
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
