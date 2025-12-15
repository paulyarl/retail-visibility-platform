'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Search, 
  Grid3X3, 
  List, 
  Trash2, 
  Edit, 
  Image as ImageIcon,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Star,
  TrendingUp,
  Database,
  Loader2
} from 'lucide-react';
import { Button, Input, ConfirmDialog } from '@/components/ui';
import { apiRequest } from '@/lib/api';

interface CachedProduct {
  id: string;
  businessType: string;
  categoryName: string;
  googleCategoryId: string | null;
  productName: string;
  priceCents: number;
  brand: string | null;
  description: string | null;
  skuPattern: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  enhancedDescription: string | null;
  features: any;
  specifications: any;
  generationSource: string;
  hasImage: boolean;
  imageQuality: string | null;
  usageCount: number;
  qualityScore: number | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface FilterOption {
  value: string;
  count: number;
}

export default function CachedProductsClient() {
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Filters
  const [search, setSearch] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [hasImageFilter, setHasImageFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('usage_count');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Filter options from API
  const [businessTypes, setBusinessTypes] = useState<FilterOption[]>([]);
  const [categories, setCategories] = useState<FilterOption[]>([]);
  
  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Modals
  const [editingProduct, setEditingProduct] = useState<CachedProduct | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; ids: string[] }>({ isOpen: false, ids: [] });
  
  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
      });
      
      if (search) params.set('search', search);
      if (businessType) params.set('businessType', businessType);
      if (categoryName) params.set('categoryName', categoryName);
      if (hasImageFilter) params.set('hasImage', hasImageFilter);
      
      const response = await apiRequest(`/api/admin/cached-products?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch cached products');
      }
      
      const data = await response.json();
      
      setProducts(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 0);
      setBusinessTypes(data.filters?.businessTypes || []);
      setCategories(data.filters?.categories || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, businessType, categoryName, hasImageFilter, sortBy, sortOrder]);
  
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);
  
  // Delete products
  const handleDelete = async (ids: string[]) => {
    try {
      if (ids.length === 1) {
        await apiRequest(`/api/admin/cached-products/${ids[0]}`, { method: 'DELETE' });
      } else {
        await apiRequest('/api/admin/cached-products/bulk', {
          method: 'DELETE',
          body: JSON.stringify({ ids }),
        });
      }
      
      setSelectedIds(new Set());
      fetchProducts();
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  // Toggle selection
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };
  
  // Select all on current page
  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };
  
  // Format price
  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };
  
  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Cached Products
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage Quick Start product cache • {total.toLocaleString()} products
              </p>
            </div>
          </div>
        </div>
        
        {/* Filters Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            {/* Business Type Filter */}
            <select
              value={businessType}
              onChange={(e) => { setBusinessType(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Business Types</option>
              {businessTypes.map(bt => (
                <option key={bt.value} value={bt.value}>
                  {bt.value} ({bt.count})
                </option>
              ))}
            </select>
            
            {/* Category Filter */}
            <select
              value={categoryName}
              onChange={(e) => { setCategoryName(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.value} ({cat.count})
                </option>
              ))}
            </select>
            
            {/* Has Image Filter */}
            <select
              value={hasImageFilter}
              onChange={(e) => { setHasImageFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Images</option>
              <option value="true">With Images</option>
              <option value="false">Without Images</option>
            </select>
            
            {/* Sort */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order as 'asc' | 'desc');
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="usage_count-desc">Most Used</option>
              <option value="usage_count-asc">Least Used</option>
              <option value="quality_score-desc">Highest Quality</option>
              <option value="quality_score-asc">Lowest Quality</option>
              <option value="created_at-desc">Newest</option>
              <option value="created_at-asc">Oldest</option>
              <option value="product_name-asc">Name A-Z</option>
              <option value="product_name-desc">Name Z-A</option>
            </select>
            
            {/* View Toggle */}
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-purple-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-purple-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            
            {/* Refresh */}
            <button
              onClick={fetchProducts}
              disabled={loading}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => setConfirmDelete({ isOpen: true, ids: Array.from(selectedIds) })}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
        
        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        )}
        
        {/* Empty State */}
        {!loading && products.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No cached products found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Products will appear here after Quick Start generates them.
            </p>
          </div>
        )}
        
        {/* Grid View */}
        {!loading && products.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {products.map(product => (
              <div
                key={product.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 transition-all ${
                  selectedIds.has(product.id)
                    ? 'border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {/* Image */}
                <div className="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-t-xl overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.productName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Selection checkbox */}
                  <button
                    onClick={() => toggleSelect(product.id)}
                    className={`absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                      selectedIds.has(product.id)
                        ? 'bg-purple-500 border-purple-500 text-white'
                        : 'bg-white/80 border-gray-300 hover:border-purple-400'
                    }`}
                  >
                    {selectedIds.has(product.id) && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  
                  {/* Badges */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1">
                    {product.hasImage && (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                        📷
                      </span>
                    )}
                    {product.usageCount > 0 && (
                      <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                        {product.usageCount}×
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">
                    {product.businessType} › {product.categoryName}
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white truncate mb-1">
                    {product.productName}
                  </h3>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {product.brand || 'No brand'}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatPrice(product.priceCents)}
                    </span>
                  </div>
                  
                  {/* Quality Score */}
                  {product.qualityScore !== null && (
                    <div className="mt-2 flex items-center gap-1">
                      <Star className={`w-3 h-3 ${product.qualityScore >= 0 ? 'text-yellow-500' : 'text-gray-400'}`} />
                      <span className="text-xs text-gray-500">
                        {product.qualityScore.toFixed(1)}
                      </span>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                    <button
                      onClick={() => setEditingProduct(product)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ isOpen: true, ids: [product.id] })}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* List View */}
        {!loading && products.length > 0 && viewMode === 'list' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === products.length && products.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Usage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quality</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Image</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {products.map(product => (
                  <tr key={product.id} className={selectedIds.has(product.id) ? 'bg-purple-50 dark:bg-purple-900/20' : ''}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{product.productName}</div>
                          <div className="text-xs text-gray-500">{product.brand || 'No brand'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 dark:text-white">{product.businessType}</div>
                      <div className="text-xs text-gray-500">{product.categoryName}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {formatPrice(product.priceCents)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                        <TrendingUp className="w-3 h-3" />
                        {product.usageCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {product.qualityScore !== null && (
                        <span className={`inline-flex items-center gap-1 text-xs ${product.qualityScore >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <Star className="w-3 h-3" />
                          {product.qualityScore.toFixed(1)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {product.hasImage ? (
                        <span className="text-green-500">✓</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingProduct(product)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ isOpen: true, ids: [product.id] })}
                          className="p-1.5 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, ids: [] })}
        onConfirm={() => {
          handleDelete(confirmDelete.ids);
          setConfirmDelete({ isOpen: false, ids: [] });
        }}
        title="Delete Cached Products"
        message={`Are you sure you want to delete ${confirmDelete.ids.length} cached product${confirmDelete.ids.length > 1 ? 's' : ''}? This action cannot be undone.`}
        variant="danger"
      />
      
      {/* Edit Modal */}
      {editingProduct && (
        <EditCachedProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={() => {
            setEditingProduct(null);
            fetchProducts();
          }}
        />
      )}
    </div>
  );
}

// Edit Modal Component
function EditCachedProductModal({
  product,
  onClose,
  onSave,
}: {
  product: CachedProduct;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    product_name: product.productName,
    price_cents: product.priceCents,
    brand: product.brand || '',
    description: product.description || '',
    quality_score: product.qualityScore || 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const response = await apiRequest(`/api/admin/cached-products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update product');
      }
      
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Cached Product</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product Name
            </label>
            <input
              type="text"
              value={formData.product_name}
              onChange={(e) => setFormData(f => ({ ...f, product_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price (cents)
              </label>
              <input
                type="number"
                value={formData.price_cents}
                onChange={(e) => setFormData(f => ({ ...f, price_cents: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Brand
              </label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData(f => ({ ...f, brand: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quality Score (-1 to 1)
            </label>
            <input
              type="number"
              step="0.1"
              min="-1"
              max="1"
              value={formData.quality_score}
              onChange={(e) => setFormData(f => ({ ...f, quality_score: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          {/* Read-only info */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Business Type:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{product.businessType}</span>
              </div>
              <div>
                <span className="text-gray-500">Category:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{product.categoryName}</span>
              </div>
              <div>
                <span className="text-gray-500">Usage Count:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{product.usageCount}</span>
              </div>
              <div>
                <span className="text-gray-500">Has Image:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{product.hasImage ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
