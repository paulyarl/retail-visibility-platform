'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Modal, ModalFooter, Input, Pagination } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  createdAt?: string;
}

export default function TenantCategoriesPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.tenantId as string;
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [taxonomySearch, setTaxonomySearch] = useState('');
  const [taxonomyResults, setTaxonomyResults] = useState<Array<{ id: string; name: string; path: string[] }>>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  const [selectedTaxonomies, setSelectedTaxonomies] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showQuickStartModal, setShowQuickStartModal] = useState(false);
  const [quickStartType, setQuickStartType] = useState<'grocery' | 'fashion' | 'electronics' | 'general'>('general');
  const [quickStartCount, setQuickStartCount] = useState(15);
  const [quickStartLoading, setQuickStartLoading] = useState(false);
  const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  const apiUrl = (path: string) => `${API_BASE}${path}`;

  useEffect(() => {
    loadCategories();
  }, [tenantId]);

  // Filter and paginate categories
  const filteredCategories = categories.filter(cat => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return cat.name.toLowerCase().includes(query) || cat.id.toLowerCase().includes(query);
  });

  const totalPages = Math.ceil(filteredCategories.length / pageSize);
  const paginatedCategories = filteredCategories.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const loadCategories = async () => {
    try {
      const res = await api.get(`/api/v1/tenants/${tenantId}/categories`);
      const data = await res.json();
      console.log('[Load Categories] Response:', data);
      const categories = data.success ? data.data : (Array.isArray(data) ? data : []);
      console.log('[Load Categories] Parsed categories:', categories);
      setCategories(categories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!categoryName.trim()) return;
    
    try {
      // Generate slug from name
      const slug = categoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      const res = await api.post(`/api/v1/tenants/${tenantId}/categories`, {
        name: categoryName,
        slug,
      });
      
      if (res.ok) {
        await loadCategories();
        setShowCreateModal(false);
        setCategoryName('');
      } else {
        const data = await res.json();
        if (data.error?.includes('slug already exists')) {
          alert(`Category already exists: A category with this name already exists`);
        } else {
          alert(`Failed to create category: ${data.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Failed to create category:', error);
      alert('Failed to create category. Please try again.');
    }
  };

  const handleEdit = async () => {
    if (!selectedCategory || !categoryName.trim()) return;
    
    try {
      const res = await api.patch(`/api/v1/tenants/${tenantId}/categories/${selectedCategory.id}`, {
        name: categoryName,
      });
      
      if (res.ok) {
        await loadCategories();
        setShowEditModal(false);
        setSelectedCategory(null);
        setCategoryName('');
      }
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    
    try {
      const res = await api.delete(`/api/v1/tenants/${tenantId}/categories/${selectedCategory.id}`);
      
      if (res.ok || res.status === 204) {
        await loadCategories();
        setShowDeleteModal(false);
        setSelectedCategory(null);
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const openEditModal = (category: Category) => {
    setSelectedCategory(category);
    setCategoryName(category.name);
    setShowEditModal(true);
  };

  const openDeleteModal = (category: Category) => {
    setSelectedCategory(category);
    setShowDeleteModal(true);
  };

  const searchTaxonomy = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setTaxonomyResults([]);
      return;
    }
    
    setTaxonomyLoading(true);
    try {
      const res = await fetch(`/api/categories/search?q=${encodeURIComponent(query)}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        console.log('[Search Taxonomy] Response:', data);
        setTaxonomyResults(data.results || data.categories || []);
      }
    } catch (error) {
      console.error('Failed to search taxonomy:', error);
    } finally {
      setTaxonomyLoading(false);
    }
  };

  const toggleTaxonomySelection = (id: string) => {
    const newSelected = new Set(selectedTaxonomies);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTaxonomies(newSelected);
  };

  const handleImportSelected = async () => {
    if (selectedTaxonomies.size === 0) return;
    
    const selected = taxonomyResults.filter(t => selectedTaxonomies.has(t.id));
    let successCount = 0;
    let errorCount = 0;
    
    for (const taxonomy of selected) {
      try {
        // Generate slug from the last part of the path (the actual category name)
        const name = taxonomy.path[taxonomy.path.length - 1];
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        
        const res = await api.post(`/api/v1/tenants/${tenantId}/categories`, {
          name,
          slug,
          googleCategoryId: taxonomy.id,
        });
        
        if (res.ok) {
          successCount++;
        } else {
          const data = await res.json();
          if (!data.error?.includes('slug already exists')) {
            errorCount++;
          }
          // Silently skip duplicates
        }
      } catch (error) {
        errorCount++;
      }
    }
    
    await loadCategories();
    setShowImportModal(false);
    setTaxonomySearch('');
    setTaxonomyResults([]);
    setSelectedTaxonomies(new Set());
    
    if (successCount > 0) {
      alert(`Successfully imported ${successCount} ${successCount === 1 ? 'category' : 'categories'}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
    } else if (errorCount > 0) {
      alert(`Failed to import categories. They may already exist.`);
    }
  };

  const handleQuickStart = async () => {
    setQuickStartLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/categories/quick-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessType: quickStartType,
          categoryCount: quickStartCount,
        }),
        credentials: 'include',
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('[Quick Start] Response:', data);
        await loadCategories();
        setShowQuickStartModal(false);
        const createdCount = data.categoriesCreated || 0;
        const totalCount = data.data?.length || 0;
        alert(`Successfully created ${createdCount} new categories! (${totalCount} total categories)`);
      } else {
        const data = await res.json();
        alert(`Failed to generate categories: ${data.message || data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[Quick Start] Error:', error);
      alert('Failed to generate categories. Please try again.');
    } finally {
      setQuickStartLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader
          title="Product Category Management"
          description="Loading..."
          icon={Icons.Settings}
          backLink={{ href: `/t/${tenantId}`, label: 'Back to Dashboard' }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="Product Category Management"
        description="Manage your product categories and sync to Google Business Profile"
        icon={Icons.Settings}
        backLink={{ href: `/t/${tenantId}`, label: 'Back to Dashboard' }}
      />

      <div className="mt-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowQuickStartModal(true)}
            >
              ⚡ Quick Start
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowImportModal(true)}
            >
              📥 Import from Google
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
            >
              + Create Category
            </Button>
          </div>
        </div>

        {/* Categories List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Categories</CardTitle>
              <div className="w-64">
                <Input
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-500">No categories yet</p>
                <p className="text-sm text-neutral-400 mt-2">
                  Get started by importing from Google's 6000+ categories or creating your own
                </p>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-500">No categories match your search</p>
                <p className="text-sm text-neutral-400 mt-2">
                  Try a different search term
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {paginatedCategories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-lg mb-1">
                        <h3 className="font-bold text-primary-900 dark:text-primary-100">{category.name}</h3>
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">ID: {category.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditModal(category)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteModal(category)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredCategories.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              )}
            </>
            )}
          </CardContent>
        </Card>

        {/* Guide */}
        <Card>
          <CardHeader>
            <CardTitle>📚 Category Management Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              {/* What are Product Categories */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">💡 What are Product Categories?</h4>
                <p className="text-blue-800">
                  Product categories help organize your inventory and improve visibility in Google Business Profile and Google Merchant Center. 
                  These are different from <strong>business categories</strong> (which define what type of business you are).
                </p>
              </div>

              {/* Getting Started */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">🚀 Getting Started</h4>
                <ul className="list-disc list-inside space-y-1 text-green-800">
                  <li><strong>Quick Start:</strong> Get pre-selected categories for your business type (grocery, fashion, etc.)</li>
                  <li><strong>Import from Google:</strong> Search and select from 6000+ Google taxonomy categories</li>
                  <li><strong>Create Custom:</strong> Add your own categories for unique products</li>
                </ul>
              </div>

              {/* Best Practices */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">✅ Best Practices</h4>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>Start with <strong>Quick Start</strong> to get a solid foundation</li>
                  <li>Use <strong>Google categories</strong> when possible for better SEO</li>
                  <li>Keep category names <strong>clear and specific</strong></li>
                  <li>Organize products into categories to improve customer browsing</li>
                </ul>
              </div>

              {/* Distinction */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <h4 className="font-semibold text-neutral-900 mb-2">🔍 Category Types Explained</h4>
                <div className="space-y-3 text-neutral-700">
                  <div>
                    <strong className="text-blue-700">Product Categories</strong> (This Page):
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>Organize products/services (e.g., "Hot Coffee", "Pastries")</li>
                      <li>Unlimited categories</li>
                      <li>Syncs to GBP for product visibility</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-purple-700">Business Categories</strong> (Different Page):
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>Define business type (e.g., "Coffee Shop", "Restaurant")</li>
                      <li>1 primary + ~9 additional max</li>
                      <li>Managed at Settings → Google Business Profile</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCategoryName('');
        }}
        title="Create Category"
        description="Add a new product category"
      >
        <div className="space-y-4">
          <Input
            label="Category Name"
            placeholder="Enter category name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreateModal(false);
              setCategoryName('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!categoryName.trim()}
          >
            Create Category
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedCategory(null);
          setCategoryName('');
        }}
        title="Edit Category"
        description={selectedCategory ? `Update ${selectedCategory.name}` : ''}
      >
        <div className="space-y-4">
          <Input
            label="Category Name"
            placeholder="Enter category name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleEdit()}
          />
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowEditModal(false);
              setSelectedCategory(null);
              setCategoryName('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleEdit}
            disabled={!categoryName.trim()}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedCategory(null);
        }}
        title="Delete Category"
        description={selectedCategory ? `Are you sure you want to delete "${selectedCategory.name}"?` : ''}
      >
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowDeleteModal(false);
              setSelectedCategory(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
          >
            Delete Category
          </Button>
        </ModalFooter>
      </Modal>

      {/* Import from Google Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setTaxonomySearch('');
          setTaxonomyResults([]);
          setSelectedTaxonomies(new Set());
        }}
        title="📥 Import from Google Taxonomy"
        description="Search and import from 6000+ Google product categories"
      >
        <div className="space-y-4">
          <Input
            label="Search Google Categories"
            placeholder="e.g., coffee, electronics, clothing..."
            value={taxonomySearch}
            onChange={(e) => {
              setTaxonomySearch(e.target.value);
              searchTaxonomy(e.target.value);
            }}
          />
          
          {taxonomyLoading && (
            <div className="text-center py-4">
              <p className="text-sm text-neutral-500">Searching...</p>
            </div>
          )}
          
          {taxonomyResults.length > 0 && (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {taxonomyResults.map((result) => (
                <div
                  key={result.id}
                  className="flex items-start gap-3 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer"
                  onClick={() => toggleTaxonomySelection(result.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedTaxonomies.has(result.id)}
                    onChange={() => toggleTaxonomySelection(result.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-neutral-900">{result.name}</p>
                    <p className="text-xs text-neutral-500">{result.path.join(' > ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {taxonomySearch.length >= 2 && !taxonomyLoading && taxonomyResults.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-neutral-500">No categories found. Try a different search term.</p>
            </div>
          )}
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowImportModal(false);
              setTaxonomySearch('');
              setTaxonomyResults([]);
              setSelectedTaxonomies(new Set());
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleImportSelected}
            disabled={selectedTaxonomies.size === 0}
          >
            Import {selectedTaxonomies.size > 0 ? `(${selectedTaxonomies.size})` : ''}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Quick Start Modal */}
      <Modal
        isOpen={showQuickStartModal}
        onClose={() => setShowQuickStartModal(false)}
        title="⚡ Quick Start: Generate Categories"
        description="Generate Google-aligned categories for your business type"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Business Type
            </label>
            <select
              value={quickStartType}
              onChange={(e) => setQuickStartType(e.target.value as any)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="general">General Retail (20 categories)</option>
              <option value="grocery">Grocery Store (15 categories)</option>
              <option value="fashion">Fashion Retail (12 categories)</option>
              <option value="electronics">Electronics Store (10 categories)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Number of Categories: {quickStartCount}
            </label>
            <input
              type="range"
              min="5"
              max="30"
              value={quickStartCount}
              onChange={(e) => setQuickStartCount(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => setShowQuickStartModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleQuickStart}
            disabled={quickStartLoading}
          >
            {quickStartLoading ? 'Generating...' : 'Generate Categories'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
