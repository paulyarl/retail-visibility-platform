'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, Edit2, Trash2, GripVertical, Save, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

interface PlatformCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  google_category_id: string | null;
  icon_emoji: string;
  sort_order: number;
  level: number;
  parent_id: string | null;
  is_active: boolean;
  store_count: number;
  product_count: number;
  listing_count: number;
  avg_rating: number;
  created_at: string;
  updated_at: string;
}

// Preset icon gallery organized by category type
const PRESET_ICONS = {
  'Food & Beverage': ['🥬', '🥩', '🥛', '🧊', '🥖', '🥫', '🍿', '🥤', '🍎', '🥕', '🧀', '🍞'],
  'Retail & Shopping': ['👕', '👟', '📱', '🪑', '🔧', '🛍️', '🎁', '💍', '👜', '🕶️', '⌚', '🎨'],
  'Health & Beauty': ['💊', '💄', '🧴', '🏥', '💅', '🧼', '🪥', '🧽', '🩺', '💆', '🧖', '💇'],
  'Home & Garden': ['🏠', '🪴', '🛋️', '🛏️', '🚿', '🧹', '🧺', '🔨', '🪛', '🌱', '🌻', '🌿'],
  'Pets & Animals': ['🐾', '🐕', '🐈', '🐦', '🐠', '🦴', '🎾', '🐕‍🦺', '🐩', '🐈‍⬛', '🦜', '🐹'],
  'Baby & Kids': ['👶', '🍼', '🧸', '👼', '🎈', '🎀', '🧷', '👣', '🎪', '🎠', '🧩', '🪀'],
  'Sports & Outdoors': ['⚽', '🏀', '🎾', '⛳', '🏋️', '🚴', '🏃', '🎿', '🏊', '🧗', '🎣', '⛺'],
  'Electronics & Tech': ['💻', '📱', '🖥️', '⌨️', '🖱️', '🎮', '📷', '🎧', '📺', '⌚', '💾', '🔌'],
  'Books & Media': ['📚', '📖', '📰', '🎬', '🎵', '🎤', '🎸', '🎹', '📻', '📀', '🎭', '🖼️'],
  'Services': ['✂️', '🔑', '🔧', '🔨', '🪛', '🧰', '🛠️', '⚙️', '🔩', '⚡', '💡', '🔦'],
  'Other': ['📦', '🏪', '🏬', '🏢', '🏭', '🏗️', '🏛️', '⭐', '✨', '💫', '🎯', '🎪'],
};

export default function PlatformCategoriesPage() {
  const [categories, setCategories] = useState<PlatformCategory[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<PlatformCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PlatformCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const [gbpSearch, setGbpSearch] = useState('');
  const [gbpResults, setGbpResults] = useState<Array<{ id: string; name: string; description?: string; icon_emoji?: string }>>([]);
  const [gbpLoading, setGbpLoading] = useState(false);
  const [selectedGbpCategories, setSelectedGbpCategories] = useState<Set<string>>(new Set());
  
  // Pagination and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    googleCategoryId: '',
    iconEmoji: '📦',
    sortOrder: 999,
    level: 0,
    parentId: '',
    isActive: true,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  // Filter and search effect
  useEffect(() => {
    let filtered = categories;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(cat => 
        cat.name.toLowerCase().includes(query) ||
        cat.slug.toLowerCase().includes(query) ||
        cat.description?.toLowerCase().includes(query) ||
        cat.google_category_id?.toLowerCase().includes(query)
      );
    }
    
    setFilteredCategories(filtered);
    setCurrentPage(1); // Reset to first page when search changes
  }, [categories, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCategories = filteredCategories.slice(startIndex, endIndex);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/platform-categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data.categories);
      } else {
        throw new Error('Failed to load categories');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      googleCategoryId: '',
      iconEmoji: '📦',
      sortOrder: (categories.length + 1) * 10,
      level: 0,
      parentId: '',
      isActive: true,
    });
    setShowModal(true);
  };

  const searchGbpCategories = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setGbpResults([]);
      return;
    }
    
    setGbpLoading(true);
    try {
      // Load seed file and filter
      const response = await fetch('/api/platform/categories/gbp-seed');
      if (response.ok) {
        const data = await response.json();
        const allCategories = data.categories || [];
        const filtered = allCategories.filter((cat: any) =>
          cat.name.toLowerCase().includes(query.toLowerCase())
        );
        // Show all results (no limit) - admins can handle large result sets
        setGbpResults(filtered);
      }
    } catch (error) {
      console.error('Failed to search GBP categories:', error);
    } finally {
      setGbpLoading(false);
    }
  };

  const toggleGbpSelection = (id: string) => {
    const newSelected = new Set(selectedGbpCategories);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedGbpCategories(newSelected);
  };

  const handleImportSelected = async () => {
    if (selectedGbpCategories.size === 0) return;
    
    const selected = gbpResults.filter(cat => selectedGbpCategories.has(cat.id));
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const category of selected) {
      try {
        const slug = category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        
        const response = await api.post('/api/platform/categories', {
          name: category.name,
          slug,
          googleCategoryId: category.id,
          description: category.description || '',
          icon_emoji: category.icon_emoji || '📦',
        });
        
        if (response.ok) {
          successCount++;
        } else {
          const data = await response.json();
          if (data.error === 'duplicate_slug') {
            skippedCount++; // Already exists, skip silently
          } else {
            errorCount++;
          }
        }
      } catch (error) {
        errorCount++;
      }
    }
    
    await loadCategories();
    setShowBulkImportModal(false);
    setGbpSearch('');
    setGbpResults([]);
    setSelectedGbpCategories(new Set());
    
    // Build success message
    const messages = [];
    if (successCount > 0) {
      messages.push(`✅ Imported ${successCount} ${successCount === 1 ? 'category' : 'categories'}`);
    }
    if (skippedCount > 0) {
      messages.push(`⏭️ Skipped ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'}`);
    }
    if (errorCount > 0) {
      messages.push(`❌ ${errorCount} failed`);
    }
    
    if (messages.length > 0) {
      alert(messages.join('\n'));
    } else {
      alert('No categories were imported.');
    }
  };

  const handleBulkImport = async (source: 'default' | 'custom' = 'default') => {
    try {
      setBulkImporting(true);
      setImportResults(null);
      
      const response = await api.post('/api/platform/categories/bulk-import', {
        source,
      });
      
      if (response.ok) {
        const data = await response.json();
        setImportResults(data.import_results);
        await loadCategories();
      } else {
        throw new Error('Failed to import categories');
      }
    } catch (err) {
      alert('Failed to import categories: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setBulkImporting(false);
    }
  };

  const handleEdit = (category: PlatformCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      googleCategoryId: category.google_category_id || '',
      iconEmoji: category.icon_emoji,
      sortOrder: category.sort_order,
      level: category.level,
      parentId: category.parent_id || '',
      isActive: category.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const payload = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        googleCategoryId: formData.googleCategoryId || null,
        iconEmoji: formData.iconEmoji,
        sortOrder: formData.sortOrder,
        level: formData.level,
        parentId: formData.parentId || null,
        isActive: formData.isActive,
      };

      const response = editingCategory
        ? await api.patch(`/api/admin/platform-categories/${editingCategory.id}`, payload)
        : await api.post('/api/admin/platform-categories', payload);

      if (response.ok) {
        await loadCategories();
        setShowModal(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save category');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: PlatformCategory) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"?${category.listing_count > 0 ? `\n\nThis category is used by ${category.listing_count} listings and will be archived instead of deleted.` : ''}`)) {
      return;
    }

    try {
      const response = await api.delete(`/api/admin/platform-categories/${category.id}`);
      if (response.ok) {
        await loadCategories();
      } else {
        throw new Error('Failed to delete category');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newCategories = [...categories];
    const draggedItem = newCategories[draggedIndex];
    newCategories.splice(draggedIndex, 1);
    newCategories.splice(index, 0, draggedItem);

    setCategories(newCategories);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    try {
      setReordering(true);
      const categoryIds = categories.map(c => c.id);
      
      const response = await api.post('/api/admin/platform-categories/reorder', {
        categoryIds,
      });

      if (response.ok) {
        await loadCategories(); // Reload to get updated sort_order values
      } else {
        throw new Error('Failed to save order');
      }
    } catch (err) {
      alert('Failed to save category order');
      await loadCategories(); // Reload original order
    } finally {
      setDraggedIndex(null);
      setReordering(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <PageHeader
        title="Directory Categories"
        description="Manage business categories for the directory - sourced from Google Business Profile"
      />

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Stats Summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Categories</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{categories.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Active</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {categories.filter(c => c.is_active).length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Stores</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {categories.reduce((sum, c) => sum + parseInt(String(c.store_count || 0)), 0)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Products</div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {categories.reduce((sum, c) => sum + parseInt(String(c.product_count || 0)), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="mt-6 space-y-4">
        {/* Search Bar */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories by name, slug, description..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-2">
          <button
            onClick={() => setShowBulkImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            📥 Bulk Import
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>
        </div>
        
        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {searchQuery ? (
              <>
                Showing {filteredCategories.length} of {categories.length} categories
                {filteredCategories.length > 0 && ` (page ${currentPage} of ${totalPages})`}
              </>
            ) : (
              <>
                {categories.length} {categories.length === 1 ? 'category' : 'categories'}
                {categories.length > 0 && ` (page ${currentPage} of ${totalPages})`}
              </>
            )}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      {/* Categories Table */}
      <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stores
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Products
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedCategories.map((category, index) => (
                <tr 
                  key={category.id} 
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    draggedIndex === index ? 'opacity-50' : ''
                  } ${reordering ? 'pointer-events-none' : ''}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {category.sort_order}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{category.icon_emoji}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {category.name}
                        </div>
                        {category.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {category.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {category.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {category.store_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {category.product_count.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        category.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {category.is_active ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
                        className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedCategories.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'No categories found matching your search.' : 'No categories yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredCategories.length)} of {filteredCategories.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (!editingCategory) {
                        setFormData({ ...formData, name: e.target.value, slug: generateSlug(e.target.value) });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Fresh Produce"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Slug *
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="fresh-produce"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    URL-friendly identifier (lowercase, hyphens only)
                  </p>
                </div>

                {/* Icon Emoji */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Icon Emoji
                  </label>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                      <span className="text-2xl">{formData.iconEmoji}</span>
                      <input
                        type="text"
                        value={formData.iconEmoji}
                        onChange={(e) => setFormData({ ...formData, iconEmoji: e.target.value })}
                        className="flex-1 bg-transparent text-gray-900 dark:text-white focus:outline-none"
                        placeholder="🥬"
                        maxLength={2}
                      />
                    </div>
                  </div>
                  
                  {/* Preset Icon Gallery */}
                  <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
                    {Object.entries(PRESET_ICONS).map(([category, icons]) => (
                      <div key={category}>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                          {category}
                        </div>
                        <div className="grid grid-cols-12 gap-1">
                          {icons.map((icon, index) => (
                            <button
                              key={`${category}-${index}`}
                              type="button"
                              onClick={() => setFormData({ ...formData, iconEmoji: icon })}
                              className={`w-8 h-8 flex items-center justify-center text-xl rounded hover:bg-white dark:hover:bg-gray-700 transition-colors ${
                                formData.iconEmoji === icon
                                  ? 'bg-primary-100 dark:bg-primary-900 ring-2 ring-primary-500'
                                  : 'bg-white dark:bg-gray-800'
                              }`}
                              title={icon}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Click an icon to select it, or type your own emoji
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Fresh fruits and vegetables"
                  />
                </div>

                {/* Google Category ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Google Category ID
                  </label>
                  <input
                    type="text"
                    value={formData.googleCategoryId}
                    onChange={(e) => setFormData({ ...formData, googleCategoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="gcid:2890"
                  />
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Lower numbers appear first
                  </p>
                </div>

                {/* Active Status */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                    Active (visible to stores)
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.name || !formData.slug}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header - Sticky */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  📥 Bulk Import Categories
                </h3>
                <button
                  onClick={() => {
                    setShowBulkImportModal(false);
                    setImportResults(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Search Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Search Google Business Profile Categories
                  </label>
                  <input
                    type="text"
                    value={gbpSearch}
                    onChange={(e) => {
                      setGbpSearch(e.target.value);
                      searchGbpCategories(e.target.value);
                    }}
                    placeholder="e.g., grocery, pharmacy, pet store..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Loading State */}
                {gbpLoading && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    Searching...
                  </div>
                )}

                {/* Search Results */}
                {!gbpLoading && gbpResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedGbpCategories.size} selected of {gbpResults.length} results
                      </div>
                      <div className="flex gap-2">
                        {selectedGbpCategories.size > 0 && (
                          <button
                            onClick={() => {
                              const newSelected = new Set(selectedGbpCategories);
                              gbpResults.forEach(cat => newSelected.delete(cat.id));
                              setSelectedGbpCategories(newSelected);
                            }}
                            className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            Deselect All
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const newSelected = new Set(selectedGbpCategories);
                            gbpResults.forEach(cat => newSelected.add(cat.id));
                            setSelectedGbpCategories(newSelected);
                          }}
                          className="px-3 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                        >
                          Select All ({gbpResults.length})
                        </button>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                      {gbpResults.map((result) => (
                        <div
                          key={result.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedGbpCategories.has(result.id)
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                          onClick={() => toggleGbpSelection(result.id)}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={selectedGbpCategories.has(result.id)}
                              onChange={() => {}}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">{result.name}</div>
                              {result.description && (
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {result.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!gbpLoading && gbpSearch.length >= 2 && gbpResults.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No categories found. Try a different search term.
                  </div>
                )}

                {/* Initial State */}
                {gbpSearch.length < 2 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="mb-2">Enter at least 2 characters to search</p>
                    <p className="text-xs">Search from 25 GBP business type categories</p>
                  </div>
                )}

                {/* Help Text */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    💡 About GBP Categories
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    These business type categories are sourced from Google Business Profile. 
                    They represent what type of business stores ARE (Grocery Store, Pharmacy, Pet Store, etc.).
                  </p>
                </div>

                {/* Categories Preview (when no search) */}
                {gbpSearch.length === 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Available Categories (25):
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <span>🛒</span>
                        <span>Grocery Store</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>🏪</span>
                        <span>Supermarket</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>💊</span>
                        <span>Pharmacy</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>🐾</span>
                        <span>Pet Store</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>👕</span>
                        <span>Clothing Store</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>👟</span>
                        <span>Shoe Store</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>📱</span>
                        <span>Electronics Store</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>🛋️</span>
                        <span>Furniture Store</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>🔧</span>
                        <span>Hardware Store</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>💄</span>
                        <span>Beauty Supply Store</span>
                      </li>
                      <li className="text-gray-500 dark:text-gray-400">
                        ... and 15 more business types
                      </li>
                    </ul>
                  </div>
                  </div>
                )}

                {/* Warning */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    ⚠️ <strong>Note:</strong> Duplicate categories (same slug) will be skipped automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer - Sticky */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowBulkImportModal(false);
                    setGbpSearch('');
                    setGbpResults([]);
                    setSelectedGbpCategories(new Set());
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportSelected}
                  disabled={selectedGbpCategories.size === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {selectedGbpCategories.size > 0 ? `(${selectedGbpCategories.size})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
