'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Building2, Plus, Trash2, MapPin, Star, AlertTriangle, Check, Loader2, Store,
} from 'lucide-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useOrgBehaviorAccess } from '@/hooks/tenant-access/useOrgBehaviorAccess';
import { organizationsService } from '@/services/OrganizationsSingletonService';
import { useToast } from '@/components/ui/use-toast';
import { ToastContainer, Spinner } from '@/components/ui';
import AccessDenied from '@/components/AccessDenied';

interface OrgTenant {
  id: string;
  name: string;
  metadata?: Record<string, any>;
  _count?: { inventory_items: number };
}

interface AvailableTenant {
  id: string;
  name: string;
  subscription_tier?: string;
  subscription_status?: string;
  created_at?: string;
  _count?: { inventory_items: number };
}

export default function OrgLocationsClient() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const { isOrgAdmin, loading: accessLoading, organizationId, isPlatformAdmin } = useOrgBehaviorAccess(tenantId);
  const { success, error, toasts, removeToast } = useToast();

  const [orgTenants, setOrgTenants] = useState<OrgTenant[]>([]);
  const [availableTenants, setAvailableTenants] = useState<AvailableTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLoading, setAddLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [maxLocations, setMaxLocations] = useState(0);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [orgs, available] = await Promise.all([
        organizationsService.getOrganizations(),
        organizationsService.getAvailableTenants(organizationId),
      ]);

      const myOrg = orgs.find((o: any) => o.id === organizationId);
      if (myOrg) {
        setOrgTenants(myOrg.tenants || []);
        setOrgName(myOrg.name || 'Organization');
        setMaxLocations((myOrg as any).maxLocations || (myOrg as any).max_locations || 0);
      }

      setAvailableTenants(available);
    } catch (err) {
      console.error('Failed to load org locations:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!accessLoading && isOrgAdmin && organizationId) {
      loadData();
    }
  }, [loadData, accessLoading, isOrgAdmin, organizationId]);

  const handleAddTenant = async () => {
    if (!selectedTenantId || !organizationId) return;
    setAddLoading(true);
    try {
      const result = await organizationsService.addTenantSelf(organizationId, selectedTenantId);
      const tenantName = result?.name || availableTenants.find(t => t.id === selectedTenantId)?.name || 'Location';
      success(`Successfully added "${tenantName}" to ${orgName}`);
      setSelectedTenantId('');
      setShowAddModal(false);
      await loadData();
    } catch (err: any) {
      error(err?.message || 'Failed to add location. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveTenant = async (tenantIdToRemove: string, tenantName: string) => {
    if (!organizationId) return;
    if (!confirm(`Remove "${tenantName}" from ${orgName}? This will detach it from the organization but won't delete the location.`)) return;
    setRemoveLoading(tenantIdToRemove);
    try {
      await organizationsService.removeTenantSelf(organizationId, tenantIdToRemove);
      success(`Successfully removed "${tenantName}" from ${orgName}`);
      await loadData();
    } catch (err: any) {
      error(err?.message || 'Failed to remove location. Please try again.');
    } finally {
      setRemoveLoading(null);
    }
  };

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isOrgAdmin) {
    return (
      <AccessDenied
        title="Organization Admin Access Required"
        message="You need organization administrator privileges to manage locations."
        userRole={isPlatformAdmin ? 'Platform Admin' : 'User'}
        backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
      />
    );
  }

  const currentCount = orgTenants.length;
  const utilizationPercent = maxLocations > 0 ? Math.round((currentCount / maxLocations) * 100) : 0;
  const isAtCapacity = maxLocations > 0 && currentCount >= maxLocations;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Manage Locations"
        description="Add or remove locations from your organization"
        icon={Icons.Settings}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToastContainer toasts={toasts} onClose={removeToast} />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-amber-500" />
              {orgName}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {currentCount} of {maxLocations || '∞'} locations
              {isAtCapacity && ' (at capacity)'}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={isAtCapacity || availableTenants.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isAtCapacity ? 'Organization is at maximum capacity' : availableTenants.length === 0 ? 'No available locations to add' : 'Add a location'}
          >
            <Plus className="w-4 h-4" />
            Add Location
          </button>
        </div>

        {/* Capacity Bar */}
        {maxLocations > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Capacity Utilization</span>
              <span>{utilizationPercent}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isAtCapacity ? 'bg-red-500' : utilizationPercent > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Current Locations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" />
              Current Locations
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            </div>
          ) : orgTenants.length === 0 ? (
            <div className="text-center py-12">
              <Store className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No locations in this organization yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Use "Add Location" to attach your existing stores
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {orgTenants.map((t) => {
                    const isHero = t.metadata?.isHeroLocation === true;
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                              <Store className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                {t.name}
                                {isHero && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                                    <Star className="w-3 h-3" />
                                    Hero
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                {t.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {t._count?.inventory_items ?? 0} items
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isHero ? (
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                              Primary Location
                            </span>
                          ) : (
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                              Member Location
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {!isHero && (
                            <button
                              onClick={() => handleRemoveTenant(t.id, t.name)}
                              disabled={removeLoading === t.id}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                              title="Remove from organization"
                            >
                              {removeLoading === t.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Self-Service Location Management
          </h3>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            You can attach locations (stores) that you own or manage to this organization. Only locations not already in another organization can be added.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-amber-800 dark:text-amber-200">
            <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> Only locations where you are an owner or admin can be added</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> The hero (primary) location cannot be removed — set another location as hero first</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> Removing a location detaches it from the organization but does not delete it</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> You can add up to {maxLocations || '∞'} locations based on your organization tier</li>
          </ul>
        </div>
      </div>

      {/* Add Location Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Add Location
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select a store to attach to {orgName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowAddModal(false); setSelectedTenantId(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {availableTenants.length === 0 ? (
                <div className="text-center py-8">
                  <Store className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No available locations to add.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    All your locations are already part of an organization.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Location
                    </label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {availableTenants.map((t) => (
                        <label
                          key={t.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                            selectedTenantId === t.id
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <input
                            type="radio"
                            name="tenantSelect"
                            value={t.id}
                            checked={selectedTenantId === t.id}
                            onChange={(e) => setSelectedTenantId(e.target.value)}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <div className="flex-shrink-0 h-9 w-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                            <Store className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {t.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {t._count?.inventory_items ?? 0} items
                              {t.subscription_tier && ` • ${t.subscription_tier}`}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => { setShowAddModal(false); setSelectedTenantId(''); }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      disabled={addLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddTenant}
                      disabled={!selectedTenantId || addLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
                    >
                      {addLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Add to Organization
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
