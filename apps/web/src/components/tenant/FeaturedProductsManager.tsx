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
  Layers, Package, AlertCircle, Calendar, Tag, Award, TrendingUp, Check, 
  ShoppingBag, FileText, Edit2, X, Power, Pause, Play, Edit, Zap, PowerOff, Lock
} from 'lucide-react';
import Image from 'next/image';
import { Tooltip } from "@/components/ui/Tooltip";
import QuickStockEditor from '@/components/shared/QuickStockEditor';
import { StockUpdateService } from '@/services/stockUpdateService';

// Import existing ProductSingleton for universal product integration
import { useProduct } from '@/providers/ProductProvider';
import { PublicProduct } from '@/providers/data/ProductSingleton';
import { useTenantFeaturedProducts } from '@/hooks/useTenantFeaturedProducts';
import { useBadgeRuleValidation } from '@/hooks/useBadgeRegistry';

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
    case 'bestseller':
      return 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white';
    case 'clearance':
      return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white';
    case 'trending':
      return 'bg-gradient-to-r from-pink-500 to-rose-500 text-white';
    case 'featured':
      return 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white';
    case 'recommended':
      return 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white';
    default:
      return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white';
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
    case 'bestseller':
      return <TrendingUp className="w-3 h-3 fill-white" />;
    case 'clearance':
      return <Tag className="w-3 h-3 fill-white" />;
    case 'trending':
      return <ShoppingBag className="w-3 h-3 fill-white" />;
    case 'featured':
      return <Star className="w-3 h-3 fill-white" />;
    case 'recommended':
      return <Star className="w-3 h-3 fill-white" />;
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
      case 'clearance':
        return 'Clearance';
      case 'bestseller':
        return 'Bestseller';
      case 'trending':
        return 'Trending';
      case 'featured':
        return 'Featured';
      case 'recommended':
        return 'Recommended';
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
    case 'clearance':
      return 'Clearance';
    case 'bestseller':
      return 'Bestseller';
    case 'trending':
      return 'Trending';
    case 'featured':
      return 'Featured';
    case 'recommended':
      return 'Recommended';
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
      return <FileText className="w-3 h-3" />;
    case 'service':
      return <FileText className="w-3 h-3" />;
    default:
      return <Package className="w-3 h-3" />;
  }
};

export default function FeaturedProductsManager({ 
  tenantId, 
  context = 'storefront',
  hasFeaturedAccess = false
}: { 
  tenantId: string; 
  context?: 'storefront' | 'directory' | 'admin';
  hasFeaturedAccess?: boolean;
}) {
  // Get ProductSingleton for universal product integration
  const productProvider = useProduct();
  
  // console.log('FeaturedProductsManager: Component rendering', { tenantId, productProvider: !!productProvider });
  
  const {
    // State
    isLoading,
    selectedType,
    searchQuery,
    availablePage,
    outOfStockPage,
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
    outOfStockTotalPages,
    totalAvailableProducts,
    setSelectedType,
    setSearchQuery,
    setAvailablePage,
    setOutOfStockPage,
    setEditingExpiration: setSingletonEditingExpiration,
    featureProduct,
    unfeatureProduct,
    toggleProductActive,
    updateProductExpiration,
    forceRefresh,
    singleton // Get singleton instance for MV refresh
  } = useTenantFeaturedProducts(tenantId, productProvider, { context });

  // Get current type info
  const currentType = featuredTypes.find(t => t.id === selectedType);

  // Check if current type is at limit
  const isCurrentTypeAtLimit = (activeFeaturedByType[selectedType]?.length || 0) >= (currentType?.maxProducts || 0);

  // console.log('FeaturedProductsManager: Hook state', { 
  //   isLoading, 
  //   selectedType,
  //   currentFeaturedCount: currentFeatured?.length || 0,
  //   activeFeaturedCount: activeFeatured?.length || 0,
  //   expiredFeaturedCount: expiredFeatured?.length || 0,
  //   featuredProductsKeys: Object.keys(featuredProductsByType || {}),
  //   featuredTypesCount: featuredTypes.length,
  //   inactiveProductsCount: inactiveProducts?.length || 0,
  //   inStockCount: paginatedInStock?.length || 0,
  //   outOfStockCount: paginatedOutOfStock?.length || 0,
  //   totalAvailableCount: totalAvailableProducts || 0,
  //   sampleCurrentFeatured: currentFeatured?.slice(0, 2).map(p => ({ 
  //     id: p.id, 
  //     name: p.name, 
  //     stock: p.stock, 
  //     availability: p.availability,
  //     featured_expires_at: p.featured_expires_at,
  //     is_active: p.is_active
  //   })),
  //   sampleInStock: paginatedInStock?.slice(0, 2).map(p => ({ 
  //     id: p.id, 
  //     name: p.name, 
  //     stock: p.stock, 
  //     availability: p.availability 
  //   })),
  //   sampleOutOfStock: paginatedOutOfStock?.slice(0, 2).map(p => ({ 
  //     id: p.id, 
  //     name: p.name, 
  //     stock: p.stock, 
  //     availability: p.availability 
  //   })),
  //   sampleFeaturedProductsByType: Object.keys(featuredProductsByType || {}).reduce((acc, key) => {
  //     acc[key] = featuredProductsByType[key]?.length || 0;
  //     return acc;
  //   }, {} as any),
  //   detailedFeaturedProductsByType: Object.keys(featuredProductsByType || {}).reduce((acc, key) => {
  //     acc[key] = featuredProductsByType[key]?.map(p => ({ id: p.id, name: p.name, is_active: p.is_active }));
  //     return acc;
  //   }, {} as any),
  //   sampleInactiveProducts: inactiveProducts?.slice(0, 2).map(p => ({ 
  //     id: p.id, 
  //     name: p.name, 
  //     inventory_item_id: p.inventory_item_id 
  //   }))
  // });

  // Badge rule validation — shows warnings when manual badges contradict product state
  const { data: ruleValidation } = useBadgeRuleValidation(tenantId);
  const badgeConflicts = ruleValidation?.conflicts || [];
  const badgeAutoAssign = ruleValidation?.toAssign || [];

  // Local state for modals and UI
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [editingExpiration, setEditingExpiration] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState('');

  // Helper function to find which type a paused product belongs to
  const getPausedProductType = (pausedProduct: any) => {
    // Use the featured_type from the API response directly
    if (pausedProduct.featured_type) {
      // console.log(`getPausedProductType: Using API returned type "${pausedProduct.featured_type}" for paused product "${pausedProduct.name}"`);
      return pausedProduct.featured_type;
    }
    
    // Fallback to the old matching logic if API doesn't provide featured_type
    // console.log(`getPausedProductType: API didn't provide featured_type, falling back to matching logic for "${pausedProduct.name}"`);
    
    for (const [typeId, products] of Object.entries(featuredProductsByType)) {
      const found = products.find(p => 
        p.inventory_item_id === pausedProduct.id || 
        p.id === pausedProduct.id ||
        p.inventory_item_id === pausedProduct.inventory_item_id ||
        p.id === pausedProduct.inventory_item_id
      );
      
      if (found) {
        // console.log(`getPausedProductType: Found match for paused product "${pausedProduct.name}" in type "${typeId}"`);
        return typeId;
      }
    }
    
    // console.log(`getPausedProductType: No match found for paused product "${pausedProduct.name}"`);
    return null;
  };

  // Helper function to get type info for a paused product
  const getPausedProductTypeInfo = (pausedProduct: any) => {
    const typeId = getPausedProductType(pausedProduct);
    return typeId ? featuredTypes.find(t => t.id === typeId) : null;
  };

  // Filter paused products by selected type (show all paused products for now)
  const filteredInactiveProducts = useMemo(() => {
    if (!inactiveProducts || inactiveProducts.length === 0) return [];
    
    // Show all paused products regardless of selected type
    return inactiveProducts;
  }, [inactiveProducts]);

  // Stock update handler for out-of-stock products
  const handleStockUpdate = async (itemId: string, newStock: number) => {
    try {
      // console.log('[FeaturedProductsManager] Updating stock for item:', itemId, 'to:', newStock);
      
      // Use the StockUpdateService middleware with singleton refresh
      await StockUpdateService.getInstance().updateStock(itemId, newStock, {
        tenantId,
        onSuccess: (updatedStock: number) => {
          // console.log('[FeaturedProductsManager] Stock update successful:', updatedStock);
          // Refresh data to show updated stock and move products between sections
          forceRefresh();
        },
        onError: (error: Error) => {
          // console.error('[FeaturedProductsManager] Stock update failed:', error);
        },
        singletonRefresh: async () => {
          // Trigger singleton refresh for MV cache invalidation
          // console.log('[FeaturedProductsManager] Triggering singleton refresh for MV cache');
          await singleton.forceRefresh();
        }
      });
    } catch (error) {
      console.error('[FeaturedProductsManager] Stock update error:', error);
      throw error;
    }
  };

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
    // Featured products use inventory_item_id, active products use id
    const productId = product.inventory_item_id || product.id;
    if (!productId) {
      console.error('Missing product ID for expiration edit:', product);
      return;
    }
    setEditingExpiration(productId);
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
        const productId = product.inventory_item_id || product.id;
        const productInType = typeProducts.find(p => (p.inventory_item_id || p.id) === productId);
        
        if (productInType && productInType.is_active !== false) {
          return toggleProductActive(productId, false);
        }
        return Promise.resolve();
      });

      await Promise.all(pausePromises);
    }, 'Failed to pause product across all types');
  };

  const handleProductFeatureAllTypes = async (product: any) => {
    // Check if tenant has featured access (only for types requiring tenant access)
    if (currentType?.requiresTenantAccess && !hasFeaturedAccess) {
      alert('Featured access requires approval. Please contact support to request access.');
      return;
    }

    if (!confirm(`Are you sure you want to feature "${product.name}" in the current type (${currentType?.name})?`)) {
      return;
    }

    // Debug: Log the product object to see what fields it has
    // console.log('=== FEATURE PRODUCT DEBUG ===');
    // console.log('Product object for featuring:', product);
    // console.log('Product keys:', Object.keys(product));
    // console.log('Product ID fields:', {
    //   id: product.id,
    //   inventory_item_id: product.inventory_item_id,
    //   inventoryItemId: product.inventoryItemId
    // });
    // console.log('=== END DEBUG ===');

    await handleError(async () => {
      // For available products, use product.id
      const productId = product.id || product.inventory_item_id || product.inventoryItemId;
      
      // console.log('Attempting to feature product with ID:', productId, 'from product:', product);
      
      if (!productId) {
        // console.error('Product ID fields are all undefined:', {
        //   id: product.id,
        //   inventory_item_id: product.inventory_item_id,
        //   inventoryItemId: product.inventoryItemId,
        //   productKeys: Object.keys(product)
        // });
        throw new Error('Product ID is undefined - cannot feature product');
      }
      
      // Feature the product in the current selected type using the singleton
      await featureProduct(productId);
      
      // Refresh the data to show the newly featured product
      await forceRefresh();
    }, 'Failed to feature product');
  };

  if (isLoading) {
    // console.log('FeaturedProductsManager: Still loading...');
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

      {/* Badge Rule Validation Warnings */}
      {badgeConflicts.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">Badge Rule Conflicts Detected</h3>
              <p className="text-sm text-amber-700 mt-1">
                Some badges conflict with each other on the same product. The auto-assign job will skip these until conflicts are resolved.
              </p>
              <ul className="mt-2 space-y-1">
                {badgeConflicts.slice(0, 5).map((c, i) => (
                  <li key={i} className="text-sm text-amber-800">
                    <strong>{c.badgeKey}</strong> on product <code className="text-xs bg-amber-100 px-1 rounded">{c.inventoryItemId.slice(0, 8)}...</code>
                    {' '}conflicts with: {c.conflictsWith.join(', ')}
                  </li>
                ))}
                {badgeConflicts.length > 5 && (
                  <li className="text-sm text-amber-600">...and {badgeConflicts.length - 5} more</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Assign Suggestions */}
      {badgeAutoAssign.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Badge Auto-Assign Suggestions</h3>
              <p className="text-sm text-blue-700 mt-1">
                The following badges will be auto-assigned on the next rule sync cycle (every 4 hours):
              </p>
              <ul className="mt-2 space-y-1">
                {badgeAutoAssign.slice(0, 5).map((a, i) => (
                  <li key={i} className="text-sm text-blue-800">
                    <strong>{a.badgeKey}</strong> for product <code className="text-xs bg-blue-100 px-1 rounded">{a.inventoryItemId.slice(0, 8)}...</code>
                    {' '}— {a.reason}
                  </li>
                ))}
                {badgeAutoAssign.length > 5 && (
                  <li className="text-sm text-blue-600">...and {badgeAutoAssign.length - 5} more</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Featured Type Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Featured Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredTypes.map((type) => {
            const isPayToPlay = !!type.requiresTenantAccess;
            const isLocked = isPayToPlay && !hasFeaturedAccess;
            const isPlatformControlled = ['trending', 'recommended'].includes(type.id);
            
            return (
              <button
                key={type.id}
                onClick={() => !isLocked && setSelectedType(type.id)} // Allow clicking for viewing
                disabled={isLocked} // Only locked by premium access
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedType === type.id
                    ? 'border-blue-500 bg-blue-50'
                    : isLocked
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    : isPlatformControlled
                    ? 'border-gray-200 bg-gray-50 cursor-pointer opacity-75 hover:border-gray-300' // Visual for platform-controlled
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg bg-${type.color}-100 flex items-center justify-center relative`}>
                    {getFeaturedBadgeIcon(type.id)}
                    {isLocked && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                        <Lock className="w-2 h-2 text-white" />
                      </div>
                    )}
                    {isPlatformControlled && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <Eye className="w-2 h-2 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{type.name}</h3>
                      {isPlatformControlled && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          Platform
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{type.description}</p>
                    {isLocked && (
                      <p className="text-xs text-amber-600 mt-1">
                        💎 Premium feature - Contact platform admin
                      </p>
                    )}
                    {isPlatformControlled && (
                      <p className="text-xs text-blue-600 mt-1">
                        🤖 Algorithmically managed - View only
                      </p>
                    )}
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
            );
          })}
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
          
          {/* Read-only banner for platform-controlled types */}
          {['trending', 'recommended'].includes(selectedType) && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-700">
                  <strong>Platform Managed:</strong> This featured type is algorithmically controlled by the platform. 
                  Products shown here are what your customers see on public pages.
                </span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeFeatured.map((product, index) => (
              <div key={`${product.inventory_item_id || product.id || 'unknown'}-${product.featured_type || selectedType}-${index}`} className={`border rounded-lg p-4 relative ${product.is_active === false ? 'border-orange-200 bg-orange-50 opacity-75' : 'border-gray-200'}`}>
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
                        sizes="64px"
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
                  {/* Disable controls for platform-controlled types */}
                  {['trending', 'recommended'].includes(selectedType) ? (
                    <div className="flex-1 px-3 py-2 bg-gray-100 text-gray-500 text-sm rounded-lg text-center">
                      <Eye className="w-4 h-4 inline mr-1" />
                      Platform Managed
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          // console.log('=== PAUSE BUTTON CLICKED ===');
                          // console.log('Product object:', product);
                          // console.log('Product keys:', Object.keys(product));
                          // console.log('product.id:', product.id);
                          // console.log('product.inventory_item_id:', product.inventory_item_id);
                          // console.log('product.is_active:', product.is_active);
                          // console.log('=== END DEBUG ===');
                          
                          // Featured products MUST use inventory_item_id (the junction table key)
                          if (!product.inventory_item_id) {
                            // console.error('Missing inventory_item_id for featured product:', product);
                            return;
                          }
                          handleError(() => toggleProductActive(product.inventory_item_id, product.is_active === false), 'Failed to toggle product status');
                        }}
                        disabled={togglingActive || !product.inventory_item_id}
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
                      {editingExpiration === (product.inventory_item_id || product.id) ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="date"
                            value={expirationDate}
                            onChange={(e) => setExpirationDate(e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => {
                              const productId = product.inventory_item_id || product.id;
                              if (productId) handleSetExpiration(productId);
                            }}
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
                        onClick={() => {
                          // Featured products MUST use inventory_item_id
                          if (!product.inventory_item_id) {
                            // console.error('Missing inventory_item_id for featured product:', product);
                            return;
                          }
                          handleError(() => unfeatureProduct(product.inventory_item_id), 'Failed to remove from featured');
                        }}
                        disabled={processing || !product.inventory_item_id}
                        className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Remove from Featured
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expired/Inactive Products */}
      {(() => {
        // console.log('[FeaturedProductsManager] Expired products check:', { 
        //   expiredFeaturedCount: expiredFeatured?.length || 0,
        //   expiredFeaturedSample: expiredFeatured?.slice(0, 2).map(p => ({ id: p.id, name: p.name, is_active: p.is_active }))
        // });
        return expiredFeatured.length > 0;
      })() && (
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
                        sizes="64px"
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
                    onClick={() => {
                      // Expired featured products MUST use inventory_item_id
                      if (!product.inventory_item_id) {
                        // console.error('Missing inventory_item_id for expired product:', product);
                        return;
                      }
                      handleError(() => toggleProductActive(product.inventory_item_id, true), 'Failed to reactivate product');
                    }}
                    disabled={togglingActive || !product.inventory_item_id}
                    className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Reactivate
                  </button>
                  <button
                    onClick={() => {
                      // Expired featured products MUST use inventory_item_id
                      if (!product.inventory_item_id) {
                        // console.error('Missing inventory_item_id for expired product:', product);
                        return;
                      }
                      handleError(() => unfeatureProduct(product.inventory_item_id), 'Failed to remove product');
                    }}
                    disabled={processing || !product.inventory_item_id}
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
      {(() => {
        // console.log('[FeaturedProductsManager] Inactive products check:', { 
        //   inactiveProductsCount: inactiveProducts?.length || 0,
        //   filteredInactiveCount: filteredInactiveProducts?.length || 0,
        //   selectedType,
        //   inactiveSample: inactiveProducts?.slice(0, 2).map(p => ({ id: p.id, name: p.name, is_active: p.is_active, featured_type: p.featured_type }))
        // });
        return filteredInactiveProducts.length > 0;
      })() && (
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
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
                    onClick={() => {
                      // Paused featured products MUST use inventory_item_id
                      if (!product.inventory_item_id) {
                        // console.error('Missing inventory_item_id for paused product:', product);
                        return;
                      }
                      handleError(() => toggleProductActive(product.inventory_item_id, true), 'Failed to resume featuring');
                    }}
                    disabled={togglingActive || !product.inventory_item_id}
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
            {/* {paginatedInStock.length > 0 && console.log('PRODUCT STRUCTURE DEBUG:', {
              firstProduct: paginatedInStock[0],
              productKeys: Object.keys(paginatedInStock[0]),
              idField: paginatedInStock[0].id,
              inventory_item_id: paginatedInStock[0].inventory_item_id,
              inventoryItemId: paginatedInStock[0].inventory_item_id
            })} */}
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
                          sizes="64px"
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
                    <Tooltip content="Feature in current type">
                      <button
                        onClick={() => handleProductFeatureAllTypes(product)}
                        disabled={processing}
                        className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3" />
                      </button>
                    </Tooltip>
                    
                    {/* Disable feature button for platform-controlled types */}
                  {['trending', 'recommended'].includes(selectedType) ? (
                    <div className="px-4 py-2 bg-gray-100 text-gray-500 text-sm rounded-lg">
                      <Eye className="w-4 h-4 inline mr-1" />
                      Platform Managed
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        // console.log('=== FEATURE BUTTON CLICK DEBUG ===');
                        // console.log('Selected type:', selectedType);
                        // console.log('Current type at limit:', isCurrentTypeAtLimit);
                        // console.log('Has featured access:', hasFeaturedAccess);
                        // console.log('Product:', product);
                        // console.log('=== END BUTTON CLICK DEBUG ===');
                        
                        if (!product.id) {
                          // console.error('Product ID is undefined, cannot feature product');
                          return;
                        }
                        
                        // Check if tenant has featured access (only for types requiring tenant access)
                        if (currentType?.requiresTenantAccess && !hasFeaturedAccess) {
                          alert('Featured access requires approval. Please contact support to request access.');
                          return;
                        }
                        
                        handleError(() => featureProduct(product.id!), 'Failed to feature product');
                      }}
                      disabled={processing || !product.id || isCurrentTypeAtLimit || (currentType?.requiresTenantAccess && !hasFeaturedAccess)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 ${
                        isCurrentTypeAtLimit 
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                          : (currentType?.requiresTenantAccess && !hasFeaturedAccess)
                          ? 'bg-orange-400 text-orange-100 cursor-not-allowed'
                          : 'bg-blue-600 text-white'
                      }`}
                      title={isCurrentTypeAtLimit ? `Limit reached for ${currentType?.name} (${activeFeaturedByType[selectedType]?.length || 0}/${currentType?.maxProducts})` : (currentType?.requiresTenantAccess && !hasFeaturedAccess) ? 'Featured access requires approval' : `Add to ${currentType?.name}`}
                    >
                      {isCurrentTypeAtLimit ? 'Limit Reached' : (currentType?.requiresTenantAccess && !hasFeaturedAccess) ? 'Approval Required' : `Add to ${currentType?.name}`}
                    </button>
                  )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination Controls for In-Stock Products Only */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing {((availablePage - 1) * 12) + 1} to {Math.min(availablePage * 12, totalAvailableProducts)} of {totalAvailableProducts} in-stock products
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

        {paginatedInStock.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? 'No in-stock products found matching your search.' : 'No in-stock products available.'}
          </div>
        )}
      </div>

      {/* Out-of-Stock Products - Separate Section */}
      {paginatedOutOfStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Out-of-Stock Products ({singleton.getState().outOfStockProducts?.length || 0})
            </h2>
            <div className="text-sm text-red-600">
              These products cannot be featured until restocked
            </div>
          </div>

          <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4">
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
                        sizes="64px"
                        className="object-cover rounded opacity-50"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Product Info - Match inventory card layout */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-gray-900 line-clamp-2">
                      {product.name}
                    </h4>
                    {/* Out of Stock Badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                      <X className="w-3 h-3" />
                      OUT OF STOCK
                    </span>
                  </div>

                  <div className="text-sm text-gray-600">
                    SKU: {product.sku}
                  </div>

                  {/* Stock Editor - Aligned with inventory card */}
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold text-gray-900">
                      ${((product.price_cents || 0) / 100).toFixed(2)}
                    </div>
                    {product.id && typeof product.stock === 'number' && (
                      <QuickStockEditor
                        itemId={product.id}
                        itemName={product.name || 'Unknown Product'}
                        currentStock={product.stock}
                        tenantId={tenantId}
                        onUpdate={handleStockUpdate}
                        compact={true}
                        showStatus={false}
                      />
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                  <Tooltip content="Edit product details">
                    <a
                      href={`/t/${tenantId}/items/${product.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 flex items-center justify-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      Manage
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

          {/* Out-of-Stock Pagination Controls */}
          {outOfStockTotalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-red-200">
              <div className="text-sm text-gray-700">
                Showing {((outOfStockPage - 1) * 3) + 1} to {Math.min(outOfStockPage * 3, singleton.getState().outOfStockProducts?.length || 0)} of {singleton.getState().outOfStockProducts?.length || 0} out-of-stock products
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOutOfStockPage(Math.max(1, outOfStockPage - 1))}
                  disabled={outOfStockPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {outOfStockPage} of {outOfStockTotalPages}
                </span>
                <button
                  onClick={() => setOutOfStockPage(Math.min(outOfStockTotalPages, outOfStockPage + 1))}
                  disabled={outOfStockPage === outOfStockTotalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Products Message */}
      {paginatedInStock.length === 0 && paginatedOutOfStock.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {searchQuery ? 'No products found matching your search.' : 'No available products.'}
        </div>
      )}
    </div>
  );
}
