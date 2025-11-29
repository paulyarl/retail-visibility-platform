'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Modal, ModalFooter, Input, Pagination } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';

interface Category {
  id: string;
  name: string;
  createdAt?: string;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [mirrorLoading, setMirrorLoading] = useState(false);
  const [tenantIdInput, setTenantIdInput] = useState('');
  const [organizationIdInput, setOrganizationIdInput] = useState('');
  const [scope, setScope] = useState<'tenant' | 'organization' | 'platform'>('organization');
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastSummary, setLastSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [confirmWriteOpen, setConfirmWriteOpen] = useState(false);
  const [polling, setPolling] = useState(false);
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
  
  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.split(';').map(s => s.trim()).find(c => c.startsWith(name + '='));
    return match ? decodeURIComponent(match.split('=')[1] || '') : '';
  };
  
  // Get auth token from cookie (access_token or ACCESS_TOKEN)
  const getAuthHeader = (): Record<string, string> => {
    const token = getCookie('access_token') || getCookie('ACCESS_TOKEN');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    loadCategories();
  }, []);

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
      const res = await fetch('/api/platform/categories');
      const data = await res.json();
      console.log('[Load Categories] Response:', data);
      // API returns {success: true, data: [...]}
      const categories = data.success ? data.data : (Array.isArray(data) ? data : []);
      console.log('[Load Categories] Parsed categories:', categories);
      setCategories(categories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const pollUntilCompleted = async (jobId: string, maxMs = 8000, intervalMs = 500) => {
    setPolling(true);
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      await loadLastSummary();
      const done = (lastSummary && lastSummary.jobId === jobId && lastSummary.completedAt) ? true : false;
      if (done) break;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    setPolling(false);
  };

  const loadLastSummary = async () => {
    setSummaryLoading(true);
    try {
      const qs = new URLSearchParams();
      if (tenantIdInput.trim()) qs.set('tenantId', tenantIdInput.trim());
      qs.set('strategy', 'platform_to_gbp');
      const res = await fetch(apiUrl(`/api/admin/mirror/last-run?${qs.toString()}`), {
        method: 'GET',
        headers: { ...getAuthHeader() },
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      setLastSummary(data?.data ?? null);
    } catch (e) {
      setLastSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    // Auto-load summary when tenantId input changes
    loadLastSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantIdInput]);

  const handleCreate = async () => {
    if (!categoryName.trim()) return;
    
    try {
      // Generate slug from name
      const slug = categoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      const res = await fetch('/api/platform/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName, slug }),
      });
      
      if (res.ok) {
        await loadCategories();
        setShowCreateModal(false);
        setCategoryName('');
      } else {
        const data = await res.json();
        if (data.error === 'duplicate_slug') {
          alert(`Category already exists: ${data.message || 'A category with this name already exists'}`);
        } else {
          alert(`Failed to create category: ${data.message || data.error || 'Unknown error'}`);
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
      const res = await fetch(`/api/categories/${selectedCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName }),
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
      const res = await fetch(`/api/categories/${selectedCategory.id}`, {
        method: 'DELETE',
      });
      
      if (res.ok || res.status === 204) {
        await loadCategories();
        setShowDeleteModal(false);
        setSelectedCategory(null);
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const actuallyRunMirror = async () => {
    if (mirrorLoading) return;
    setMirrorLoading(true);
    setLastResult(null);
    try {
      const body: any = { strategy: 'platform_to_gbp', dryRun, scope };
      if (scope === 'tenant' && tenantIdInput.trim()) body.tenantId = tenantIdInput.trim();
      if (scope === 'organization' && organizationIdInput.trim()) body.organizationId = organizationIdInput.trim();
      if (scope === 'platform' && !confirm('⚠️ WARNING: This will affect ALL tenants across ALL organizations on the platform! Are you absolutely sure?')) {
        setMirrorLoading(false);
        return;
      }
      const csrf = getCookie('csrf');
      const res = await fetch(apiUrl('/api/categories/mirror'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...getAuthHeader() },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 202 && data && data.jobId) {
        setLastJobId(String(data.jobId));
        setLastResult(data);
        // brief poll for completion
        pollUntilCompleted(String(data.jobId)).catch(() => {});
      } else {
        setLastResult({ error: true, status: res.status, data });
      }
    } catch (e: any) {
      setLastResult({ error: true, message: e?.message || 'request_failed' });
    } finally {
      setMirrorLoading(false);
    }
  };

  const handleMirror = async () => {
    if (dryRun) {
      return actuallyRunMirror();
    }
    setConfirmWriteOpen(true);
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
        setTaxonomyResults(data.categories || []);
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
        
        const res = await fetch('/api/platform/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug }),
        });
        
        if (res.ok) {
          successCount++;
        } else {
          const data = await res.json();
          if (data.error !== 'duplicate_slug') {
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
      // Use platform tenant ID for platform-level categories
      const res = await fetch('/api/platform/categories/quick-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessType: quickStartType,
          categoryCount: quickStartCount,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('[Quick Start] Response:', data);
        await loadCategories();
        setShowQuickStartModal(false);
        const createdCount = data.categoriesCreated || 0;
        const totalCount = data.data?.length || 0;
        alert(`Successfully created ${createdCount} new categories! (${totalCount} total platform categories)`);
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
          backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="Product Category Management"
        description="Manage product categories for all tenants and sync to Google Business Profile"
        icon={Icons.Settings}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Sync Product Categories to Google Business Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Scope Selection */}
            <div className="mb-4 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">Scope</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="tenant"
                    checked={scope === 'tenant'}
                    onChange={(e) => setScope('tenant')}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Single Location</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="organization"
                    checked={scope === 'organization'}
                    onChange={(e) => setScope('organization')}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-semibold text-blue-700">Entire Organization/Chain (Recommended)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="platform"
                    checked={scope === 'platform'}
                    onChange={(e) => setScope('platform')}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-red-600">⚠️ All Tenants (Platform-Wide - Dangerous!)</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              {scope === 'organization' && (
                <div className="w-full sm:w-64">
                  <Input
                    label="Organization ID"
                    placeholder="org_..."
                    value={organizationIdInput}
                    onChange={(e) => setOrganizationIdInput(e.target.value)}
                  />
                </div>
              )}
              {scope === 'tenant' && (
                <div className="w-full sm:w-64">
                  <Input
                    label="Tenant ID"
                    placeholder="tenant_..."
                    value={tenantIdInput}
                    onChange={(e) => setTenantIdInput(e.target.value)}
                  />
                </div>
              )}
              {scope === 'platform' && (
                <div className="w-full p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm text-red-800 font-semibold">⚠️ WARNING: Platform-wide operations affect ALL organizations and tenants!</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  id="dryRunToggle"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                />
                <label htmlFor="dryRunToggle" className="text-sm">Dry Run</label>
              </div>
              <Button
                variant="primary"
                onClick={handleMirror}
                disabled={mirrorLoading}
              >
                {mirrorLoading ? 'Running…' : 'Mirror now'}
              </Button>
              <Button
                variant="secondary"
                onClick={loadLastSummary}
                disabled={summaryLoading}
              >
                {summaryLoading ? 'Refreshing…' : 'Refresh summary'}
              </Button>
            </div>
            {/* Scope Summary */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm font-semibold text-blue-900 mb-1">Scope Summary:</p>
              <p className="text-sm text-blue-800">
                {scope === 'tenant' && tenantIdInput && `Single location: ${tenantIdInput}`}
                {scope === 'tenant' && !tenantIdInput && 'Please enter a tenant ID'}
                {scope === 'organization' && organizationIdInput && `All locations in organization: ${organizationIdInput}`}
                {scope === 'organization' && !organizationIdInput && 'Please enter an organization ID'}
                {scope === 'platform' && '⚠️ ALL TENANTS ACROSS ALL ORGANIZATIONS (Platform-Wide)'}
              </p>
            </div>

            <div className="mt-4 flex items-center gap-3">
              {lastJobId && (
                <Badge variant="success">jobId: {lastJobId}</Badge>
              )}
              {lastResult?.error && (
                <Badge variant="error">error</Badge>
              )}
              {polling && (
                <Badge variant="info">updating…</Badge>
              )}
            </div>
            {lastSummary && (
              <div className="mt-3 text-sm text-neutral-700 space-y-1">
                <div>
                  <span className="font-semibold">Last run:</span>
                  {' '}{new Date(lastSummary.startedAt).toLocaleString()} {lastSummary.dryRun ? '(dryRun)' : ''}
                </div>
                <div className="flex gap-3">
                  <span>created: <strong>{lastSummary.created}</strong></span>
                  <span>updated: <strong>{lastSummary.updated}</strong></span>
                  <span>deleted: <strong>{lastSummary.deleted}</strong></span>
                </div>
                {lastSummary.skipped && (
                  <div className="text-amber-700">skipped: {lastSummary.reason || 'cooldown'}</div>
                )}
                {lastSummary.error && (
                  <div className="text-red-600">error: {lastSummary.error}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

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
              <CardTitle>All Categories</CardTitle>
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
                  Create your first category to get started
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

        {/* Admin Guide */}
        <Card>
          <CardHeader>
            <CardTitle>📚 Platform Admin Guide: Product Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              {/* What are Product Categories */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">💡 What are Product Categories?</h4>
                <p className="text-blue-800">
                  Product categories help organize inventory and improve visibility in Google Business Profile and Google Merchant Center. 
                  These are different from <strong>business categories</strong> (which define what type of business you are).
                </p>
              </div>

              {/* Admin Scope */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-2">🔧 Platform Admin Capabilities</h4>
                <ul className="list-disc list-inside space-y-1 text-purple-800">
                  <li><strong>Create platform-level categories</strong> that all tenants can use</li>
                  <li><strong>Sync categories to GBP</strong> for single locations, entire organizations, or platform-wide</li>
                  <li><strong>Manage category templates</strong> for quick onboarding (coming soon)</li>
                  <li><strong>Monitor category usage</strong> across all tenants</li>
                </ul>
              </div>

              {/* Scoping Guide */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">🎯 Sync Scoping Guide</h4>
                <div className="space-y-2 text-amber-800">
                  <div>
                    <strong>Single Location:</strong> Test changes on one store before rolling out
                  </div>
                  <div>
                    <strong>Entire Organization/Chain:</strong> Update all locations in a specific chain (Recommended)
                  </div>
                  <div>
                    <strong>Platform-Wide:</strong> Affects ALL organizations - use with extreme caution! ⚠️
                  </div>
                </div>
              </div>

              {/* Best Practices */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">✅ Best Practices</h4>
                <ul className="list-disc list-inside space-y-1 text-green-800">
                  <li>Always use <strong>Dry Run</strong> first to preview changes</li>
                  <li>Start with <strong>organization scope</strong> to avoid cross-chain contamination</li>
                  <li>Create <strong>industry-specific templates</strong> for faster onboarding</li>
                  <li>Monitor sync results and check for errors</li>
                  <li>Coordinate with organization admins before major changes</li>
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
                      <li>Managed at /t/{'{tenantId}'}/settings/gbp-category</li>
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
              onChange={(e) => setQuickStartCount(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-xs text-neutral-500 mt-1">
              <span>5 min</span>
              <span>30 max</span>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>✓ Google-Aligned:</strong> Each category will be automatically mapped to Google's Product Taxonomy for optimal SEO and Google Business Profile sync.
            </p>
          </div>
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => setShowQuickStartModal(false)}
            disabled={quickStartLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleQuickStart}
            disabled={quickStartLoading}
          >
            {quickStartLoading ? 'Generating...' : `Generate ${quickStartCount} Categories`}
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
        title="Import from Google Product Taxonomy"
        description="Search and select categories from Google's official product taxonomy"
      >
        <div className="space-y-4">
          <Input
            label="Search Google Categories"
            placeholder="e.g., coffee, clothing, electronics..."
            value={taxonomySearch}
            onChange={(e) => {
              setTaxonomySearch(e.target.value);
              searchTaxonomy(e.target.value);
            }}
          />
          
          {taxonomyLoading && (
            <div className="text-center py-4 text-neutral-500">
              Searching...
            </div>
          )}
          
          {!taxonomyLoading && taxonomyResults.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto border border-neutral-200 rounded-lg p-3">
              <div className="text-sm text-neutral-600 mb-2">
                {selectedTaxonomies.size} selected
              </div>
              {taxonomyResults.map((result) => (
                <div
                  key={result.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTaxonomies.has(result.id)
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                  onClick={() => toggleTaxonomySelection(result.id)}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTaxonomies.has(result.id)}
                      onChange={() => {}}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-neutral-900">{result.name}</div>
                      <div className="text-xs text-neutral-600 mt-1">
                        {result.path.join(' > ')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {!taxonomyLoading && taxonomySearch.length >= 2 && taxonomyResults.length === 0 && (
            <div className="text-center py-8 text-neutral-500">
              No categories found. Try a different search term.
            </div>
          )}
          
          {taxonomySearch.length < 2 && (
            <div className="text-center py-8 text-neutral-500">
              Enter at least 2 characters to search
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedCategory(null);
        }}
        title="Delete Category"
        description="Are you sure you want to delete this category?"
      >
        {selectedCategory && (
          <div className="py-4">
            <p className="text-neutral-700">
              Category: <strong>{selectedCategory.name}</strong>
            </p>
            <p className="text-sm text-neutral-600 mt-2">
              This action cannot be undone.
            </p>
          </div>
        )}
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
    </div>
  );
}
