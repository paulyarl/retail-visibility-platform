"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Badge, Alert, AnimatedCard, Modal, ModalFooter, Pagination } from "@/components/ui";
import { motion } from "framer-motion";
import PageHeader, { Icons } from "@/components/PageHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canEditTenant, canDeleteTenant, canRenameTenant } from "@/lib/auth/access-control";
import { ContextBadges } from "@/components/ContextBadges";
import { SubscriptionStatusGuide } from "@/components/subscription/SubscriptionStatusGuide";
import ChangeLocationStatusModal from '@/components/tenant/ChangeLocationStatusModal';

type Tenant = { 
  id: string; 
  name: string; 
  createdAt?: string;
  locationStatus?: 'pending' | 'active' | 'inactive' | 'closed' | 'archived';
  organization?: {
    id: string;
    name: string;
  } | null;
};


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function TenantsClient({ initialTenants = [] }: { initialTenants?: Tenant[] }) {
  const router = useRouter();
  const { user } = useAuth();
  
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination and search state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [chainFilter, setChainFilter] = useState<'all' | 'chain' | 'standalone'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'inactive' | 'closed' | 'archived'>('active');
  
  // View mode toggle
  // Important for hydration: default to 'grid' on both server and initial client render,
  // then read localStorage AFTER hydration to avoid SSR/client mismatch.
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Read saved view mode on client after hydration
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('tenants_view_mode');
      if (saved === 'grid' || saved === 'list') {
        setViewMode(saved as 'grid' | 'list');
      }
    } catch {}
  }, []);

  // Status modal state
  const [statusModalTenant, setStatusModalTenant] = useState<Tenant | null>(null);

  const openStatusModal = async (tenant: Tenant) => {
    // Refresh data first to ensure we have the latest status
    await refresh();
    setStatusModalTenant(tenant);
  };

  const handleStatusChange = () => {
    setStatusModalTenant(null);
    // Refresh the tenant list after status change
    refresh();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('tenants_view_mode', viewMode);
    } catch {}
  }, [viewMode]);

  // Filter and paginate tenants
  const filteredTenants = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tenants.filter((t) => {
      const matchesSearch = !query || t.name.toLowerCase().includes(query) || t.id.toLowerCase().includes(query);
      const matchesChain = chainFilter === 'all' || 
        (chainFilter === 'chain' && t.organization) ||
        (chainFilter === 'standalone' && !t.organization);
      const matchesStatus = statusFilter === 'all' || 
        (t.locationStatus || 'active') === statusFilter;
      return matchesSearch && matchesChain && matchesStatus;
    });
  }, [tenants, searchQuery, chainFilter, statusFilter]);

  const paginatedTenants = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTenants.slice(startIndex, endIndex);
  }, [filteredTenants, currentPage, pageSize]);

  // Reset to page 1 when status filter changes and reload tenants
  useEffect(() => {
    setCurrentPage(1);
    refresh();
  }, [statusFilter]);

  // Reset to page 1 when search or chain filter changes (client-side only)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, chainFilter]);

  const fetchTenants = async (includeArchived = false, statusParam?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (includeArchived) {
        params.append('includeArchived', 'true');
      }
      if (statusParam) {
        params.append('status', statusParam);
      }
      const url = `/api/tenants${params.toString() ? '?' + params.toString() : ''}`;
      const res = await api.get(url);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      // The API already filters tenants based on user permissions, so we don't need to filter again
      setTenants(list);
    } catch (_e) {
      setError("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (statusFilter === 'all') {
      // 'all' filter: include archived tenants but no specific status filter
      await fetchTenants(true);
    } else if (statusFilter === 'archived') {
      // 'archived' filter: include archived and filter to archived status
      await fetchTenants(true, 'archived');
    } else {
      // Specific status filter: don't include archived, filter to specific status
      await fetchTenants(false, statusFilter);
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/api/tenants", { name: name.trim() });
      const data = await res.json();
      
      if (!res.ok) {
        console.error('[TenantsClient] Create failed:', data);
        throw new Error(data?.message || data?.error || "Failed to create tenant");
      }
      
      const newTenant = data as Tenant;
      console.log('[TenantsClient] Tenant created:', newTenant.id);
      
      // Backend automatically links tenant to authenticated user
      setName("");
      
      // Refresh tenant list to get the new tenant
      await refresh();
      
      console.log('[TenantsClient] Tenant created successfully:', newTenant.id);
    } catch (err) {
      console.error('[TenantsClient] Create error:', err);
      setError(err instanceof Error ? err.message : "Failed to create tenant");
    } finally {
      setLoading(false);
    }
  };

  const onRename = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    const res = await api.put(`/api/tenants/${encodeURIComponent(id)}`, { name: newName.trim() });
    if (!res.ok) {
      setError("Failed to rename tenant");
      return;
    }
    const data = await res.json();
    setTenants((prev) => prev.map((t) => (t.id === id ? (data as Tenant) : t)));
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete tenant? This cannot be undone.")) return;
    const res = await api.delete(`/api/tenants/${encodeURIComponent(id)}`);
    if (res.status !== 204 && !res.ok) {
      setError("Failed to delete tenant");
      return;
    }
    setTenants((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Locations"
        description="Manage your stores and business locations"
        icon={Icons.Tenants}
        actions={
          <div className="flex gap-3">
            <Button 
              onClick={() => router.push('/')} 
              variant="ghost"
              title="Back to Dashboard"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dashboard
            </Button>
            <Button onClick={() => refresh()} disabled={loading} variant="secondary">
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Subscription Status Guide: only visible during maintenance or freeze windows */}
        <SubscriptionStatusGuide />

        {/* Context Badges */}
        <ContextBadges showPlatformRole contextLabel="Tenants" />
        {/* Quick Stats Dashboard */}
        {tenants.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Total Locations</p>
                  <p className="text-2xl font-bold text-neutral-900">{tenants.length}</p>
                </div>
                <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Chain Locations</p>
                  <p className="text-2xl font-bold text-neutral-900">{tenants.filter(t => t.organization).length}</p>
                </div>
                <div className="h-12 w-12 bg-info rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Standalone</p>
                  <p className="text-2xl font-bold text-neutral-900">{tenants.filter(t => !t.organization).length}</p>
                </div>
                <div className="h-12 w-12 bg-success rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Filtered</p>
                  <p className="text-2xl font-bold text-neutral-900">{filteredTenants.length}</p>
                </div>
                <div className="h-12 w-12 bg-neutral-200 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="error" title="Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Create Tenant Card */}
        <AnimatedCard delay={0} hover={false}>
          <CardHeader>
            <CardTitle>Add New Location</CardTitle>
            <CardDescription>Create a new store or business location</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="flex gap-3">
              <div className="flex-1">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter location name (e.g., Downtown Store)"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} loading={loading}>
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {loading ? "Creating…" : "Add Location"}
              </Button>
            </form>
          </CardContent>
        </AnimatedCard>

        {/* Tenants List */}
        <AnimatedCard delay={0.1} hover={false}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <CardTitle>Your Tenants</CardTitle>
                <CardDescription>Manage your store locations</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Badge variant="info" className="flex-shrink-0">{filteredTenants.length} of {tenants.length}</Badge>
                {/* View Toggle */}
                <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-600 p-1 bg-white dark:bg-neutral-800 flex-shrink-0">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1.5 rounded-md transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-primary-600 text-white'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                    aria-label="Grid view"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-md transition-colors ${
                      viewMode === 'list'
                        ? 'bg-primary-600 text-white'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                    aria-label="List view"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Filters */}
            <div className="space-y-4">
              {/* Search Input */}
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or ID..."
                label="Search Tenants"
              />
              
              {/* Chain Filter */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={chainFilter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setChainFilter('all')}
                >
                  All Types
                </Button>
                <Button
                  variant={chainFilter === 'chain' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setChainFilter('chain')}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Chain
                </Button>
                <Button
                  variant={chainFilter === 'standalone' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setChainFilter('standalone')}
                >
                  Standalone
                </Button>
              </div>
              
              {/* Location Status Filter */}
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">
                  Filter by Status
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={statusFilter === 'all' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                  >
                    All Statuses
                  </Button>
                  <Button
                    variant={statusFilter === 'active' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('active')}
                  >
                    ✅ Active
                  </Button>
                  <Button
                    variant={statusFilter === 'inactive' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('inactive')}
                  >
                    ⏸️ Inactive
                  </Button>
                  <Button
                    variant={statusFilter === 'pending' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('pending')}
                  >
                    🚧 Pending
                  </Button>
                  <Button
                    variant={statusFilter === 'closed' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('closed')}
                  >
                    🔒 Closed
                  </Button>
                  <Button
                    variant={statusFilter === 'archived' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('archived')}
                  >
                    📦 Archived
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
                    <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="p-4 border border-neutral-200 rounded-lg bg-white animate-pulse"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-5 w-5 bg-neutral-200 rounded" />
                      <div className="flex-1">
                        <div className="h-6 bg-neutral-200 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-neutral-200 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="pt-3 border-t border-neutral-100 flex gap-2">
                      <div className="h-8 bg-neutral-200 rounded w-28" />
                      <div className="h-8 bg-neutral-200 rounded w-20" />
                      <div className="h-8 bg-neutral-200 rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-neutral-900 dark:text-white">
                  {searchQuery ? "No matching tenants" : "No tenants"}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {searchQuery
                    ? "Try a different search term"
                    : "Get started by creating your first tenant."}
                </p>
              </div>
            ) : (
              <div
                className={
                  viewMode === "list"
                    ? "space-y-3"
                    : "grid grid-cols-1 lg:grid-cols-2 gap-4"
                }
              >
                {paginatedTenants.map((t, index) => {
                  // Use centralized permission helpers
                  const canEdit = user ? canEditTenant(user, t.id) : false;
                  const canDelete = user ? canDeleteTenant(user, t.id) : false;
                  const canRename = user
                    ? canRenameTenant(user, t.id)
                    : false;

                  return (
                    <TenantRow
                      key={t.id}
                      tenant={t}
                      index={index}
                      onSelect={() =>
                        router.push(
                          `/t/${encodeURIComponent(t.id)}/dashboard`,
                        )
                      }
                      onViewItems={() =>
                        router.push(
                          `/t/${encodeURIComponent(t.id)}/items`,
                        )
                      }
                      onEditProfile={() =>
                        router.push(
                          `/t/${encodeURIComponent(t.id)}/onboarding`,
                        )
                      }
                      onRename={onRename}
                      onDelete={() => onDelete(t.id)}
                      onStatusChange={openStatusModal}
                      onRefresh={refresh}
                      statusFilter={statusFilter}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      canRename={canRename}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>

          {filteredTenants.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredTenants.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          )}
        </AnimatedCard>
      </div>

      {/* Status Update Modal */}
      {statusModalTenant && (
        <ChangeLocationStatusModal
          tenantId={statusModalTenant.id}
          tenantName={statusModalTenant.name}
          initialStatus={statusModalTenant.locationStatus || 'active'}
          isOpen={true}
          onClose={() => setStatusModalTenant(null)}
          onStatusChanged={handleStatusChange}
        />
      )}
    </div>
  );
}

function TenantRow({ tenant, index, onSelect, onViewItems, onEditProfile, onRename, onDelete, onStatusChange, onRefresh, statusFilter, canEdit = false, canRename = false, canDelete = false }: {
  tenant: Tenant;
  index: number;
  onSelect: () => void;
  onViewItems?: () => void;
  onEditProfile: () => void;
  onRename: (id: string, newName: string) => void;
  onDelete: () => void;
  onStatusChange: (tenant: Tenant) => void;
  onRefresh: (includeArchived?: boolean, statusParam?: string) => void;
  statusFilter?: 'all' | 'pending' | 'active' | 'inactive' | 'closed' | 'archived';
  canEdit?: boolean;
  canRename?: boolean;
  canDelete?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tenant.name);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  useEffect(() => setValue(tenant.name), [tenant.name]);

  const save = async () => {
    await onRename(tenant.id, value);
    setEditing(false);
  };

  const handleDelete = () => {
    setShowDeleteModal(false);
    onDelete();
  };
  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
      >
        {/* Tenant Info */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="max-w-md"
                autoFocus
              />
              <Button size="sm" onClick={save}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          ) : (
            <button
              onClick={onSelect}
              className="text-left transition-colors group w-full"
            >
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-neutral-400 group-hover:text-primary-600 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-block px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-lg mb-1 group-hover:bg-primary-200 dark:group-hover:bg-primary-800/40 transition-colors">
                      <p className="font-bold text-primary-900 dark:text-primary-100 text-base">{tenant.name}</p>
                    </div>
                    {tenant.organization && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span>{tenant.organization.name}</span>
                      </div>
                    )}
                    {tenant.locationStatus && tenant.locationStatus !== 'active' && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent triggering the parent button
                          onStatusChange(tenant);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border cursor-pointer ${
                          tenant.locationStatus === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200' :
                          tenant.locationStatus === 'inactive' ? 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200' :
                          tenant.locationStatus === 'closed' ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200' :
                          'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        <span>
                          {tenant.locationStatus === 'pending' ? '🚧' :
                           tenant.locationStatus === 'inactive' ? '⏸️' :
                           tenant.locationStatus === 'closed' ? '🔒' :
                           '📦'}
                        </span>
                        <span className="capitalize">{tenant.locationStatus}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{tenant.id}</p>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-neutral-100 mt-3">
            {/* Quick Status Change - Prominent placement */}
            {canEdit && (
              <Button 
                size="sm" 
                variant={tenant.locationStatus === 'active' ? 'secondary' : 'danger'}
                onClick={() => onStatusChange(tenant)}
                title="Change location status"
              >
                {tenant.locationStatus === 'active' ? (
                  <>
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Active
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {tenant.locationStatus ? tenant.locationStatus.charAt(0).toUpperCase() + tenant.locationStatus.slice(1) : 'Status'}
                  </>
                )}
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={onEditProfile}>
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Edit Profile
              </Button>
            )}
            {canRename && (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Rename
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="danger" onClick={() => setShowDeleteModal(true)}>
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => window.open(`/tenant/${tenant.id}`, '_blank')} title="Preview storefront">
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Storefront
            </Button>
            <Button size="sm" onClick={onViewItems ?? onSelect}>
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              View Items
            </Button>
          </div>
        )}
      </motion.div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Tenant"
        description="Are you sure you want to delete this tenant?"
        size="sm"
      >
        <div className="space-y-4">
          <Alert variant="warning">
            This action cannot be undone. All data associated with this tenant will be permanently deleted.
          </Alert>
          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">{tenant.name}</p>
            <p className="text-xs text-neutral-500 font-mono mt-1">{tenant.id}</p>
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete Tenant
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
