"use client";
import React, { useEffect, useRef, useState } from "react";
import { api } from '@/lib/api';

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
  FF_ENFORCE_CSRF: {
    title: 'CSRF Protection',
    description: 'Enforce CSRF token validation on write operations',
  },
};

export default function AdminPlatformFlags() {
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [effective, setEffective] = useState<Record<string, EffectiveRow>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(`/api/admin/platform-flags`);
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
      setRows(j.data || []);

      // load effective
      const e = await api.get(`/api/admin/effective-flags`);
      const ej = await e.json();
      if (!e.ok || !ej?.success) throw new Error(ej?.error || `HTTP ${e.status}`);
      const map: Record<string, EffectiveRow> = {};
      for (const it of (ej.data || [])) map[it.flag] = it;
      setEffective(map);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    load();
  }, []);

  const upsert = async (flag: string, next: Partial<FlagRow>) => {
    setSaving(flag);
    setError(null);
    try {
      const r = await api.put(`/api/admin/platform-flags/${encodeURIComponent(flag)}`, {
        enabled: next.enabled,
        description: next.description ?? null,
        rollout: next.rollout ?? null,
        allowTenantOverride: next.allowTenantOverride
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(null);
    }
  };

  const addFlag = async () => {
    const flag = prompt("Enter flag key (e.g., FF_TENANT_URLS)")?.trim();
    if (!flag) return;
    await upsert(flag, { enabled: true });
  };

  const setOverride = async (flag: string, value: boolean | null) => {
    try {
      setSaving(flag);
      const r = await api.post(`/api/admin/flags/override/platform/${encodeURIComponent(flag)}`, { value });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(null);
    }
  };

  const deleteFlag = async (flag: string) => {
    const confirmed = confirm(
      `⚠️ Delete Feature Flag?\n\n` +
      `Flag: ${flag}\n\n` +
      `This will delete the platform flag and all tenant overrides.\n` +
      `This action cannot be undone.\n\n` +
      `Are you sure?`
    );
    
    if (!confirmed) return;
    
    setSaving(flag);
    setError(null);
    try {
      const r = await api.delete(`/api/admin/platform-flags`, { 
        body: JSON.stringify({ flag }),
        headers: { 'Content-Type': 'application/json' }
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
      if (j.tenantUsageCount > 0) {
        alert(`✅ Deleted flag and ${j.tenantUsageCount} tenant override(s)`);
      }
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Loading flags…</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Platform Feature Flags</h2>
        <button className="bg-black text-white px-3 py-1 rounded" onClick={addFlag}>Add Flag</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-2">Flag</th>
            <th className="py-2">Enabled</th>
            <th className="py-2">Allow Tenant Override</th>
            <th className="py-2">Description</th>
            <th className="py-2">Rollout</th>
            <th className="py-2">Live</th>
            <th className="py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const hardcodedDesc = FLAG_DESCRIPTIONS[r.flag];
            const displayDesc = r.description || hardcodedDesc?.description;
            return (
            <tr key={r.id} className="border-t">
              <td className="py-2 pr-4">
                <div className="font-mono text-sm">{r.flag}</div>
                {displayDesc && (
                  <div className="mt-1">
                    {hardcodedDesc?.title && <div className="text-xs font-semibold text-gray-700">{hardcodedDesc.title}</div>}
                    <div className="text-xs text-gray-500">{displayDesc}</div>
                  </div>
                )}
              </td>
              <td className="py-2 pr-4">
                <input type="checkbox" checked={r.enabled} onChange={(e) => upsert(r.flag, { enabled: e.target.checked })} disabled={saving === r.flag} />
              </td>
              <td className="py-2 pr-4">
                <input type="checkbox" checked={r.allowTenantOverride ?? false} onChange={(e) => upsert(r.flag, { allowTenantOverride: e.target.checked })} disabled={saving === r.flag} />
              </td>
              <td className="py-2 pr-4">
                <input className="border px-2 py-1 rounded w-64" placeholder="Feature description..." defaultValue={r.description || ''} onBlur={(e) => upsert(r.flag, { description: e.target.value })} disabled={saving === r.flag} />
              </td>
              <td className="py-2 pr-4">
                <input className="border px-2 py-1 rounded w-64" placeholder="Rollout strategy..." defaultValue={r.rollout || ''} onBlur={(e) => upsert(r.flag, { rollout: e.target.value })} disabled={saving === r.flag} />
              </td>
              <td className="py-2 pr-4">
                {effective[r.flag] ? (
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${effective[r.flag].effectiveOn ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-700'}`}>
                      {effective[r.flag].effectiveOn ? 'On' : 'Off'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                      {effective[r.flag].effectiveSource}
                    </span>
                  </div>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 text-xs rounded bg-red-600 text-white" disabled={saving === r.flag} onClick={() => setOverride(r.flag, false)}>Kill</button>
                  <button className="px-2 py-1 text-xs rounded bg-green-600 text-white" disabled={saving === r.flag} onClick={() => setOverride(r.flag, true)}>Force On</button>
                  <button className="px-2 py-1 text-xs rounded bg-neutral-200" disabled={saving === r.flag} onClick={() => setOverride(r.flag, null)}>Clear</button>
                  <button className="px-2 py-1 text-xs rounded bg-red-800 text-white hover:bg-red-900" disabled={saving === r.flag} onClick={() => deleteFlag(r.flag)} title="Delete flag permanently">🗑️ Delete</button>
                </div>
              </td>
            </tr>
          );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="py-4 text-gray-500">No flags yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
