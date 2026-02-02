'use client';

import { useEffect, useState } from 'react';
import { Card, Badge, Modal, ModalFooter, Input, Select } from '@/components/ui';
import { Button } from '@mantine/core';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useTenantOrganizations } from '@/hooks/useTenantOrganizations';
import { type Organization } from '@/lib/singletons/TenantOrganizationsSingleton';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

const ITEMS_PER_PAGE = 10;

// Organization tier limits configuration
const ORGANIZATION_TIER_LIMITS = {
  chain_starter: {
    maxLocations: 5,
    maxTotalSKUs: 2500,
    displayName: 'Chain Starter',
    price: '$199/mo',
  },
  chain_professional: {
    maxLocations: 25,
    maxTotalSKUs: 12500,
    displayName: 'Chain Professional',
    price: '$1,999/mo',
  },
  chain_enterprise: {
    maxLocations: 999999, // Effectively unlimited for UI purposes
    maxTotalSKUs: 999999, // Effectively unlimited for UI purposes
    displayName: 'Chain Enterprise',
    price: '$4,999/mo',
  },
} as const;

export default function AdminOrganizationsPage() {
  // Use singleton for all data management
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

  // Local UI state (maintained exactly as before)
  const [currentPage, setCurrentPage] = useState(1);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  
  // Create organization state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgTier, setNewOrgTier] = useState('chain_starter');
  const [newOrgMaxLocations, setNewOrgMaxLocations] = useState('5');
  const [newOrgMaxSKUs, setNewOrgMaxSKUs] = useState('2500');

  // Edit organization tier state
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
      await addTenantToOrganization(orgId, selectedTenantId);
      await refreshTenants();
      setSelectedTenantId('');
      // Update selected org with refreshed data
      const updated = organizations.find(o => o.id === orgId);
      if (updated) setSelectedOrg(updated);
    } catch (error) {
      console.error('Failed to add tenant:', error);
      alert('Failed to add tenant. Please try again.');
    }
  };

  const handleRemoveTenant = async (orgId: string, tenantId: string) => {
    try {
      await removeTenantFromOrganization(orgId, tenantId);
      await refreshTenants();
      // Update selected org with refreshed data
      const updated = organizations.find(o => o.id === orgId);
      if (updated) setSelectedOrg(updated);
    } catch (error) {
      console.error('Failed to remove tenant:', error);
      alert('Failed to remove tenant. Please try again.');
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
      alert('Please provide a reason for the tier change');
      return;
    }

    try {
      await updateOrganization(editingOrg.id, {
        subscription_tier: editTier,
        subscription_status: editStatus,
        max_locations: parseInt(editMaxLocations) || 5,
      });
      setShowEditTierModal(false);
      setEditingOrg(null);
      setEditReason('');
      alert('Organization tier updated successfully!');
    } catch (error) {
      console.error('Failed to update organization:', error);
      if (error instanceof Error && error.message.includes('Failed to update organization:')) {
        alert(error.message);
      } else {
        alert('Failed to update organization. Please try again.');
      }
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      alert('Please enter an organization name');
      return;
    }

    try {
      await createOrganization({
        name: newOrgName.trim(),
        subscription_tier: newOrgTier,
        max_locations: parseInt(newOrgMaxLocations) || 10,
      });
      setShowCreateModal(false);
      // Reset form
      setNewOrgName('');
      setNewOrgTier('chain_starter');
      setNewOrgMaxLocations('10');
      setNewOrgMaxSKUs('50000');
      alert('Organization created successfully!');
    } catch (error) {
      console.error('Failed to create organization:', error);
      if (error instanceof Error && error.message.includes('Failed to create organization:')) {
        alert(error.message);
      } else {
        alert('Failed to create organization. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader
          title="Organizations"
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
        title="Organizations"
        description="Manage chain organizations and multi-location accounts"
        icon={Icons.Settings}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />

      <div className="mt-6 space-y-6">
        {/* Header with Create Button */}
        <div className="flex items-center justify-between">
          {organizations.length > 0 ? (
            <p className="text-sm font-medium text-neutral-700">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, organizations.length)} of {organizations.length} organizations
            </p>
          ) : (
            <div />
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            + Create New Organization
          </Button>
        </div>

        {organizations.length === 0 ? (
          <Card className="p-6 rounded-lg">
            <div className="text-center py-12">
              <p className="text-neutral-500">No organizations found</p>
              <p className="text-sm text-neutral-400 mt-2">
                Use the test script to create demo organizations
              </p>
            </div>
          </Card>
        ) : (
          organizations
            .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
            .map((org) => (
            <Card key={org.id} className="p-6 rounded-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{org.name}</h3>
                    <p className="text-sm text-neutral-700 mt-1 font-medium">ID: {org.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="default">{org.subscriptionTier}</Badge>
                    <Badge variant={org.subscriptionStatus === 'active' ? 'success' : 'default'}>
                      {org.subscriptionStatus}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-neutral-50 p-4 rounded-lg">
                    <div className="text-sm font-semibold text-neutral-700">Locations</div>
                    <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {org.stats.totalLocations} / {org.maxLocations}
                    </div>
                  </div>
                  <div className="bg-neutral-50 p-4 rounded-lg">
                    <div className="text-sm font-semibold text-neutral-700">Total SKUs</div>
                    <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {org.stats.totalSKUs} / {org.maxTotalSKUs}
                    </div>
                  </div>
                  <div className="bg-neutral-50 p-4 rounded-lg">
                    <div className="text-sm font-semibold text-neutral-700">Utilization</div>
                    <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {org.stats.utilizationPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">Locations:</h4>
                  {org.tenants.map((tenant) => (
                    <div
                      key={tenant.id}
                      className="flex items-center justify-between p-3 bg-neutral-50 rounded"
                    >
                      <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                        <span className="font-bold text-primary-900 dark:text-primary-100">{tenant.name}</span>
                      </div>
                      <Badge variant="default">{tenant._count.items} SKUs</Badge>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.location.href = `/settings/organization?organizationId=${org.id}`}
                  >
                    View Dashboard
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openManageModal(org)}
                  >
                    Manage Locations
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEditTierModal(org)}
                  >
                    Edit Tier
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}

        {/* Pagination Controls */}
        {organizations.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm font-medium text-neutral-700">
              Page {currentPage} of {Math.ceil(organizations.length / ITEMS_PER_PAGE)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(organizations.length / ITEMS_PER_PAGE), p + 1))}
              disabled={currentPage >= Math.ceil(organizations.length / ITEMS_PER_PAGE)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Manage Locations Modal */}
      <Modal
        isOpen={showManageModal}
        onClose={() => {
          setShowManageModal(false);
          setSelectedOrg(null);
          setSelectedTenantId('');
        }}
        title="Manage Locations"
        description={selectedOrg ? `Add or remove locations for ${selectedOrg.name}` : ''}
      >
        {selectedOrg && (
          <div className="space-y-4">
            {/* Current Locations */}
            <div>
              <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 mb-2">
                Current Locations ({selectedOrg.tenants.length})
              </h4>
              {selectedOrg.tenants.length === 0 ? (
                <p className="text-sm text-neutral-600">No locations yet</p>
              ) : (
                <div className="space-y-2">
                  {selectedOrg.tenants.map((tenant) => (
                    <div
                      key={tenant.id}
                      className="flex items-center justify-between p-3 bg-neutral-50 rounded"
                    >
                      <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                        <span className="font-bold text-primary-900 dark:text-primary-100">{tenant.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTenant(selectedOrg.id, tenant.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Location */}
            <div>
              <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 mb-2">Add Location</h4>
              {availableTenants.length === 0 ? (
                <p className="text-sm text-neutral-600">No available tenants to add</p>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select a tenant...</option>
                    {availableTenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAddTenant(selectedOrg.id)}
                    disabled={!selectedTenantId}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex gap-3 justify-end p-4 border-t border-neutral-200">
          <Button
            variant="ghost"
            onClick={() => {
              setShowManageModal(false);
              setSelectedOrg(null);
              setSelectedTenantId('');
            }}
          >
            Close
          </Button>
        </div>
      </Modal>

      {/* Create Organization Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          if (!processing) {
            setShowCreateModal(false);
            setNewOrgName('');
            setNewOrgTier('chain_starter');
            setNewOrgMaxLocations('10');
            setNewOrgMaxSKUs('50000');
          }
        }}
        title="Create New Organization"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Organization Name *
            </label>
            <Input
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="e.g., Acme Restaurant Chain"
              disabled={processing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Subscription Tier *
            </label>
            <select
              value={newOrgTier}
              onChange={(e) => {
                const tier = e.target.value as keyof typeof ORGANIZATION_TIER_LIMITS;
                setNewOrgTier(tier);
                // Auto-populate limits based on tier
                const limits = ORGANIZATION_TIER_LIMITS[tier];
                setNewOrgMaxLocations(limits.maxLocations.toString());
                setNewOrgMaxSKUs(limits.maxTotalSKUs.toString());
              }}
              disabled={processing}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="chain_starter">
                Chain Starter - {ORGANIZATION_TIER_LIMITS.chain_starter.price}
              </option>
              <option value="chain_professional">
                Chain Professional - {ORGANIZATION_TIER_LIMITS.chain_professional.price}
              </option>
              <option value="chain_enterprise">
                Chain Enterprise - {ORGANIZATION_TIER_LIMITS.chain_enterprise.price}
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Max Locations *
            </label>
            <Input
              type="number"
              value={newOrgMaxLocations}
              onChange={(e) => setNewOrgMaxLocations(e.target.value)}
              placeholder="5"
              disabled={processing}
              min="1"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Auto-populated based on tier. Platform admins can customize if needed.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Max Total SKUs *
            </label>
            <Input
              type="number"
              value={newOrgMaxSKUs}
              onChange={(e) => setNewOrgMaxSKUs(e.target.value)}
              placeholder="2500"
              disabled={processing}
              min="1"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Auto-populated based on tier. Platform admins can customize if needed.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Organizations are for multi-location chains. 
              Individual tenants can request to join organizations through the tenant settings page.
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end p-4 border-t border-neutral-200">
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreateModal(false);
              setNewOrgName('');
              setNewOrgTier('chain_starter');
              setNewOrgMaxLocations('5');
              setNewOrgMaxSKUs('2500');
            }}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateOrganization}
            disabled={processing || !newOrgName.trim()}
          >
            {processing ? 'Creating...' : 'Create Organization'}
          </Button>
        </div>
      </Modal>

      {/* Edit Organization Tier Modal */}
      <Modal
        isOpen={showEditTierModal}
        onClose={() => {
          if (!processing) {
            setShowEditTierModal(false);
            setEditingOrg(null);
            setEditReason('');
          }
        }}
        title="Edit Organization Tier"
        description={editingOrg ? `Update subscription tier for ${editingOrg.name}` : ''}
      >
        {editingOrg && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Current:</strong> {ORGANIZATION_TIER_LIMITS[editingOrg.subscriptionTier as keyof typeof ORGANIZATION_TIER_LIMITS]?.displayName || editingOrg.subscriptionTier}
                <br />
                <strong>Locations:</strong> {editingOrg.stats.totalLocations} / {editingOrg.maxLocations}
                <br />
                <strong>SKUs:</strong> {editingOrg.stats.totalSKUs} / {editingOrg.maxTotalSKUs}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Subscription Tier *
              </label>
              <select
                value={editTier}
                onChange={(e) => {
                  const tier = e.target.value as keyof typeof ORGANIZATION_TIER_LIMITS;
                  setEditTier(tier);
                  // Auto-populate limits based on tier
                  const limits = ORGANIZATION_TIER_LIMITS[tier];
                  if (limits) {
                    setEditMaxLocations(limits.maxLocations.toString());
                    setEditMaxSKUs(limits.maxTotalSKUs.toString());
                  }
                }}
                disabled={processing}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="chain_starter">
                  Chain Starter - {ORGANIZATION_TIER_LIMITS.chain_starter.price}
                </option>
                <option value="chain_professional">
                  Chain Professional - {ORGANIZATION_TIER_LIMITS.chain_professional.price}
                </option>
                <option value="chain_enterprise">
                  Chain Enterprise - {ORGANIZATION_TIER_LIMITS.chain_enterprise.price}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Subscription Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                disabled={processing}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="past_due">Past Due</option>
                <option value="canceled">Canceled</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Max Total SKUs
              </label>
              <Input
                type="number"
                value={editMaxSKUs}
                onChange={(e) => setEditMaxSKUs(e.target.value)}
                disabled={processing}
                min="1"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Auto-populated based on tier. Customize if needed.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Reason for Change * (Required for audit trail)
              </label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="e.g., Customer upgraded to Chain Professional via sales call"
                rows={3}
                disabled={processing}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}
        <div className="flex gap-3 justify-end p-4 border-t border-neutral-200">
          <Button
            variant="ghost"
            onClick={() => {
              setShowEditTierModal(false);
              setEditingOrg(null);
              setEditReason('');
            }}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdateOrganizationTier}
            disabled={processing || !editReason.trim()}
          >
            {processing ? 'Updating...' : 'Update Tier'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
