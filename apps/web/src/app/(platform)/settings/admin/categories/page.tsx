'use client';

import { useEffect, useState } from 'react';
import { Card, Group, Text, ActionIcon, Button, Badge as MantineBadge } from '@mantine/core';
import { Modal, ModalFooter, Input, Pagination, Spinner } from '@/components/ui';
import { Tag, Globe, Edit } from 'lucide-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { adminCategoriesService } from '@/services/AdminCategoriesService';
import { adminUsersService } from '@/services/AdminUsersService';
import { organizationService } from '@/services/OrganizationService';
import { organizationsService } from '@/services/OrganizationsSingletonService';
import { clientLogger } from '@/lib/client-logger';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

// Category from google_taxonomy_list table (Google Product Taxonomy)
interface Category {
  id: string;
  category_id: string;  // Numeric Google taxonomy ID (e.g., "166", "7385")
  name: string;        // Last segment of full_path
  full_path: string;   // Full path (e.g., "Electronics > Televisions")
  level: number;       // Depth in taxonomy (1 = top level)
  parent_id: string | null;
  is_active: boolean;
}

// Component to display Google category ID with lookup utility
function GoogleCategoryPath({ googleCategoryId }: { googleCategoryId: string }) {
  const [showLookup, setShowLookup] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(googleCategoryId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5 text-neutral-600">
        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
        </svg>
        <span className="font-medium text-green-700">Google ID:</span>
        <button
          onClick={handleCopy}
          className="font-mono text-neutral-700 hover:text-green-700 hover:underline transition-colors"
          title="Click to copy ID"
        >
          {googleCategoryId}
        </button>
        {copied && (
          <span className="text-green-600 font-medium">✓ Copied</span>
        )}
      </div>
      <button
        onClick={() => setShowLookup(!showLookup)}
        className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
        title="Lookup category path"
      >
        {showLookup ? 'Hide path' : 'Show path'}
      </button>
      {showLookup && (
        <GoogleCategoryLookup googleCategoryId={googleCategoryId} />
      )}
    </div>
  );
}

// Separate component for the lookup that fetches from public endpoint
function GoogleCategoryLookup({ googleCategoryId }: { googleCategoryId: string }) {
  const [path, setPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPath() {
      try {
        const taxonomyPath = await adminCategoriesService.getGoogleTaxonomyPath(googleCategoryId);
        if (taxonomyPath && taxonomyPath.path) {
          const pathString = Array.isArray(taxonomyPath.path) ? taxonomyPath.path.join(' > ') : taxonomyPath.path;
          setPath(pathString);
        }
      } catch (error) {
        clientLogger.error('Failed to fetch Google category path:', { detail: error });
      } finally {
        setLoading(false);
      }
    }
    fetchPath();
  }, [googleCategoryId]);

  if (loading) {
    return (
      <span className="text-neutral-500 italic">Loading...</span>
    );
  }

  if (!path) {
    return (
      <span className="text-orange-600">Path not found</span>
    );
  }

  return (
    <span className="text-neutral-700 italic">→ {path}</span>
  );
}

interface Tenant {
  id: string;
  name: string;
  organizationId?: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set()); // Selected category IDs for propagation
  const [dryRun, setDryRun] = useState(true);
  const [propagationLoading, setPropagationLoading] = useState(false);
  const [tenantIdInput, setTenantIdInput] = useState('');
  const [organizationIdInput, setOrganizationIdInput] = useState('');
  const [scope, setScope] = useState<'tenant' | 'organization' | 'platform'>('organization');
  const [lastResult, setLastResult] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Tenant and Organization lists for dropdowns
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  
  const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  const apiUrl = (path: string) => `${API_BASE}${path}`;
  
  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.split(';').map(s => s.trim()).find(c => c.startsWith(name + '='));
    return match ? decodeURIComponent(match.split('=')[1] || '') : '';
  };
  
  // Get auth token from localStorage or cookie
  const getAuthHeader = (): Record<string, string> => {
    const token = localStorage.getItem('access_token') || getCookie('access_token') || getCookie('ACCESS_TOKEN');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    loadCategories();
    loadTenantsAndOrgs();
  }, []);
  
  // Load tenants and organizations for dropdowns
  const loadTenantsAndOrgs = async () => {
    const token = localStorage.getItem('access_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    // Load tenants
    setLoadingTenants(true);
    try {
      const tenants = await adminUsersService.getAllTenants();
      setTenants(Array.isArray(tenants) ? tenants : []);
    } catch (e) {
      clientLogger.error('Failed to load tenants:', { detail: e });
    } finally {
      setLoadingTenants(false);
    }
    
    // Load organizations
    setLoadingOrgs(true);
    try {
      const orgs = await organizationService.getOrganizations({});
      setOrganizations(Array.isArray(orgs) ? orgs : []);
    } catch (e) {
      clientLogger.error('Failed to load organizations:', { detail: e });
    } finally {
      setLoadingOrgs(false);
    }
  };

  // Paginate categories (search is handled by API)
  const totalPages = Math.ceil(categories.length / pageSize);
  const paginatedCategories = categories.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const loadCategories = async () => {
    try {
      // Use search API if query present, otherwise load from DB
      const categories = searchQuery.trim()
        ? await adminCategoriesService.searchCategories(searchQuery, 500)
        : await adminCategoriesService.getCategories(true);
      console.log('[Load Categories] Parsed categories:', categories.length);
      // Ensure categories is always an array
      setCategories(Array.isArray(categories) ? categories : []);
    } catch (error) {
      clientLogger.error('Failed to load categories:', { detail: error });
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCategories();
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Toggle category selection for propagation
  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Select/deselect all visible categories
  const toggleSelectAll = () => {
    if (selectedCategories.size === paginatedCategories.length) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(paginatedCategories.map(c => c.id)));
    }
  };

  // Propagate selected categories to target tenants
  const handlePropagate = async () => {
    if (selectedCategories.size === 0) {
      alert('Please select at least one category to propagate');
      return;
    }

    if (scope === 'tenant' && !tenantIdInput.trim()) {
      alert('Please enter a tenant ID');
      return;
    }

    if (scope === 'organization' && !organizationIdInput.trim()) {
      alert('Please enter an organization ID');
      return;
    }

    if (scope === 'platform' && !confirm('⚠️ WARNING: This will propagate to ALL tenants across ALL organizations! Are you sure?')) {
      return;
    }

    setPropagationLoading(true);
    setLastResult(null);

    try {
      const selectedCats = categories.filter(c => selectedCategories.has(c.id));
      
      const response = await adminCategoriesService.propagateCategories({
        categories: selectedCats.map(c => ({
          category_id: c.category_id,
          name: c.name,
          full_path: c.full_path,
        })),
        scope,
        tenantId: scope === 'tenant' ? tenantIdInput.trim() : undefined,
        organizationId: scope === 'organization' ? organizationIdInput.trim() : undefined,
        dryRun,
      });

      setLastResult(response);
      
      if (response.success) {
        alert(`Successfully propagated ${response.propagated} categories to ${response.tenantsAffected} tenants`);
      }
    } catch (error: any) {
      clientLogger.error('Propagation failed:', { detail: error });
      setLastResult({ error: true, message: error.message || 'Propagation failed' });
    } finally {
      setPropagationLoading(false);
    }
  };

  const openEditModal = (category: Category) => {
    setSelectedCategory(category);
    setShowEditModal(true);
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
        <Card withBorder padding="lg" radius="md">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 rounded-full bg-blue-500"></div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Propagate Product Categories to Tenant Catalogs</h3>
                <p className="text-sm text-neutral-500">Select categories below, then choose scope and propagate</p>
              </div>
            </div>
            {/* Selection Summary */}
            {selectedCategories.size > 0 && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">
                  {selectedCategories.size} categor{selectedCategories.size === 1 ? 'y' : 'ies'} selected for propagation
                </p>
              </div>
            )}
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
                <div className="w-full sm:w-80">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Organization</label>
                  <select
                    value={organizationIdInput}
                    onChange={(e) => setOrganizationIdInput(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="">Select an organization...</option>
                    {loadingOrgs ? (
                      <option disabled>Loading...</option>
                    ) : (
                      organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.id})
                        </option>
                      ))
                    )}
                  </select>
                  <div className="mt-1">
                    <Input
                      placeholder="Or type organization ID manually..."
                      value={organizationIdInput}
                      onChange={(e) => setOrganizationIdInput(e.target.value)}
                    />
                  </div>
                </div>
              )}
              {scope === 'tenant' && (
                <div className="w-full sm:w-80">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Tenant</label>
                  <select
                    value={tenantIdInput}
                    onChange={(e) => setTenantIdInput(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="">Select a tenant...</option>
                    {loadingTenants ? (
                      <option disabled>Loading...</option>
                    ) : (
                      tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name} ({tenant.id})
                        </option>
                      ))
                    )}
                  </select>
                  <div className="mt-1">
                    <Input
                      placeholder="Or type tenant ID manually..."
                      value={tenantIdInput}
                      onChange={(e) => setTenantIdInput(e.target.value)}
                    />
                  </div>
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
                <label htmlFor="dryRunToggle" className="text-sm">Dry Run (preview only)</label>
              </div>
              <Button
                variant="primary"
                onClick={handlePropagate}
                disabled={propagationLoading || selectedCategories.size === 0}
              >
                {propagationLoading ? 'Propagating…' : `Propagate ${selectedCategories.size || 0} Categories`}
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

            {/* Result Display */}
            {lastResult && (
              <div className="mt-4 p-3 bg-neutral-50 border border-neutral-200 rounded">
                {lastResult.error ? (
                  <p className="text-sm text-red-600">Error: {lastResult.message}</p>
                ) : (
                  <div className="text-sm text-neutral-700">
                    <p className="font-semibold text-green-700">
                      ✓ Propagated {lastResult.propagated} categories to {lastResult.tenantsAffected} tenants
                    </p>
                    {lastResult.dryRun && <p className="text-amber-600">(Dry run - no changes made)</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleSelectAll}
          >
            {selectedCategories.size === paginatedCategories.length ? 'Deselect All' : 'Select All Visible'}
          </Button>
        </div>

        {/* Categories List */}
        <Card withBorder padding="lg" radius="md">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Categories</h3>
              <div className="w-64">
                <Input
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            {categories.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-500">
                  {searchQuery.trim() ? 'No categories match your search' : 'No categories found'}
                </p>
                <p className="text-sm text-neutral-400 mt-2">
                  {searchQuery.trim() ? 'Try a different search term' : 'Categories will appear here'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedCategories.map((category) => (
                    <Card key={category.id} withBorder radius="md" className="hover:shadow-lg transition-all duration-200 group">
                      {/* Selection Checkbox */}
                      <div className="absolute top-2 left-2 z-10">
                        <input
                          type="checkbox"
                          checked={selectedCategories.has(category.id)}
                          onChange={() => toggleCategorySelection(category.id)}
                          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                      {/* Icon Section - Enhanced */}
                      <Card.Section className="relative">
                        <div className="h-24 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 dark:from-blue-600 dark:via-indigo-600 dark:to-purple-700 flex items-center justify-center rounded-t-md group-hover:from-blue-600 group-hover:via-indigo-600 group-hover:to-purple-700 transition-all duration-200">
                          <Tag className="w-12 h-12 text-white opacity-90" />
                          <div className="absolute top-3 right-3">
                            <MantineBadge 
                              color="blue"
                              variant="light"
                              size="xs"
                            >
                              Level {category.level}
                            </MantineBadge>
                          </div>
                        </div>
                      </Card.Section>

                      {/* Title and Status - Enhanced */}
                      <Card.Section className="p-4">
                        <Group justify="space-between" mb="xs" align="start">
                          <div className="flex-1">
                            <Text 
                              fw={600} 
                              size="lg" 
                              lineClamp={1} 
                              className="text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors"
                            >
                              {category.name}
                            </Text>
                            <Text size="xs" c="dimmed" mt={1}>
                              Google ID: {category.category_id}
                            </Text>
                          </div>
                        </Group>

                        <Text size="sm" c="dimmed" lineClamp={2} mb="md" className="min-h-[2.5rem]">
                          {category.full_path}
                        </Text>
                      </Card.Section>

                      {/* Features Section - Enhanced */}
                      <Card.Section className="px-4 pb-3">
                        <Group gap={4} wrap="wrap">
                          {/* Level Badge */}
                          <MantineBadge 
                            color="blue"
                            variant="light"
                            size="xs"
                          >
                            📦 Product
                          </MantineBadge>
                          
                          {/* Google ID Badge */}
                          <MantineBadge 
                            color="green"
                            variant="light"
                            size="xs"
                          >
                            🌍 GBP Ready
                          </MantineBadge>
                        </Group>
                      </Card.Section>

                      {/* Action Buttons - Enhanced */}
                      <Card.Section className="px-4 pb-4">
                        <Group gap={6}>
                          <Button
                            size="sm"
                            variant="light"
                            leftSection={<Edit size={14} />}
                            onClick={() => openEditModal(category)}
                            className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 font-medium"
                          >
                            View
                          </Button>
                        </Group>
                      </Card.Section>
                    </Card>
                  ))}
                </div>
              
              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={categories.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              )}
            </>
            )}
          </div>
        </Card>

        {/* Admin Guide */}
        <Card withBorder padding="lg" radius="md">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 rounded-full bg-blue-500"></div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">📚 Platform Admin Guide: Product Categories</h3>
              </div>
            </div>
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
          </div>
        </Card>
      </div>

      {/* Category View Modal - Read-only taxonomy data */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedCategory(null);
        }}
        title="Google Product Category"
        description="View taxonomy details"
      >
        {selectedCategory && (
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-500">Google Category ID</label>
              <p className="text-lg font-mono text-green-700">{selectedCategory.category_id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-500">Name</label>
              <p className="text-lg font-semibold text-neutral-900">{selectedCategory.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-500">Full Path</label>
              <p className="text-neutral-700">{selectedCategory.full_path}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-500">Level</label>
                <p className="text-neutral-700">{selectedCategory.level}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-500">Parent ID</label>
                <p className="text-neutral-700">{selectedCategory.parent_id || 'None (Top Level)'}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-neutral-200">
              <p className="text-sm text-neutral-500">
                This is a Google Product Taxonomy category. These categories are read-only and managed by Google.
              </p>
            </div>
          </div>
        )}
        <div className="flex gap-3 justify-end p-4 border-t border-neutral-200">
          <Button
            variant="outline"
            onClick={() => {
              setShowEditModal(false);
              setSelectedCategory(null);
            }}
          >
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}
