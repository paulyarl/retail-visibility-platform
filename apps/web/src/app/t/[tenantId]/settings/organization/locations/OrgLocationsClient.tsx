'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, Plus, Trash2, MapPin, AlertTriangle, Check, Loader2, Store,
  Crown, Settings as SettingsIcon, ExternalLink,
} from 'lucide-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useOrgBehaviorAccess } from '@/hooks/tenant-access/useOrgBehaviorAccess';
import { useAuth } from '@/contexts/AuthContext';
import { organizationsService } from '@/services/OrganizationsSingletonService';
import { useToast } from '@/components/ui/use-toast';
import { ToastContainer, Spinner } from '@/components/ui';
import AccessDenied from '@/components/AccessDenied';

interface OrgTenant {
  id: string;
  name: string;
  metadata?: Record<string, any>;
  _count?: { inventory_items: number };
  location_status?: string;
  subscription_status?: string;
  subscription_tier?: string;
  is_demo?: boolean;
  directory_visible?: boolean;
  slug?: string | null;
  subdomain?: string | null;
  service_level?: string;
  featured_access_approved?: boolean;
}

interface AvailableTenant {
  id: string;
  name: string;
  subscription_tier?: string;
  subscription_status?: string;
  created_at?: string;
  _count?: { inventory_items: number };
}

export default function OrgLocationsClient({ organizationId: propOrgId }: { organizationId?: string }) {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const { isOrgAdmin, loading: accessLoading, organizationId: hookOrgId, isPlatformAdmin } = useOrgBehaviorAccess(tenantId);
  const organizationId = hookOrgId || propOrgId;
  const { user: authUser, isLoading: authLoading } = useAuth();
  const userIsPlatformAdmin = isPlatformAdmin || authUser?.role === 'PLATFORM_ADMIN' || authUser?.role === 'ADMIN';
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

  const [heroLoading, setHeroLoading] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [org, available] = await Promise.all([
        organizationsService.getOrganizationById(organizationId),
        organizationsService.getAvailableTenants(organizationId),
      ]);

      if (org) {
        const orgAny = org as any;
        setOrgTenants(orgAny.tenants || []);
        setOrgName(orgAny.name || 'Organization');
        setMaxLocations(orgAny.maxLocations || orgAny.max_locations || 0);
      }

      setAvailableTenants(available);
    } catch (err) {
      console.error('Failed to load org locations:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!accessLoading && !authLoading && (isOrgAdmin || userIsPlatformAdmin || propOrgId) && organizationId) {
      loadData();
    } else if (!accessLoading && !authLoading && (!isOrgAdmin || !organizationId)) {
      setLoading(false);
    }
  }, [loadData, accessLoading, authLoading, isOrgAdmin, userIsPlatformAdmin, organizationId, propOrgId]);

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

  const handleSetHero = async (tenantIdToHero: string, tenantName: string) => {
    if (!organizationId) return;
    if (!confirm(`Set "${tenantName}" as the hero (primary) location for ${orgName}?`)) return;
    setHeroLoading(tenantIdToHero);
    try {
      await organizationsService.updateHeroLocation(organizationId, tenantIdToHero);
      success(`"${tenantName}" is now the hero location.`);
      await loadData();
    } catch (err: any) {
      error(err?.message || 'Failed to set hero location.');
    } finally {
      setHeroLoading(null);
    }
  };

  const handleStatusChange = async (tenantIdToUpdate: string, newStatus: string, tenantName: string) => {
    const statusLabels: Record<string, string> = {
      active: 'Active', inactive: 'Temporarily Closed', closed: 'Permanently Closed',
      pending: 'Pending', archived: 'Archived',
    };
    const needsReason = newStatus === 'closed' || newStatus === 'archived';
    const reason = needsReason
      ? prompt(`Reason for changing "${tenantName}" to ${statusLabels[newStatus]}? (required)`, '')
      : undefined;
    if (needsReason && !reason) return;

    setStatusLoading(tenantIdToUpdate);
    try {
      await organizationsService.updateTenantStatus(tenantIdToUpdate, newStatus, reason || undefined);
      success(`"${tenantName}" status changed to ${statusLabels[newStatus] || newStatus}.`);
      await loadData();
    } catch (err: any) {
      error(err?.message || 'Failed to update location status.');
    } finally {
      setStatusLoading(null);
    }
  };

  if (accessLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isOrgAdmin && !userIsPlatformAdmin && !propOrgId) {
    return (
      <AccessDenied
        title="Organization Admin Access Required"
        message="You need organization administrator privileges to manage locations."
        userRole={userIsPlatformAdmin ? 'Platform Admin' : 'User'}
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

        {!organizationId ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <Building2 className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Organization
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              This location is not part of an organization. Create or join an organization to manage multiple locations from one place.
            </p>
            <Link href={`/t/${tenantId}/settings/organization`} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors mt-4">
              <Building2 className="w-5 h-5" />
              Create or Join Organization
            </Link>
          </div>
        ) : (
          <>
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
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Subscription
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {orgTenants.map((t) => {
                    const isHero = t.metadata?.isHeroLocation === true;
                    const statusColors: Record<string, string> = {
                      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
                      inactive: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
                      closed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
                      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
                      archived: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
                    };
                    const statusLabels: Record<string, string> = {
                      active: 'Active', inactive: 'Temp Closed', closed: 'Closed',
                      pending: 'Pending', archived: 'Archived',
                    };
                    const locStatus = t.location_status || 'active';
                    const subStatus = t.subscription_status || 'unknown';
                    const subTier = t.subscription_tier || '—';
                    const isDemo = t.is_demo === true;
                    const isBusy = removeLoading === t.id || heroLoading === t.id || statusLoading === t.id;
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                              <Store className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                                {t.name}
                                {isHero && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                                    <Crown className="w-3 h-3" />
                                    Hero
                                  </span>
                                )}
                                {isDemo && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">
                                    Demo
                                  </span>
                                )}
                                {t.directory_visible === false && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                                    Hidden
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                {t.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[locStatus] || statusColors.active}`}>
                              {statusLabels[locStatus] || locStatus}
                            </span>
                            {userIsPlatformAdmin && !isBusy && (
                              <select
                                value={locStatus}
                                onChange={(e) => handleStatusChange(t.id, e.target.value, t.name)}
                                className="text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-1 py-0.5"
                                title="Change location status"
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Temp Closed</option>
                                <option value="closed">Permanently Closed</option>
                                <option value="pending">Pending</option>
                                <option value="archived">Archived</option>
                              </select>
                            )}
                            {statusLoading === t.id && (
                              <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-900 dark:text-white capitalize">
                              {subTier.replace(/_/g, ' ')}
                            </span>
                            <span className={`text-xs capitalize ${
                              subStatus === 'active' ? 'text-green-600 dark:text-green-400' :
                              subStatus === 'trialing' || subStatus === 'trial' ? 'text-blue-600 dark:text-blue-400' :
                              subStatus === 'past_due' || subStatus === 'canceled' ? 'text-red-600 dark:text-red-400' :
                              'text-gray-500 dark:text-gray-400'
                            }`}>
                              {subStatus}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {t._count?.inventory_items ?? 0} items
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {!isHero && (
                              <button
                                onClick={() => handleSetHero(t.id, t.name)}
                                disabled={isBusy}
                                className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 disabled:opacity-50"
                                title="Set as hero location"
                              >
                                {heroLoading === t.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Crown className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <Link
                              href={`/t/${t.id}/settings`}
                              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              title="Location settings"
                            >
                              <SettingsIcon className="w-4 h-4" />
                            </Link>
                            <Link
                              href={`/t/${t.id}/dashboard`}
                              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Open location dashboard"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                            {!isHero && (
                              <button
                                onClick={() => handleRemoveTenant(t.id, t.name)}
                                disabled={isBusy}
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
                          </div>
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
            <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> Click the crown icon to set a location as the hero (primary) location</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> Use the status dropdown to change a location's operational status (active, temp closed, etc.)</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> Only locations where you are an owner or admin can be added</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> The hero (primary) location cannot be removed — set another location as hero first</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> Removing a location detaches it from the organization but does not delete it</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> You can add up to {maxLocations || '∞'} locations based on your organization tier</li>
          </ul>
        </div>
          </>
        )}
      </div>

      {/* Add Location Modal */}
      {showAddModal && organizationId && (
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
