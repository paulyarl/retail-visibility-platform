'use client';

import { useEffect, useState } from 'react';
import { Card, Badge, Modal, ModalFooter, Input, Select, ToastContainer } from '@/components/ui';
import { Button } from '@mantine/core';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useTenantOrganizations } from '@/hooks/useTenantOrganizations';
import { type Organization } from '@/lib/singletons/TenantOrganizationsSingleton';
import { useToast } from '@/components/ui/use-toast';
import { tierSystemService, type Tier } from '@/services/TierSystemService';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

const ITEMS_PER_PAGE = 10;

export default function AdminOrganizationsPage() {
  const { toast, toasts, removeToast } = useToast();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);

  const {
    organizations,
    availableTenants,
    loading,
    error,
    processing,
    createOrganization,
    updateOrganization,
    addTenantToOrganization,
    removeTenantFromOrganization,
    refresh,
    refreshTenants,
    clearError,
  } = useTenantOrganizations('admin', { autoInitialize: true });

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        setTiersLoading(true);
        const tierData = await tierSystemService.getTierSystemTiers();
        if (tierData) {
          const orgTiers = tierData
            .filter(tier => tier.type === 'organization' && tier.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          setTiers(orgTiers);
        }
      } catch (error) {
        console.error('Failed to fetch tiers:', error);
        toast('Failed to load tier data. Using fallback pricing.', { variant: 'error' });
      } finally {
        setTiersLoading(false);
      }
    };
    fetchTiers();
  }, [toast]);

  const getTierById = (tierId: string): Tier | undefined =>
    tiers.find(tier => tier.id === tierId || tier.slug === tierId);

  const getTierDisplayName = (tierId: string): string => {
    const tier = getTierById(tierId);
    return tier?.displayName || tier?.name || tierId;
  };

  const getTierPrice = (tierId: string): string => {
    const tier = getTierById(tierId);
    if (!tier) return '$0/mo';
    const price = parseFloat(tier.price) || 0;
    const interval = tier.billingInterval || 'monthly';
    const currency = tier.currency || 'USD';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price) + `/${interval === 'yearly' ? 'yr' : 'mo'}`;
  };

  const getTierLimits = (tierId: string) => {
    const tier = getTierById(tierId);
    return {
      maxLocations: tier?.maxLocations || 5,
      maxTotalSKUs: tier?.maxSkus || 2500,
      displayName: tier?.displayName || tier?.name || tierId,
      price: getTierPrice(tierId),
    };
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  const getAvailableTenantsForOrg = () => {
    if (!selectedOrg) return availableTenants;
    const currentTenantIds = new Set(selectedOrg.tenants.map(t => t.id));
    return availableTenants.filter(tenant => !currentTenantIds.has(tenant.id));
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgTier, setNewOrgTier] = useState('chain_starter');
  const [newOrgMaxLocations, setNewOrgMaxLocations] = useState('5');
  const [newOrgMaxSKUs, setNewOrgMaxSKUs] = useState('2500');

  const [showEditTierModal, setShowEditTierModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editTier, setEditTier] = useState('chain_starter');
  const [editStatus, setEditStatus] = useState('active');
  const [editMaxLocations, setEditMaxLocations] = useState('5');
  const [editMaxSKUs, setEditMaxSKUs] = useState('2500');
  const [editReason, setEditReason] = useState('');

  const openManageModal = (org: Organization) => {
    setSelectedOrg(org);
    setShowManageModal(true);
  };

  const handleAddTenant = async (orgId: string) => {
    if (!selectedTenantId) return;
    try {
      const result = await addTenantToOrganization(orgId, selectedTenantId);
      if (result) {
        const newTenant = { id: result.id, name: result.name, _count: { items: 0 } };
        if (selectedOrg && selectedOrg.id === orgId) {
          setSelectedOrg({ ...selectedOrg, tenants: [...selectedOrg.tenants, newTenant], stats: { ...selectedOrg.stats, totalLocations: selectedOrg.stats.totalLocations + 1 } });
        }
        await refresh();
        const tenantName = result.name || availableTenants.find(t => t.id === selectedTenantId)?.name || 'Tenant';
        const orgName = organizations.find(o => o.id === orgId)?.name || 'Organization';
        toast(`✅ Successfully added "${tenantName}" to "${orgName}"`, { variant: 'success' });
        setSelectedTenantId('');
      } else {
        throw new Error('Failed to add tenant to organization');
      }
    } catch (error: any) {
      console.error('Failed to add tenant:', error);
      toast(error.message || 'Failed to add tenant. Please try again.', { variant: 'error' });
    }
  };

  const handleRemoveTenant = async (orgId: string, tenantId: string) => {
    try {
      const result = await removeTenantFromOrganization(orgId, tenantId);
      if (result) {
        if (selectedOrg && selectedOrg.id === orgId) {
          setSelectedOrg({ ...selectedOrg, tenants: selectedOrg.tenants.filter(t => t.id !== tenantId), stats: { ...selectedOrg.stats, totalLocations: selectedOrg.stats.totalLocations - 1 } });
        }
        await refresh();
        const tenantName = selectedOrg?.tenants.find(t => t.id === tenantId)?.name || result.name || 'Tenant';
        const orgName = organizations.find(o => o.id === orgId)?.name || 'Organization';
        toast(`✅ Successfully removed "${tenantName}" from "${orgName}"`, { variant: 'success' });
      } else {
        throw new Error('Failed to remove tenant from organization');
      }
    } catch (error: any) {
      console.error('Failed to remove tenant:', error);
      toast(error.message || 'Failed to remove tenant. Please try again.', { variant: 'error' });
    }
  };

  const openEditTierModal = (org: Organization) => {
    setEditingOrg(org);
    setEditTier(org.subscriptionTier);
    setEditStatus(org.subscriptionStatus);
    setEditMaxLocations(org.maxLocations.toString());
    setEditMaxSKUs(org.maxTotalSKUs.toString());
    setEditReason('');
    setShowEditTierModal(true);
  };

  const handleUpdateOrganizationTier = async () => {
    if (!editingOrg || !editReason.trim()) {
      toast('Please provide a reason for the tier change', { variant: 'error' });
      return;
    }
    try {
      const result = await updateOrganization(editingOrg.id, {
        subscription_tier: editTier,
        subscription_status: editStatus,
        max_locations: parseInt(editMaxLocations) || 5,
        reason: editReason.trim()
      });
      if (result) {
        const changes = [];
        if (editingOrg.subscriptionTier !== editTier) changes.push(`Tier: ${getTierDisplayName(editingOrg.subscriptionTier)} → ${getTierDisplayName(editTier)}`);
        if (editingOrg.subscriptionStatus !== editStatus) changes.push(`Status: ${editingOrg.subscriptionStatus} → ${editStatus}`);
        const orgName = result.name || editingOrg.name;
        if (changes.length === 0) toast(`✅ Successfully updated "${orgName}"`, { variant: 'success' });
        else toast(`✅ Successfully updated "${orgName}": ${changes.join(', ')}`, { variant: 'success' });
        setShowEditTierModal(false);
        setEditingOrg(null);
        setEditReason('');
      } else {
        throw new Error('Failed to update organization');
      }
    } catch (error: any) {
      console.error('Failed to update organization:', error);
      toast(error.message || 'Failed to update organization. Please try again.', { variant: 'error' });
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      toast('Please enter an organization name', { variant: 'error' });
      return;
    }
    try {
      await createOrganization({ name: newOrgName.trim(), subscription_tier: newOrgTier, max_locations: parseInt(newOrgMaxLocations) || 10 });
      const tierName = getTierDisplayName(newOrgTier);
      toast(`✅ Successfully created "${newOrgName.trim()}" (${tierName})`, { variant: 'success' });
      setShowCreateModal(false);
      setNewOrgName('');
      setNewOrgTier('chain_starter');
      setNewOrgMaxLocations('10');
      setNewOrgMaxSKUs('50000');
    } catch (error: any) {
      console.error('Failed to create organization:', error);
      toast(error.message || 'Failed to create organization. Please try again.', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader title="Organizations" description="Loading..." icon={Icons.Settings} backLink={{ href: '/settings/admin', label: 'Back to Admin' }} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <PageHeader title="Organizations" description="Manage chain organizations and multi-location accounts" icon={Icons.Settings} backLink={{ href: '/settings/admin', label: 'Back to Admin' }} />

      <div className="mt-6 space-y-6">
        <div className="flex items-center justify-between">
          {organizations.length > 0 ? (
            <p className="text-sm font-medium text-neutral-700">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, organizations.length)} of {organizations.length} organizations
            </p>
          ) : <div />}
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>+ Create New Organization</Button>
        </div>

        {organizations.length === 0 ? (
          <Card className="p-6 rounded-lg">
            <div className="text-center py-12">
              <p className="text-neutral-500">No organizations found</p>
            </div>
          </Card>
        ) : (
          organizations.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((org) => (
            <Card key={org.id} className="p-6 rounded-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{org.name}</h3>
                    <p className="text-sm text-neutral-700 mt-1 font-medium">ID: {org.id}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="default">{org.subscriptionTier}</Badge>
                    <Badge variant="info">{getTierPrice(org.subscriptionTier)}</Badge>
                    <Badge variant={org.subscriptionStatus === 'active' ? 'success' : 'default'}>{org.subscriptionStatus}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Locations', value: `${org.stats.totalLocations} / ${org.maxLocations}` },
                    { label: 'Total SKUs', value: `${org.stats.totalSKUs} / ${getTierLimits(org.subscriptionTier).maxTotalSKUs.toLocaleString()}` },
                    { label: 'Utilization', value: `${((org.stats.totalSKUs / getTierLimits(org.subscriptionTier).maxTotalSKUs) * 100).toFixed(1)}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-neutral-50 p-4 rounded-lg">
                      <div className="text-sm font-semibold text-neutral-700">{label}</div>
                      <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">Locations:</h4>
                  {org.tenants.map((tenant) => (
                    <div key={tenant.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded">
                      <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                        <span className="font-bold text-primary-900 dark:text-primary-100">{tenant.name}</span>
                      </div>
                      <Badge variant="default">{tenant._count.items} SKUs</Badge>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => window.location.href = `/settings/organization?organizationId=${org.id}`}>View Dashboard</Button>
                  <Button variant="secondary" size="sm" onClick={() => openManageModal(org)}>Manage Locations</Button>
                  <Button variant="secondary" size="sm" onClick={() => openEditTierModal(org)}>Edit Tier</Button>
                </div>
              </div>
            </Card>
          ))
        )}

        {organizations.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
            <span className="text-sm font-medium text-neutral-700">Page {currentPage} of {Math.ceil(organizations.length / ITEMS_PER_PAGE)}</span>
            <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.min(Math.ceil(organizations.length / ITEMS_PER_PAGE), p + 1))} disabled={currentPage >= Math.ceil(organizations.length / ITEMS_PER_PAGE)}>Next</Button>
          </div>
        )}
      </div>

      <Modal isOpen={showManageModal} onClose={() => { setShowManageModal(false); setSelectedOrg(null); setSelectedTenantId(''); }} title="Manage Locations" description={selectedOrg ? `Add or remove locations for ${selectedOrg.name}` : ''}>
        {selectedOrg && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 mb-2">Current Locations ({selectedOrg.tenants.length})</h4>
              {selectedOrg.tenants.length === 0 ? <p className="text-sm text-neutral-600">No locations yet</p> : (
                <div className="space-y-2">
                  {selectedOrg.tenants.map((tenant) => (
                    <div key={tenant.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded">
                      <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                        <span className="font-bold text-primary-900 dark:text-primary-100">{tenant.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveTenant(selectedOrg.id, tenant.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">Remove</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 mb-2">Add Location</h4>
              {(() => {
                const available = getAvailableTenantsForOrg();
                return available.length === 0 ? (
                  <p className="text-sm text-neutral-600">{selectedOrg?.tenants.length === 0 ? 'No available tenants to add' : 'All available tenants are already in this organization'}</p>
                ) : (
                  <div className="flex gap-2">
                    <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)} className="w-64 px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                      <option value="">Select a tenant...</option>
                      {available.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                    </select>
                    <Button variant="primary" size="sm" onClick={() => handleAddTenant(selectedOrg.id)} disabled={!selectedTenantId}>Add</Button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        <div className="flex gap-3 justify-end p-4 border-t border-neutral-200">
          <Button variant="ghost" onClick={() => { setShowManageModal(false); setSelectedOrg(null); setSelectedTenantId(''); }}>Close</Button>
        </div>
      </Modal>

      <Modal isOpen={showCreateModal} onClose={() => { if (!processing) { setShowCreateModal(false); setNewOrgName(''); } }} title="Create New Organization">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Organization Name *</label>
            <Input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="e.g., Acme Restaurant Chain" disabled={processing} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Subscription Tier *</label>
            <select value={newOrgTier} onChange={(e) => { const id = e.target.value; setNewOrgTier(id); const l = getTierLimits(id); setNewOrgMaxLocations(l.maxLocations.toString()); setNewOrgMaxSKUs(l.maxTotalSKUs.toString()); }} disabled={tiersLoading} className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
              {tiersLoading ? <option value="">Loading tiers...</option> : tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name} - {getTierPrice(tier.id)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Max Locations *</label>
            <Input type="number" value={newOrgMaxLocations} onChange={(e) => setNewOrgMaxLocations(e.target.value)} placeholder="5" disabled={processing} min="1" />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800"><strong>Note:</strong> Organizations are for multi-location chains.</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end p-4 border-t border-neutral-200">
          <Button variant="ghost" onClick={() => { setShowCreateModal(false); setNewOrgName(''); }} disabled={processing}>Cancel</Button>
          <Button variant="primary" onClick={handleCreateOrganization} disabled={processing || !newOrgName.trim()}>{processing ? 'Creating...' : 'Create Organization'}</Button>
        </div>
      </Modal>

      <Modal isOpen={showEditTierModal} onClose={() => { if (!processing) { setShowEditTierModal(false); setEditingOrg(null); setEditReason(''); } }} title="Edit Organization Tier" description={editingOrg ? `Update subscription tier for ${editingOrg.name}` : ''}>
        {editingOrg && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Current:</strong> {getTierDisplayName(editingOrg.subscriptionTier)}<br />
                <strong>Status:</strong> {editingOrg.subscriptionStatus}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Subscription Tier *</label>
              <select value={editTier} onChange={(e) => { const id = e.target.value; setEditTier(id); const l = getTierLimits(id); setEditMaxLocations(l.maxLocations.toString()); setEditMaxSKUs(l.maxTotalSKUs.toString()); }} disabled={tiersLoading} className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                {tiersLoading ? <option value="">Loading tiers...</option> : tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name} - {getTierPrice(tier.id)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Subscription Status</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} disabled={processing} className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                {['trial', 'active', 'past_due', 'canceled', 'expired'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Reason for Change * (Required for audit trail)</label>
              <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="e.g., Customer upgraded via sales call" rows={3} disabled={processing} className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
        )}
        <div className="flex gap-3 justify-end p-4 border-t border-neutral-200">
          <Button variant="ghost" onClick={() => { setShowEditTierModal(false); setEditingOrg(null); setEditReason(''); }} disabled={processing}>Cancel</Button>
          <Button variant="primary" onClick={handleUpdateOrganizationTier} disabled={processing || !editReason.trim()}>{processing ? 'Updating...' : 'Update Organization'}</Button>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
