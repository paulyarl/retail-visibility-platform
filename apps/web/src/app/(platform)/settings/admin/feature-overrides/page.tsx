'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAccessControl } from '@/lib/auth/useAccessControl';
import { FEATURE_DISPLAY_NAMES } from '@/lib/tiers/tier-features';

interface FeatureOverride {
  id: string;
  tenantId: string;
  tenant_id: string;
  feature: string;
  granted: boolean;
  reason?: string;
  expires_at?: string;
  expiresAtDate?: string;
  expiresAtTime?: string;
  grantedBy: string;
  createdAt: string;
  updatedAt: string;
  tenants: {
    id: string;
    name: string;
    subscription_tier: string;
    subscription_status: string;
  };
  isExpired: boolean;
  isActive: boolean;
}

interface Tenant {
  id: string;
  name: string;
  subscriptionTier: string;
}

export default function FeatureOverridesPage() {
  const { user, isPlatformAdmin, loading: accessLoading } = useAccessControl(null);
  const [overrides, setOverrides] = useState<FeatureOverride[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOverride, setEditingOverride] = useState<FeatureOverride | null>(null);
  
  // Filters
  const [filterTenant, setFilterTenant] = useState('');
  const [filterFeature, setFilterFeature] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  // Form state
  const [formData, setFormData] = useState({
    tenantId: '',
    feature: '',
    granted: true,
    reason: '',
    expiresAt: '',
    expiresAtDate: '',
    expiresAtTime: '',
  });

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchOverrides();
      fetchTenants();
    }
  }, [isPlatformAdmin]);

  const fetchOverrides = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterTenant) params.append('tenantId', filterTenant);
      if (filterFeature) params.append('feature', filterFeature);
      if (filterActive !== 'all') params.append('active', filterActive);

      const res = await api.get(`/api/admin/feature-overrides?${params}`);
      if (!res.ok) throw new Error('Failed to fetch overrides');
      
      const data = await res.json();
      setOverrides(data.overrides || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const res = await api.get('/api/admin/tenants');
      if (!res.ok) throw new Error('Failed to fetch tenants');
      
      const data = await res.json();
      // Backend returns array directly, not wrapped in { tenants: [] }
      setTenants(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch tenants:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Combine date and time fields for ISO 8601 format
      let expiresAt: string | undefined;
      if (formData.expiresAtDate && formData.expiresAtTime) {
        expiresAt = new Date(`${formData.expiresAtDate}T${formData.expiresAtTime}`).toISOString();
      } else if (formData.expiresAtDate) {
        expiresAt = new Date(`${formData.expiresAtDate}T23:59:59`).toISOString();
      }

      const payload = {
        tenantId: formData.tenantId,
        feature: formData.feature,
        granted: formData.granted,
        reason: formData.reason,
        expires_at: expiresAt,
      };

      const res = await api.post('/api/admin/feature-overrides', payload);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create override');
      }

      setShowCreateModal(false);
      setFormData({
        tenantId: '',
        feature: '',
        granted: true,
        reason: '',
        expiresAt: '',
        expiresAtDate: '',
        expiresAtTime: '',
      });
      fetchOverrides();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOverride) return;

    try {
      // Combine date and time fields for ISO 8601 format
      let expiresAt: string | null;
      if (formData.expiresAtDate && formData.expiresAtTime) {
        expiresAt = new Date(`${formData.expiresAtDate}T${formData.expiresAtTime}`).toISOString();
      } else if (formData.expiresAtDate) {
        expiresAt = new Date(`${formData.expiresAtDate}T23:59:59`).toISOString();
      } else {
        expiresAt = null;
      }

      const payload = {
        granted: formData.granted,
        reason: formData.reason,
        expires_at: expiresAt,
      };

      const res = await api.put(`/api/admin/feature-overrides/${editingOverride.id}`, payload);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update override');
      }

      setEditingOverride(null);
      setFormData({
        tenantId: '',
        feature: '',
        granted: true,
        reason: '',
        expiresAt: '',
        expiresAtDate: '',
        expiresAtTime: '',
      });
      fetchOverrides();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this override?')) return;

    try {
      const res = await api.delete(`/api/admin/feature-overrides/${id}`);
      if (!res.ok) throw new Error('Failed to delete override');
      
      fetchOverrides();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (override: FeatureOverride) => {
    setEditingOverride(override);
    // Parse the expires_at date into separate date and time fields
    let expiresAtDate = '';
    let expiresAtTime = '';
    if (override.expires_at) {
      const date = new Date(override.expires_at);
      expiresAtDate = date.toISOString().slice(0, 10); // YYYY-MM-DD
      expiresAtTime = date.toISOString().slice(11, 16); // HH:MM
    }
    
    setFormData({
      tenantId: override.tenantId,
      feature: override.feature,
      granted: override.granted,
      reason: override.reason || '',
      expiresAt: override.expires_at ? new Date(override.expires_at).toISOString().slice(0, 16) : '',
      expiresAtDate,
      expiresAtTime,
    });
  };

  const handleCleanupExpired = async () => {
    if (!confirm('Remove all expired overrides?')) return;

    try {
      const res = await api.post('/api/admin/feature-overrides/cleanup-expired');
      if (!res.ok) throw new Error('Failed to cleanup expired overrides');
      
      const data = await res.json();
      alert(`Removed ${data.removedCount} expired override(s)`);
      fetchOverrides();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Show loading state while checking access
  if (accessLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show access denied after loading completes
  if (!isPlatformAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Access denied. Platform admin access required.</p>
        </div>
      </div>
    );
  }

  const availableFeatures = Object.keys(FEATURE_DISPLAY_NAMES);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Feature Overrides
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Grant or revoke specific tier features for individual tenants
        </p>
      </div>

      {/* Actions Bar */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              + Create Override
            </button>
            <button
              onClick={handleCleanupExpired}
              className="px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
            >
              🗑️ Cleanup Expired
            </button>
            <button
              onClick={fetchOverrides}
              className="px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={filterTenant}
              onChange={(e) => setFilterTenant(e.target.value)}
              className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
            >
              <option value="">All Tenants</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            
            <select
              value={filterFeature}
              onChange={(e) => setFilterFeature(e.target.value)}
              className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
            >
              <option value="">All Features</option>
              {availableFeatures.map(f => (
                <option key={f} value={f}>{FEATURE_DISPLAY_NAMES[f]}</option>
              ))}
            </select>
            
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
            >
              <option value="all">All Status</option>
              <option value="true">Active Only</option>
            </select>
            
            <button
              onClick={fetchOverrides}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Overrides Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-600 dark:text-neutral-400">
            Loading overrides...
          </div>
        ) : overrides.length === 0 ? (
          <div className="p-8 text-center text-neutral-600 dark:text-neutral-400">
            No overrides found. Create one to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-700 border-b border-neutral-200 dark:border-neutral-600">
                <tr>
                  <th className="text-left p-4 font-semibold text-neutral-900 dark:text-neutral-100">Tenant</th>
                  <th className="text-left p-4 font-semibold text-neutral-900 dark:text-neutral-100">Feature</th>
                  <th className="text-left p-4 font-semibold text-neutral-900 dark:text-neutral-100">Status</th>
                  <th className="text-left p-4 font-semibold text-neutral-900 dark:text-neutral-100">Reason</th>
                  <th className="text-left p-4 font-semibold text-neutral-900 dark:text-neutral-100">Expires</th>
                  <th className="text-left p-4 font-semibold text-neutral-900 dark:text-neutral-100">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {overrides.map((override) => (
                  <tr key={override.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          {override.tenants.name}
                        </div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          {override.tenants.subscription_tier}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-neutral-900 dark:text-neutral-100">
                        {FEATURE_DISPLAY_NAMES[override.feature] || override.feature}
                      </div>
                    </td>
                    <td className="p-4">
                      {override.isExpired ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-300">
                          Expired
                        </span>
                      ) : override.granted ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                          ✓ Granted
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                          ✗ Revoked
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-neutral-700 dark:text-neutral-300 text-sm">
                      {override.reason || '-'}
                    </td>
                    <td className="p-4 text-neutral-700 dark:text-neutral-300 text-sm">
                      {override.expires_at 
                        ? new Date(override.expires_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(override)}
                          className="px-3 py-1 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(override.id)}
                          className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Create Feature Override
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Tenant
                </label>
                <select
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="">Select tenant...</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subscriptionTier})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Feature
                </label>
                <select
                  value={formData.feature}
                  onChange={(e) => setFormData({ ...formData, feature: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="">Select feature...</option>
                  {availableFeatures.map(f => (
                    <option key={f} value={f}>
                      {FEATURE_DISPLAY_NAMES[f]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Access
                </label>
                <select
                  value={formData.granted ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, granted: e.target.value === 'true' })}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="true">✓ Grant Access</option>
                  <option value="false">✗ Revoke Access</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., Beta tester, Custom deal, Support exception"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Expires At (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.expiresAtDate}
                      onChange={(e) => setFormData({ ...formData, expiresAtDate: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={formData.expiresAtTime}
                      onChange={(e) => setFormData({ ...formData, expiresAtTime: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Set both date and time, or just date (defaults to 11:59 PM)
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Create Override
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingOverride && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Edit Feature Override
            </h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Tenant
                </label>
                <input
                  type="text"
                  value={editingOverride.tenants.name}
                  disabled
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Feature
                </label>
                <input
                  type="text"
                  value={FEATURE_DISPLAY_NAMES[editingOverride.feature] || editingOverride.feature}
                  disabled
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Access
                </label>
                <select
                  value={formData.granted ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, granted: e.target.value === 'true' })}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="true">✓ Grant Access</option>
                  <option value="false">✗ Revoke Access</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., Beta tester, Custom deal, Support exception"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Expires At (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.expiresAtDate}
                      onChange={(e) => setFormData({ ...formData, expiresAtDate: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={formData.expiresAtTime}
                      onChange={(e) => setFormData({ ...formData, expiresAtTime: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Update Override
                </button>
                <button
                  type="button"
                  onClick={() => setEditingOverride(null)}
                  className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
