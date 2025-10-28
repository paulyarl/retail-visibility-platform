"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Badge, Alert, AnimatedCard, Modal, ModalFooter, Pagination } from "@/components/ui";
import { motion } from "framer-motion";
import PageHeader, { Icons } from "@/components/PageHeader";
import { api } from "@/lib/api";

type Tenant = { 
  id: string; 
  name: string; 
  createdAt?: string;
  organization?: {
    id: string;
    name: string;
  } | null;
};

export default function TenantsClient({ initialTenants = [] }: { initialTenants?: Tenant[] }) {
  const router = useRouter();
  
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination and search state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [chainFilter, setChainFilter] = useState<'all' | 'chain' | 'standalone'>('all');

  // Filter and paginate tenants
  const filteredTenants = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tenants.filter((t) => {
      const matchesSearch = !query || t.name.toLowerCase().includes(query) || t.id.toLowerCase().includes(query);
      const matchesChain = chainFilter === 'all' || 
        (chainFilter === 'chain' && t.organization) ||
        (chainFilter === 'standalone' && !t.organization);
      return matchesSearch && matchesChain;
    });
  }, [tenants, searchQuery, chainFilter]);

  const paginatedTenants = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTenants.slice(startIndex, endIndex);
  }, [filteredTenants, currentPage, pageSize]);

  // Load tenants on mount
  useEffect(() => {
    refresh();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, chainFilter]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/tenants");
      const data = await res.json();
      
      // Backend now handles tenant filtering based on authentication
      setTenants(Array.isArray(data) ? data : []);
    } catch (_e) {
      setError("Failed to load tenants");
    } finally {
      setLoading(false);
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
    const res = await fetch(`/api/tenants/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) {
      setError("Failed to rename tenant");
      return;
    }
    const data = await res.json();
    setTenants((prev) => prev.map((t) => (t.id === id ? (data as Tenant) : t)));
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete tenant? This cannot be undone.")) return;
    const res = await fetch(`/api/tenants/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.status !== 204 && !res.ok) {
      setError("Failed to delete tenant");
      return;
    }
    setTenants((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Tenants"
        description="Manage your store locations and businesses"
        icon={Icons.Tenants}
        actions={
          <Button onClick={refresh} disabled={loading} variant="secondary">
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Error Alert */}
        {error && (
          <Alert variant="error" title="Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Create Tenant Card */}
        <AnimatedCard delay={0} hover={false}>
          <CardHeader>
            <CardTitle>Create New Tenant</CardTitle>
            <CardDescription>Add a new store or business location</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="flex gap-3">
              <div className="flex-1">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter tenant name (e.g., Downtown Store)"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} loading={loading}>
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {loading ? "Creating…" : "Create Tenant"}
              </Button>
            </form>
          </CardContent>
        </AnimatedCard>

        {/* Tenants List */}
        <AnimatedCard delay={0.1} hover={false}>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle>Your Tenants</CardTitle>
                <CardDescription>Manage your store locations</CardDescription>
              </div>
              <Badge variant="info">{filteredTenants.length} of {tenants.length}</Badge>
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
              <div className="flex gap-2">
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
            </div>
          </CardHeader>
          <CardContent>
            {filteredTenants.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-neutral-900 dark:text-white">
                  {searchQuery ? 'No matching tenants' : 'No tenants'}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {searchQuery ? 'Try a different search term' : 'Get started by creating your first tenant.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-200">
                {paginatedTenants.map((t, index) => (
                  <TenantRow 
                    key={t.id} 
                    tenant={t}
                    index={index}
                    onSelect={() => router.push(`/items?tenantId=${encodeURIComponent(t.id)}`)}
                    onEditProfile={() => router.push(`/onboarding?tenantId=${encodeURIComponent(t.id)}`)}
                    onRename={onRename}
                    onDelete={() => onDelete(t.id)}
                  />
                ))}
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
    </div>
  );
}

function TenantRow({ tenant, index, onSelect, onEditProfile, onRename, onDelete }: {
  tenant: Tenant;
  index: number;
  onSelect: () => void;
  onEditProfile: () => void;
  onRename: (id: string, newName: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tenant.name);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
        className="py-4 flex items-center gap-4"
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
                  <div className="inline-block px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-lg mb-1 group-hover:bg-primary-200 dark:group-hover:bg-primary-800/40 transition-colors">
                    <p className="font-bold text-primary-900 dark:text-primary-100 text-base">{tenant.name}</p>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{tenant.id}</p>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onEditProfile}>
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Edit Profile
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Rename
            </Button>
            <Button size="sm" variant="danger" onClick={() => setShowDeleteModal(true)}>
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </Button>
            <Button size="sm" onClick={onSelect}>
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
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
