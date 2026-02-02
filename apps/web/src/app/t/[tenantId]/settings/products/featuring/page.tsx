"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Search, Star, Sparkles, Eye, ArrowUp, ArrowDown, AlertTriangle, Timer, Clock, 
  Layers, Package, AlertCircle, Calendar, Tag, Award, DollarSign, TrendingUp, Check, 
  ShoppingBag, Download, FileText, Edit2, X, Power, Pause, Play, Edit 
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import Image from 'next/image';
import { Tooltip } from "@/components/ui/Tooltip";
import { useTenantFeaturedProducts } from '@/hooks/useTenantFeaturedProducts';
import { FeaturedProduct, FeaturedType } from '@/lib/singletons/TenantFeaturedProductsSingleton';
import QuickStockEditor from '@/components/shared/QuickStockEditor';
import { StockUpdateService } from '@/services/stockUpdateService';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';

/**
 * Get the authoritative inventory_item_id for API calls
 * 
 * RULE: Featured products (from featured_products table) use inventory_item_id
 *       Available products (from inventory_items table) use id
 * 
 * The backend ALWAYS expects inventory_item_id for featured product operations
 */
function getProductInventoryId(product: FeaturedProduct | Product): string | undefined {
  // Featured products from junction table have inventory_item_id
  if (product.inventory_item_id) {
    return product.inventory_item_id;
  }
  
  // Available products from inventory_items table use id as inventory_item_id
  if ('id' in product && product.id) {
    return product.id;
  }
  
  return undefined;
}

interface Product {
  id: string;
  inventory_item_id: string;
  name: string;
  sku: string;
  price_cents: number;
  image_url: string | null;
  stock: number;
  availability: string;
  has_variants: boolean;
  product_type: string;
  category_path: string[];
  featuredTypes: string[];
  featured_at?: string;
  featured_expires_at?: string;
  featured_priority?: number;
  is_active?: boolean;
  inactivityReason?: string;
  reasonText?: string;
}

interface Tenant {
  id: string;
  name: string;
  subscription_tier: string;
}

// Custom Featured Product Limit Badge
function FeaturedProductLimitBadge({ current, limit }: { current: number; limit: number }) {
  const percentUsed = (current / limit) * 100;
  const isNearLimit = percentUsed >= 80;
  const isAtLimit = current >= limit;

  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
        isAtLimit ? 'bg-red-100 text-red-700 border border-red-200' :
        isNearLimit ? 'bg-amber-100 text-amber-700 border border-amber-200' :
        'bg-blue-100 text-blue-700 border border-blue-200'
      }`}>
        <Star className="w-4 h-4" />
        <span>{current} / {limit}</span>
      </div>
      
      {/* Progress bar */}
      <div className="w-24 bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all ${
            isAtLimit ? 'bg-red-500' :
            isNearLimit ? 'bg-amber-500' :
            'bg-blue-500'
          }`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>
      
      <span className="text-xs text-gray-500">
        {isAtLimit ? 'Limit reached' : 
         isNearLimit ? `${limit - current} remaining` : 
         `${limit - current} available`}
      </span>
    </div>
  );
}

const getExpirationStatus = (product: FeaturedProduct) => {
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

const getStockStatus = (product: FeaturedProduct) => {
  const stock = product.stock || 0;
  const availability = product.availability || 'in_stock';
  
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

// Helper functions for grouping inactive products by reason
const groupInactiveProductsByReason = (products: FeaturedProduct[]) => {
  const groups: Record<string, FeaturedProduct[]> = {
    paused: [],
    expired: [],
    out_of_stock: []
  };

  products.forEach(product => {
    // Check if product is inactive (not active)
    if (!product.is_active) {
      // Determine the reason for inactivity
      if (product.featured_expires_at && new Date(product.featured_expires_at) < new Date()) {
        // Expired products
        groups.expired.push(product);
      } else if (product.stock === 0 || product.availability === 'out_of_stock') {
        // Out of stock products
        groups.out_of_stock.push(product);
      } else {
        // Paused products (default for inactive products that aren't expired or out of stock)
        groups.paused.push(product);
      }
    }
  });

  return groups;
};

const getInactiveGroupStyle = (reason: string) => {
  switch (reason) {
    case 'paused':
      return {
        container: 'border-amber-200 bg-amber-50',
        header: 'text-amber-800 bg-amber-100',
        badge: 'bg-amber-100 text-amber-800'
      };
    case 'expired':
      return {
        container: 'border-red-200 bg-red-50',
        header: 'text-red-800 bg-red-100',
        badge: 'bg-red-100 text-red-800'
      };
    case 'out_of_stock':
      return {
        container: 'border-gray-200 bg-gray-50',
        header: 'text-gray-800 bg-gray-100',
        badge: 'bg-gray-100 text-gray-800'
      };
    default:
      return {
        container: 'border-gray-200 bg-gray-50',
        header: 'text-gray-800 bg-gray-100',
        badge: 'bg-gray-100 text-gray-800'
      };
  }
};

const getInactiveGroupTitle = (reason: string) => {
  switch (reason) {
    case 'paused':
      return { title: 'Paused Products', description: 'Temporarily inactive' };
    case 'expired':
      return { title: 'Expired Products', description: 'Featuring period ended' };
    case 'out_of_stock':
      return { title: 'Out of Stock Products', description: 'Cannot be featured until restocked' };
    default:
      return { title: 'Inactive Products', description: 'Not currently active' };
  }
};

// Simple Tier Badge component (matching featured-products page)
function SimpleTierBadge({ tier }: { tier: string }) {
  const getTierInfo = (tierLevel: string) => {
    switch (tierLevel) {
      case 'trial':
        return { color: 'bg-orange-100 text-orange-700 border-orange-300', icon: '🧪', name: 'Trial' };
      case 'google_only':
        return { color: 'bg-blue-100 text-blue-700 border-blue-300', icon: '🔍', name: 'Google Only' };
      case 'starter':
        return { color: 'bg-neutral-100 text-neutral-700 border-neutral-300', icon: '🌱', name: 'Starter' };
      case 'growth':
        return { color: 'bg-green-100 text-green-700 border-green-300', icon: '📈', name: 'Growth' };
      case 'professional':
        return { color: 'bg-purple-100 text-purple-700 border-purple-300', icon: '⭐', name: 'Professional' };
      case 'enterprise':
        return { color: 'bg-amber-100 text-amber-700 border-amber-300', icon: '🏢', name: 'Enterprise' };
      case 'organization':
        return { color: 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-purple-300', icon: '💎', name: 'Organization' };
      default:
        return { color: 'bg-gray-100 text-gray-700 border-gray-300', icon: '📦', name: tierLevel };
    }
  };

  const tierInfo = getTierInfo(tier);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${tierInfo.color}`}>
      <span className="text-lg">{tierInfo.icon}</span>
      <span className="font-semibold text-sm">{tierInfo.name}</span>
    </div>
  );
}

export default function ProductFeaturingPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [editingExpiration, setEditingExpiration] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState('');

  // Use singleton for store_selection data only
  const {
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
    singleton // Get singleton for MV refresh
  } = useTenantFeaturedProducts(tenantId);

  // Stock update handler for out-of-stock products
  const handleStockUpdate = async (itemId: string, newStock: number) => {
    try {
      console.log('[ProductFeaturingPage] Updating stock for item:', itemId, 'to:', newStock);
      
      // Use the StockUpdateService middleware with singleton refresh
      await StockUpdateService.updateStock(itemId, newStock, {
        tenantId,
        onSuccess: (updatedStock: number) => {
          console.log('[ProductFeaturingPage] Stock update successful:', updatedStock);
          // Force refresh to update product sections
          singleton.forceRefresh();
        },
        onError: (error: Error) => {
          console.error('[ProductFeaturingPage] Stock update failed:', error);
        }
      });
    } catch (error) {
      console.error('[ProductFeaturingPage] Stock update error:', error);
      throw error;
    }
  };

  // Filter to only store_selection products
  const storeSelectionFeatured = currentFeatured.filter(p => p.featured_type === 'store_selection');
  const storeSelectionActive = activeFeatured.filter(p => p.featured_type === 'store_selection');
  const storeSelectionExpired = expiredFeatured.filter(p => p.featured_type === 'store_selection');

  // Get inactive products from singleton state
  const singletonState = singleton.getState();
  const allInactiveProducts = singletonState.inactiveProducts || [];
  const storeSelectionInactive = allInactiveProducts.filter(p => !p.is_active);

  // Group inactive products by reason
  const inactiveGroups = groupInactiveProductsByReason(storeSelectionInactive);

  const fetchTenant = async () => {
    try {
      const response = await apiRequest(`/api/tenants/${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setTenant(data);
      }
    } catch (error) {
      console.error('Error fetching tenant:', error);
    }
  };

  useEffect(() => {
    fetchTenant();
  }, [tenantId]);

  useEffect(() => {
    setAvailablePage(1); // Reset to page 1 when search changes
  }, [searchQuery]);

  // Sync editing expiration with singleton
  useEffect(() => {
    setSingletonEditingExpiration(editingExpiration, expirationDate);
  }, [editingExpiration, expirationDate, setSingletonEditingExpiration]);

  const handleToggleActive = async (productId: string, isActive: boolean) => {
    await toggleProductActive(productId, isActive);
  };

  const handleUpdateExpiration = async (productId: string, newExpirationDate: string) => {
    await updateProductExpiration(productId, newExpirationDate);
    setEditingExpiration(null);
    setExpirationDate('');
  };

  const handleUnfeature = async (productId: string) => {
    await unfeatureProduct(productId);
  };

  const handleStartEditExpiration = (product: FeaturedProduct) => {
    const productId = getProductInventoryId(product);
    if (!productId) {
      console.error('Cannot edit expiration - no inventory_item_id found:', product);
      return;
    }
    setEditingExpiration(productId);
    // Set current expiration date or default to 30 days from now
    const currentExpiration = product.featured_expires_at 
      ? new Date(product.featured_expires_at).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setExpirationDate(currentExpiration);
  };

  const handleSetExpiration = async (productId: string) => {
    await handleUpdateExpiration(productId, expirationDate);
  };

  const handleCancelEditExpiration = () => {
    setEditingExpiration(null);
    setExpirationDate('');
  };

  const handleFeaturePaused = async (productId: string) => {
    // Feature the product and immediately pause it
    await featureProduct(productId);
    // Wait a moment for the feature to complete, then pause
    setTimeout(() => {
      handleToggleActive(productId, false);
    }, 500);
  };

  // Safe handler functions - uses getProductInventoryId for consistency
  const handleSafeToggleActive = (product: FeaturedProduct, isActive: boolean) => {
    console.log('=== COMPLETE PRODUCT OBJECT DEBUG ===');
    console.log('Full product object:', JSON.stringify(product, null, 2));
    console.log('Product keys:', Object.keys(product));
    console.log('Product values:');
    Object.entries(product).forEach(([key, value]) => {
      console.log(`  ${key}:`, value);
    });
    console.log('Specific ID fields:');
    console.log('  product.id:', product.id);
    console.log('  product.inventory_item_id:', product.inventory_item_id);
    console.log('Toggle to isActive:', isActive);
    console.log('=== END COMPLETE DEBUG ===');
    
    const inventoryItemId = getProductInventoryId(product);
    if (inventoryItemId) {
      console.log('✅ Using inventory_item_id:', inventoryItemId);
      handleToggleActive(inventoryItemId, isActive);
    } else {
      console.error('❌ No valid inventory_item_id found for product:', product);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading featured products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <Star className="w-6 h-6 text-blue-600 mr-3" />
                <h1 className="text-xl font-semibold text-gray-900">Store Selection Featuring</h1>
              </div>
            </div>
            {tenant && <SimpleTierBadge tier={tenant.subscription_tier} />}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Directory Featuring:</strong> Manage products featured in your directory storefront listing
          </p>
        </div>

        {/* Current Featured Products */}
        {storeSelectionActive.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Currently Featured in Directory
                </h2>
                <div className="mt-2">
                  <FeaturedProductLimitBadge 
                    current={storeSelectionActive.length} 
                    limit={10} 
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storeSelectionActive.map((product, index) => (
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
                      {/* Stock Editor */}
                      <div className="mt-2">
                        {product.id && typeof product.stock === 'number' && (
                          <QuickStockEditor
                            itemId={product.id}
                            itemName={product.name || 'Unknown Product'}
                            currentStock={product.stock}
                            onUpdate={handleStockUpdate}
                            compact={true}
                            showStatus={false}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Inline Expiration Editor */}
                  {editingExpiration === (product.inventory_item_id || product.id) ? (
                    <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-700 whitespace-nowrap">Expiration:</span>
                        <input
                          type="date"
                          value={expirationDate}
                          onChange={(e) => setExpirationDate(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => handleSetExpiration(editingExpiration)}
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
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3">
                      {/* Pause/Resume Toggle */}
                      <Tooltip content={product.is_active ? "Pause featuring" : "Resume featuring"}>
                        <button
                          onClick={() => handleSafeToggleActive(product, !product.is_active)}
                          disabled={processing}
                          className={`px-2 py-1 text-sm rounded flex items-center gap-1 ${
                            product.is_active 
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {product.is_active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        </button>
                      </Tooltip>
                      <button
                        onClick={() => handleUnfeature(product.inventory_item_id)}
                        disabled={processing}
                        className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Remove from Directory
                      </button>
                      {/* Expiration Setting */}
                      <Tooltip content="Set expiration date">
                        <button
                          onClick={() => handleStartEditExpiration(product)}
                          disabled={processing}
                          className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <Calendar className="w-3 h-3" />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inactive/Expired Products */}
        {Object.entries(inactiveGroups).map(([reason, products]) => (
          products.length > 0 && (
            <div key={reason} className={`bg-white rounded-lg border ${getInactiveGroupStyle(reason).container} p-6 mb-6`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-semibold ${getInactiveGroupStyle(reason).header} px-3 py-1 rounded-lg flex items-center gap-2`}>
                  <AlertTriangle className="w-5 h-5" />
                  {getInactiveGroupTitle(reason).title}
                </h2>
                <span className={`text-sm ${getInactiveGroupStyle(reason).badge} px-2 py-1 rounded`}>
                  {products.length} products • {getInactiveGroupTitle(reason).description}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product, index) => (
                  <div key={product.id || index} className={`border ${getInactiveGroupStyle(reason).container} rounded-lg p-4 opacity-75`}>
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
                        <div className="mt-1 text-xs text-gray-600">
                          {product.reasonText}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {reason === 'paused' && (
                        <button
                          onClick={() => handleSafeToggleActive(product, true)}
                          disabled={processing}
                          className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          Unpause
                        </button>
                      )}
                      {reason === 'expired' && (
                        <button
                          onClick={() => handleSafeToggleActive(product, true)}
                          disabled={processing}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      )}
                      <button
                        onClick={() => handleUnfeature(product.inventory_item_id)}
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
          )
        ))}

        {/* Available Products */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Add Products to Directory
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
                In Stock ({filteredAvailable.filter(product => !singleton.isOutOfStock(product)).length})
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
                        {/* Stock Editor */}
                        {product.id && typeof product.stock === 'number' && (
                          <QuickStockEditor
                            itemId={product.id}
                            itemName={product.name || 'Unknown Product'}
                            currentStock={product.stock}
                            onUpdate={handleStockUpdate}
                            compact={true}
                            showStatus={false}
                          />
                        )}
                      </div>
                    </div>
                    
                    {/* Inline Expiration Editor for Available Products */}
                    {editingExpiration === getProductInventoryId(product) ? (
                      <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-blue-700 whitespace-nowrap">Expiration:</span>
                          <input
                            type="date"
                            value={expirationDate}
                            onChange={(e) => setExpirationDate(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => {
                              const productId = getProductInventoryId(product);
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
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => product.id && featureProduct(product.id)}
                          disabled={processing || !product.id}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          Feature in Directory
                        </button>
                        {/* Queue Control */}
                        <button
                          onClick={() => product.id && handleFeaturePaused(product.id)}
                          disabled={processing || !product.id}
                          className="px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50"
                          title="Add to featured queue in paused status"
                        >
                          <Pause className="w-3 h-3" />
                        </button>
                        {/* Expiration Setting */}
                        <Tooltip content="Set expiration date">
                          <button
                            onClick={() => handleStartEditExpiration(product)}
                            disabled={processing}
                            className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50"
                          >
                            <Calendar className="w-3 h-3" />
                          </button>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 mb-8">
              <div className="text-sm text-gray-700">
                Showing {((availablePage - 1) * 12) + 1} to {Math.min(availablePage * 12, totalAvailableProducts)} of {totalAvailableProducts} products
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAvailablePage(availablePage - 1)}
                  disabled={availablePage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  Page {availablePage} of {totalPages}
                </span>
                <button
                  onClick={() => setAvailablePage(availablePage + 1)}
                  disabled={availablePage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Out-of-Stock Products - Outside Pagination */}
          {paginatedOutOfStock.length > 0 && (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <X className="w-5 h-5 text-red-600" />
                Out of Stock ({singletonState.outOfStockProducts?.length || 0})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedOutOfStock.map((product, index) => (
                  <div key={`product-${product.id || 'unknown'}-${index}`} className="border border-gray-200 rounded-lg p-4 opacity-75">
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
                        {/* Stock Editor */}
                        {product.id && typeof product.stock === 'number' && (
                          <QuickStockEditor
                            itemId={product.id}
                            itemName={product.name || 'Unknown Product'}
                            currentStock={product.stock}
                            onUpdate={handleStockUpdate}
                            compact={true}
                            showStatus={false}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => product.id && featureProduct(product.id)}
                        disabled={processing || !product.id}
                        className="flex-1 px-3 py-2 bg-gray-400 text-white text-sm rounded-lg cursor-not-allowed"
                        title="Out of stock products cannot be featured"
                      >
                        Out of Stock
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Out-of-Stock Pagination Controls */}
          {outOfStockTotalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 mb-8">
              <div className="text-sm text-gray-700">
                Showing {((outOfStockPage - 1) * 3) + 1} to {Math.min(outOfStockPage * 3, singletonState.outOfStockProducts?.length || 0)} of {singletonState.outOfStockProducts?.length || 0} out-of-stock products
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOutOfStockPage(outOfStockPage - 1)}
                  disabled={outOfStockPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  Page {outOfStockPage} of {outOfStockTotalPages}
                </span>
                <button
                  onClick={() => setOutOfStockPage(outOfStockPage + 1)}
                  disabled={outOfStockPage === outOfStockTotalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {paginatedInStock.length === 0 && paginatedOutOfStock.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No products found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
