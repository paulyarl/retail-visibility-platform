"use client";
import React, { useEffect, useRef, useState } from "react";
import { adminPlatformFlagsService } from '@/services/AdminPlatformFlagsService';

type FlagRow = { id: string; flag: string; enabled: boolean; description?: string | null; rollout?: string | null; allowTenantOverride?: boolean };
type EffectiveRow = {
  flag: string;
  effectiveOn: boolean;
  effectiveSource: 'env' | 'override' | 'platform_db' | 'off';
  sources: { platform_env: boolean; platform_db: boolean; allow_override: boolean; platform_override?: boolean };
};

const FLAG_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  FF_MAP_CARD: {
    title: 'Map Card',
    description: 'Google Maps integration for tenant locations with privacy controls',
  },
  FF_SWIS_PREVIEW: {
    title: 'SWIS Preview',
    description: 'Product preview widget showing live inventory feed',
  },
  FF_BUSINESS_PROFILE: {
    title: 'Business Profile',
    description: 'Complete business profile management and onboarding',
  },
  FF_DARK_MODE: {
    title: 'Dark Mode',
    description: 'Dark theme support across the platform (coming soon)',
  },
  FF_GOOGLE_CONNECT_SUITE: {
    title: 'Google Connect Suite',
    description: 'Unified Google Merchant Center + Business Profile integration (v1: read-only)',
  },
  FF_APP_SHELL_NAV: {
    title: 'App Shell Navigation',
    description: 'Enable the new header and Tenant Switcher (URL-driven tenant context)',
  },
  FF_TENANT_URLS: {
    title: 'Tenant-Scoped URLs',
    description: 'Enable tenant-scoped routes like /t/{tenantId}/items and /t/{tenantId}/settings',
  },
  FF_ITEMS_V2_GRID: {
    title: 'Items Grid v2',
    description: 'Enable the new high-performance items grid (virtualized, faster filters)',
  },
  FF_CATEGORY_MANAGEMENT_PAGE: {
    title: 'Category Management',
    description: 'Enable category management page and features',
  },
  FF_CATEGORY_QUICK_ACTIONS: {
    title: 'Category Quick Actions',
    description: 'Enable quick actions for category management',
  },
  FF_GLOBAL_TENANT_META: {
    title: 'Global Tenant Metadata',
    description: 'Enable global tenant metadata management',
  },
  FF_TENANT_GBP_CATEGORY_SYNC: {
    title: 'GBP Category Sync',
    description: 'Google Business Profile category sync for tenant directory listings',
  },
  FF_CATEGORY_MIRRORING: {
    title: 'Category Mirroring',
    description: 'Mirror categories between platform and Google Business Profile',
  },
};

export default function AdminPlatformFlags() {
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [effective, setEffective] = useState<Record<string, EffectiveRow>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [debug, setDebug] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const editRef = useRef<HTMLTableRowElement>(null);

  // Load flags and effective flags
  const load = async () => {
    setLoading(true);
    setError(null);
    setDebug(false);
    try {
      const [flagsData, effectiveData] = await Promise.all([
        adminPlatformFlagsService.getPlatformFlags(),
        adminPlatformFlagsService.getEffectiveFlags()
      ]);
      setRows(flagsData);
      setEffective(effectiveData);
    } catch (err) {
      console.error('[AdminPlatformFlags] Error loading data:', err);
      setError('Failed to load platform flags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (flag: string, next: Partial<FlagRow>) => {
    setSaving(prev => ({ ...prev, [flag]: true }));
    setError(null);
    try {
      // Filter out null values for the service
      const updateData: any = {};
      if (next.enabled !== undefined) updateData.enabled = next.enabled;
      if (next.description !== undefined && next.description !== null) updateData.description = next.description;
      if (next.rollout !== undefined) updateData.rollout = next.rollout;
      if (next.allowTenantOverride !== undefined) updateData.allowTenantOverride = next.allowTenantOverride;
      
      const updatedFlag = await adminPlatformFlagsService.updatePlatformFlag(flag, updateData);
      if (updatedFlag) {
        setRows(prev => prev.map(row => row.flag === flag ? { ...row, ...next } : row));
      }
    } catch (err) {
      console.error('[AdminPlatformFlags] Error saving flag:', err);
      setError(`Failed to update flag: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(prev => ({ ...prev, [flag]: false }));
    }
  };

  const setOverride = async (flag: string, value: boolean | null) => {
    setSaving(prev => ({ ...prev, [flag]: true }));
    setError(null);
    try {
      await adminPlatformFlagsService.setFlagOverride(flag, value);
      await load(); // Reload to get updated effective flags
    } catch (err) {
      console.error('[AdminPlatformFlags] Error setting override:', err);
      setError(`Failed to set override: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(prev => ({ ...prev, [flag]: false }));
    }
  };

  const resetOverride = async (flag: string) => {
    setSaving(prev => ({ ...prev, [flag]: true }));
    setError(null);
    try {
      await adminPlatformFlagsService.resetFlagOverride(flag);
      await load(); // Reload to get updated effective flags
    } catch (err) {
      console.error('[AdminPlatformFlags] Error resetting override:', err);
      setError(`Failed to reset override: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(prev => ({ ...prev, [flag]: false }));
    }
  };

  const handleDelete = async (flag: string) => {
    if (!confirm(`Are you sure you want to delete the "${flag}" flag? This action cannot be undone.`)) {
      return;
    }
    
    setSaving(prev => ({ ...prev, [flag]: true }));
    setError(null);
    try {
      const success = await adminPlatformFlagsService.deletePlatformFlag(flag);
      if (success) {
        setRows(prev => prev.filter(row => row.flag !== flag));
        await load(); // Reload to get updated effective flags
      }
    } catch (err) {
      console.error('[AdminPlatformFlags] Error deleting flag:', err);
      setError(`Failed to delete flag: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(prev => ({ ...prev, [flag]: false }));
    }
  };

  const getFlagInfo = (flag: string) => {
    return FLAG_DESCRIPTIONS[flag] || { title: flag, description: 'No description available' };
  };

  const getEffectiveInfo = (flag: string) => {
    const info = effective[flag];
    if (!info) return null;
    const divergent = info.sources.platform_env !== info.sources.platform_db && info.effectiveSource === 'env';
    return {
      source: info.effectiveSource,
      color: info.effectiveOn ? 'text-green-600' : 'text-gray-400',
      icon: info.effectiveOn ? '✓' : '✗',
      description: `Effective: ${info.effectiveSource} (${info.effectiveOn ? 'ON' : 'OFF'})`,
      divergent,
    };
  };

  const getFlagStatusColor = (enabled: boolean) => {
    return enabled ? 'text-green-600' : 'text-gray-400';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Platform Flags</h1>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-600 font-medium mb-2">Error</div>
          <div className="text-red-800 text-sm">{error}</div>
        </div>
      )}

      {debug && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-gray-600 font-medium mb-2">Debug Info</div>
          <div className="text-gray-800 text-sm">
            <div>Flags loaded: {rows.length}</div>
            <div>Effective flags: {Object.keys(effective).length}</div>
            <div>Cached: {rows.length > 0 ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Flag
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Enabled
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rollout
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Override
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const flagInfo = getFlagInfo(row.flag);
              const effectiveInfo = getEffectiveInfo(row.flag);
              const isSaving = saving[row.flag];
              const hasOverride = effectiveInfo?.source !== 'platform_db';
              
              return (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-mono text-sm text-gray-900">{row.flag}</div>
                    <div className="text-xs text-gray-500 mt-1">{flagInfo.title}</div>
                    {effectiveInfo?.divergent && (
                      <div className="text-xs text-amber-600 mt-1" title="Environment variable overrides DB value">
                        ⚠ env overrides DB
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleSave(row.flag, { enabled: !row.enabled })}
                      disabled={isSaving}
                      className={`relative inline-flex h-6 w-11 rounded-full border-2 transition-colors focus:outline-none ${getFlagStatusColor(row.enabled)} ${
                        isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100'
                      }`}
                    >
                      <div
                        className={`inline-flex h-5 w-5 rounded-full border-2 transition-colors ${
                          row.enabled ? 'bg-blue-600 border-blue-600' : 'bg-gray-200 border-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-flex h-5 w-5 rounded-full border-2 transition-colors ${
                            row.enabled ? 'bg-blue-600 border-blue-600' : 'bg-gray-200 border-gray-200'
                          }`}
                          style={{
                            transform: row.enabled ? 'translateX(-50%)' : 'translateX(0)',
                            transition: 'transform 0.2s ease-in-out'
                          }}
                        >
                          <span
                            className={`inline-block w-2 h-2 rounded-full bg-white transition-transform ${
                              row.enabled ? 'translate-x-1' : 'translate-x-0'
                            }`}
                            style={{
                              transform: row.enabled ? 'translateX(0)' : 'translateX(-1)'
                            }}
                          />
                        </span>
                      </div>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{row.description || 'No description'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500">
                      {row.rollout || 'Not set'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {hasOverride && effectiveInfo ? (
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${effectiveInfo.color}`}>
                          {effectiveInfo.icon}
                        </span>
                        <span className="text-xs text-gray-500">
                          {effectiveInfo.description}
                        </span>
                        <button
                          onClick={() => resetOverride(row.flag)}
                          disabled={isSaving}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          Reset
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">No override</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditing(row.flag)}
                        disabled={isSaving}
                        className="text-blue-600 hover:text-blue-800 underline text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(row.flag)}
                        disabled={isSaving}
                        className="text-red-600 hover:text-red-800 underline text-sm"
                      >
                        Delete
                      </button>
                      {hasOverride && (
                        <button
                          onClick={() => setOverride(row.flag, null)}
                          disabled={isSaving}
                          className="text-orange-600 hover:text-orange-800 underline text-sm"
                        >
                          Clear
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

      <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
        <div>
          {rows.length} flags loaded • {Object.values(effective).filter(f => f.effectiveOn).length} effective
          {Object.values(effective).filter(f => f.sources.platform_env !== f.sources.platform_db && f.effectiveSource === 'env').length > 0 && (
            <span className="text-amber-600"> • {Object.values(effective).filter(f => f.sources.platform_env !== f.sources.platform_db && f.effectiveSource === 'env').length} env-divergent</span>
          )}
        </div>
        <button
          onClick={() => setDebug(!debug)}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          {debug ? 'Hide Debug' : 'Show Debug'}
        </button>
      </div>
    </div>
  );
}
