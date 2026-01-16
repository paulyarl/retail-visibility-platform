"use client";

import { useState, useEffect } from 'react';
import { Star, TrendingUp, Store, Package, Eye, ExternalLink, X, Trash2, CheckSquare, Square, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';

interface FeaturedProduct {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  title?: string;
  brand?: string;
  price_cents: number;
  image_url?: string;
  is_featured: boolean;
  featured_at: string;
  featured_until?: string;
  featured_priority: number;
  tenants: {
    id: string;
    name: string;
    subscription_tier: string;
  };
}

interface FeaturingStats {
  totalFeatured: number;
  byTier: Array<{ tier: string; count: string }>;
  expiringSoon: number;
}

export default function AdminFeaturedProductsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FeaturingStats | null>(null);
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [confirmUnfeature, setConfirmUnfeature] = useState<string | null>(null);
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [expirationFilter, setExpirationFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [uniqueTenants, setUniqueTenants] = useState<Array<{id: string, name: string}>>([]);

  useEffect(() => {
    fetchData();
  }, [page, searchQuery, tierFilter, tenantFilter, expirationFilter]);

  useEffect(() => {
    // Reset to page 0 when filters change
    if (page !== 0) {
      setPage(0);
    }
  }, [searchQuery, tierFilter, tenantFilter, expirationFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, productsRes] = await Promise.all([
        api.get('/api/admin/products/featuring/stats'),
        api.get(`/api/admin/products/featured?limit=${limit}&offset=${page * limit}`)
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        let allProducts = productsData.products || [];
        
        // Extract unique tenants for filter dropdown
        const tenantsMap = new Map();
        allProducts.forEach((p: FeaturedProduct) => {
          if (!tenantsMap.has(p.tenant_id)) {
            tenantsMap.set(p.tenant_id, { id: p.tenant_id, name: p.tenants.name });
          }
        });
        setUniqueTenants(Array.from(tenantsMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
        
        // Apply client-side filters
        let filteredProducts = allProducts;
        
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredProducts = filteredProducts.filter((p: FeaturedProduct) => 
            p.name?.toLowerCase().includes(query) ||
            p.title?.toLowerCase().includes(query) ||
            p.brand?.toLowerCase().includes(query) ||
            p.sku?.toLowerCase().includes(query) ||
            p.tenants.name?.toLowerCase().includes(query)
          );
        }
        
        if (tierFilter !== 'all') {
          filteredProducts = filteredProducts.filter((p: FeaturedProduct) => 
            p.tenants.subscription_tier === tierFilter
          );
        }
        
        if (tenantFilter !== 'all') {
          filteredProducts = filteredProducts.filter((p: FeaturedProduct) => 
            p.tenant_id === tenantFilter
          );
        }
        
        if (expirationFilter === 'expiring') {
          const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          filteredProducts = filteredProducts.filter((p: FeaturedProduct) => 
            p.featured_until && new Date(p.featured_until) <= sevenDaysFromNow
          );
        } else if (expirationFilter === 'permanent') {
          filteredProducts = filteredProducts.filter((p: FeaturedProduct) => !p.featured_until);
        } else if (expirationFilter === 'temporary') {
          filteredProducts = filteredProducts.filter((p: FeaturedProduct) => p.featured_until);
        }
        
        setProducts(filteredProducts);
        setTotal(filteredProducts.length);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      'trial': 'bg-gray-100 text-gray-700',
      'google-only': 'bg-blue-100 text-blue-700',
      'starter': 'bg-green-100 text-green-700',
      'professional': 'bg-purple-100 text-purple-700',
      'enterprise': 'bg-amber-100 text-amber-700',
      'organization': 'bg-red-100 text-red-700'
    };
    return colors[tier] || 'bg-gray-100 text-gray-700';
  };

  const handleUnfeature = async (productId: string, tenantId: string) => {
    try {
      const res = await api.delete(`/api/tenants/${tenantId}/products/${productId}/feature`);
      if (res.ok) {
        await fetchData();
        setConfirmUnfeature(null);
      } else {
        const error = await res.json();
        alert(`Failed to unfeature: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error unfeaturing product:', error);
      alert('Failed to unfeature product');
    }
  };

  const handlePriorityUpdate = async (productId: string, tenantId: string, newPriority: number) => {
    try {
      const res = await api.patch(`/api/tenants/${tenantId}/products/${productId}/feature/priority`, {
        priority: newPriority
      });
      if (res.ok) {
        setProducts(prev => prev.map(p => 
          p.id === productId ? { ...p, featured_priority: newPriority } : p
        ));
        setUpdatingPriority(null);
      } else {
        const error = await res.json();
        alert(`Failed to update priority: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating priority:', error);
      alert('Failed to update priority');
    }
  };

  const toggleSelectProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const handleBulkUnfeature = async () => {
    if (selectedProducts.size === 0) return;
    
    if (!confirm(`Are you sure you want to unfeature ${selectedProducts.size} product(s)?`)) {
      return;
    }

    setBulkActionLoading(true);
    try {
      const promises = Array.from(selectedProducts).map(productId => {
        const product = products.find(p => p.id === productId);
        if (!product) return Promise.resolve();
        return api.delete(`/api/tenants/${product.tenant_id}/products/${productId}/feature`);
      });

      await Promise.all(promises);
      await fetchData();
      setSelectedProducts(new Set());
    } catch (error) {
      console.error('Error bulk unfeaturing:', error);
      alert('Failed to unfeature some products');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTierFilter('all');
    setTenantFilter('all');
    setExpirationFilter('all');
  };

  const hasActiveFilters = searchQuery || tierFilter !== 'all' || tenantFilter !== 'all' || expirationFilter !== 'all';
  const totalPages = Math.ceil(total / limit);
  const startItem = total > 0 ? page * limit + 1 : 0;
  const endItem = Math.min((page + 1) * limit, total);

  if (loading && page === 0) {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Star className="w-8 h-8 text-amber-500 fill-amber-500" />
          Featured Products Overview
        </h1>
        <p className="mt-2 text-gray-600">
          Platform-wide view of all featured products across tenants
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Featured */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Featured</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalFeatured}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-amber-600 fill-amber-600" />
              </div>
            </div>
          </div>

          {/* Expiring Soon */}
          <div className="bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.expiringSoon}</p>
                <p className="text-xs text-gray-500 mt-1">Next 7 days</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          {/* By Tier */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-600">By Tier</p>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="space-y-1">
              {stats.byTier.slice(0, 3).map((item) => (
                <div key={item.tier} className="flex justify-between text-sm">
                  <span className="text-gray-600 capitalize">{item.tier}:</span>
                  <span className="font-semibold text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="font-semibold text-gray-900">Filters</span>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                Active
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {showFilters ? 'Hide' : 'Show'}
          </div>
        </button>
        
        {showFilters && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name, SKU, brand..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Tenant Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tenant (Location)
                </label>
                <select
                  value={tenantFilter}
                  onChange={(e) => setTenantFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">All Tenants ({uniqueTenants.length})</option>
                  {uniqueTenants.map(tenant => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tier Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subscription Tier
                </label>
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">All Tiers</option>
                  <option value="trial">Trial</option>
                  <option value="google-only">Google Only</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="organization">Organization</option>
                </select>
              </div>

              {/* Expiration Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration Status
                </label>
                <select
                  value={expirationFilter}
                  onChange={(e) => setExpirationFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">All Products</option>
                  <option value="expiring">Expiring Soon (7 days)</option>
                  <option value="temporary">Has Expiration Date</option>
                  <option value="permanent">No Expiration</option>
                </select>
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedProducts.size > 0 && (
        <div className="mb-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">
              {selectedProducts.size} product(s) selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkUnfeature}
              disabled={bulkActionLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              {bulkActionLoading ? 'Unfeaturing...' : 'Unfeature Selected'}
            </button>
            <button
              onClick={() => setSelectedProducts(new Set())}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Featured Products Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            All Featured Products ({total})
          </h2>
          <button
            onClick={toggleSelectAll}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
          >
            {selectedProducts.size === products.length ? (
              <><CheckSquare className="w-4 h-4" /> Deselect All</>
            ) : (
              <><Square className="w-4 h-4" /> Select All</>
            )}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={selectedProducts.size === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Featured Since
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className={`hover:bg-gray-50 ${selectedProducts.has(product.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.id)}
                      onChange={() => toggleSelectProduct(product.id)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 bg-gray-100 rounded flex-shrink-0">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            fill
                            className="object-cover rounded"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            <Eye className="w-5 h-5" />
                          </div>
                        )}
                        <div className="absolute -top-1 -right-1">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate max-w-xs">
                          {product.title || product.name}
                        </p>
                        {product.brand && (
                          <p className="text-xs text-gray-500">{product.brand}</p>
                        )}
                        <p className="text-sm text-gray-600">
                          ${(product.price_cents / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {product.tenants.name}
                        </p>
                        <p className="text-xs text-gray-500">{product.tenant_id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getTierColor(product.tenants.subscription_tier)}`}>
                      {product.tenants.subscription_tier}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {updatingPriority === product.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          defaultValue={product.featured_priority}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            e.target.nextElementSibling!.textContent = value.toString();
                          }}
                          onMouseUp={(e) => {
                            const value = parseInt((e.target as HTMLInputElement).value);
                            handlePriorityUpdate(product.id, product.tenant_id, value);
                          }}
                          className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        <span className="text-sm font-medium text-gray-900 w-8">
                          {product.featured_priority}
                        </span>
                        <button
                          onClick={() => setUpdatingPriority(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-amber-500 h-2 rounded-full"
                            style={{ width: `${product.featured_priority}%` }}
                          ></div>
                        </div>
                        <button
                          onClick={() => setUpdatingPriority(product.id)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                          title="Click to adjust priority"
                        >
                          {product.featured_priority}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(product.featured_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {product.featured_until ? (
                      <span className={
                        new Date(product.featured_until) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                          ? 'text-red-600 font-medium'
                          : ''
                      }>
                        {formatDate(product.featured_until)}
                      </span>
                    ) : (
                      <span className="text-gray-400">Never</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/products/${product.id}`}
                        target="_blank"
                        className="text-blue-600 hover:text-blue-800"
                        title="View product"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/t/${product.tenant_id}/items/${product.id}`}
                        target="_blank"
                        className="text-gray-600 hover:text-gray-800"
                        title="View in tenant dashboard"
                      >
                        <Store className="w-4 h-4" />
                      </Link>
                      {confirmUnfeature === product.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUnfeature(product.id, product.tenant_id)}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
                            title="Confirm unfeature"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmUnfeature(null)}
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmUnfeature(product.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Unfeature this product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Enhanced Pagination */}
        {total > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Results Info */}
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{startItem}</span> to{' '}
                <span className="font-semibold text-gray-900">{endItem}</span> of{' '}
                <span className="font-semibold text-gray-900">{total}</span> product{total !== 1 ? 's' : ''}
                {hasActiveFilters && <span className="text-blue-600 font-medium"> (filtered)</span>}
              </div>

              {/* Page Navigation */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  {/* Previous Button */}
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="p-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Page Numbers */}
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 7) {
                        pageNum = i;
                      } else if (page < 3) {
                        pageNum = i;
                      } else if (page > totalPages - 4) {
                        pageNum = totalPages - 7 + i;
                      } else {
                        pageNum = page - 3 + i;
                      }

                      if (pageNum < 0 || pageNum >= totalPages) return null;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`min-w-[2.5rem] px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            page === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    })}
                  </div>

                  {/* Mobile: Current Page Indicator */}
                  <div className="sm:hidden px-3 py-2 text-sm font-medium text-gray-700">
                    Page {page + 1} of {totalPages}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="p-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {products.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
          <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {hasActiveFilters ? 'No Products Match Filters' : 'No Featured Products Yet'}
          </h3>
          <p className="text-gray-600">
            {hasActiveFilters 
              ? 'Try adjusting your filters to see more results'
              : 'Featured products will appear here once tenants start featuring their products'
            }
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
