"use client";
import React, { useEffect, useRef, useState } from "react";

type FlagRow = { 
  id: string; 
  flag: string; 
  enabled: boolean; 
  rollout?: string | null;
  _isPlatformInherited?: boolean;
};

type EffectiveRow = {
  flag: string;
  tenantId: string;
  effectiveOn: boolean; // platform effective
  effectiveSource: 'env' | 'override' | 'platform_db' | 'off';
  sources: { platform_env: boolean; platform_db: boolean; allow_override: boolean; platform_override?: boolean };
  tenantEffectiveOn: boolean;
  tenantEffectiveSource: 'tenant_override' | 'tenant_db' | 'blocked';
  tenantSources: { tenant_db: boolean; tenant_override?: boolean };
};

export default function AdminTenantFlags({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [effective, setEffective] = useState<Record<string, EffectiveRow>>({});
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/tenant-flags/${tenantId}`, { cache: "no-store", credentials: 'include' });
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await r.json();
        if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
        setRows(j.data || []);
      } else {
        const text = await r.text();
        if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
        throw new Error(`Unexpected response: ${text?.slice(0, 200)}`);
      }

      // Load effective statuses
      const e = await fetch(`/api/admin/effective-flags/${encodeURIComponent(tenantId)}`, { cache: 'no-store', credentials: 'include' });
      const ect = e.headers.get('content-type') || '';
      if (ect.includes('application/json')) {
        const ej = await e.json();
        if (!e.ok || !ej?.success) throw new Error(ej?.error || `HTTP ${e.status}`);
        const map: Record<string, EffectiveRow> = {};
        for (const it of (ej.data || [])) map[it.flag] = it;
        setEffective(map);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const upsert = async (flag: string, next: Partial<FlagRow>) => {
    setSaving(flag);
    setError(null);
    try {
      const r = await fetch(`/api/admin/tenant-flags/${tenantId}/${encodeURIComponent(flag)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next.enabled, rollout: next.rollout ?? null }),
        credentials: 'include',
      });
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await r.json();
        if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
      } else {
        const text = await r.text();
        if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
        throw new Error(`Unexpected response: ${text?.slice(0, 200)}`);
      }
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(null);
    }
  };

  const addFlag = async () => {
    const flag = prompt("Enter flag key (must start with TENANT_ for custom flags, e.g., TENANT_CUSTOM_FEATURE)")?.trim();
    if (!flag) return;
    
    // Validate flag naming
    if (!flag.startsWith('TENANT_') && !flag.startsWith('FF_')) {
      setError('Custom flags must start with TENANT_ prefix (e.g., TENANT_MY_FEATURE)');
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    // Warn about custom flags
    if (flag.startsWith('TENANT_')) {
      const confirmed = confirm(
        '⚠️ Custom Flag Warning\n\n' +
        'This custom flag will NOT affect any functionality until:\n' +
        '1. A developer adds code to check this flag\n' +
        '2. The code is deployed to production\n\n' +
        'Custom flags are an advanced feature for tenant-specific customizations.\n\n' +
        'Continue creating this flag?'
      );
      if (!confirmed) return;
    }
    
    await upsert(flag, { enabled: true });
  };

  const setTenantOverride = async (flag: string, value: boolean | null) => {
    try {
      setSaving(flag);
      const r = await fetch(`/api/admin/flags/override/tenant/${encodeURIComponent(tenantId)}/${encodeURIComponent(flag)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
        credentials: 'include',
      });
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await r.json();
        if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
      } else {
        const text = await r.text();
        if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
        throw new Error(`Unexpected response: ${text?.slice(0, 200)}`);
      }
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(null);
    }
  };

  const ranForTenant = useRef(new Set<string>());
  useEffect(() => {
    if (!tenantId) return;
    if (ranForTenant.current.has(tenantId)) return;
    ranForTenant.current.add(tenantId);
    load();
  }, [tenantId]);

  if (loading) return <div className="text-sm text-gray-500">Loading flags…</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tenant Feature Flags</h2>
        <button className="bg-black text-white px-3 py-1 rounded" onClick={addFlag}>Add Custom Flag</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-2">Flag</th>
            <th className="py-2">Enabled</th>
            <th className="py-2">Rollout</th>
            <th className="py-2">Live Status</th>
            <th className="py-2">Override</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2 pr-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{r.flag}</span>
                    {r._isPlatformInherited && (
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Platform Override Allowed</span>
                    )}
                    {r.flag.startsWith('TENANT_') && (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">Tenant-Only Flag</span>
                    )}
                  </div>
                  {r._isPlatformInherited && (
                    <span className="text-xs text-neutral-500">Can override platform setting</span>
                  )}
                  {r.flag.startsWith('TENANT_') && (
                    <span className="text-xs text-neutral-500">Custom flag for this tenant only</span>
                  )}
                </div>
              </td>
              <td className="py-2 pr-4">
                <input type="checkbox" checked={r.enabled} onChange={(e) => upsert(r.flag, { enabled: e.target.checked })} disabled={saving === r.flag} />
              </td>
              <td className="py-2 pr-4">
                <input className="border px-2 py-1 rounded w-64" defaultValue={r.rollout || ''} onBlur={(e) => upsert(r.flag, { rollout: e.target.value })} disabled={saving === r.flag} />
              </td>
              <td className="py-2 pr-4">
                {effective[r.flag] ? (
                  <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1" title={`Live: ${effective[r.flag].tenantEffectiveOn ? 'On' : 'Off'}`}>
                        <svg className="w-3 h-3" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="4" cy="4" r="4" fill={effective[r.flag].tenantEffectiveOn ? '#16a34a' : '#9ca3af'} />
                        </svg>
                        <span>Live: {effective[r.flag].tenantEffectiveOn ? 'On' : 'Off'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12" y2="8" />
                        </svg>
                        <span>{effective[r.flag].tenantEffectiveSource}</span>
                      </span>
                      {r.enabled !== effective[r.flag].tenantEffectiveOn && (
                        <span className="inline-flex items-center gap-1 text-amber-700" title="Database setting differs from effective value">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                          <span>Conflict</span>
                        </span>
                      )}
                      <span className="relative inline-flex">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-neutral-100 text-neutral-600"
                          aria-label="View source details"
                          aria-expanded={openInfo === r.flag}
                          onClick={() => setOpenInfo(openInfo === r.flag ? null : r.flag)}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12" y2="8" />
                          </svg>
                        </button>
                        {(effective[r.flag].sources.platform_override !== undefined || effective[r.flag].tenantSources.tenant_override !== undefined) && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full"></span>
                        )}
                        {openInfo === r.flag && (
                          <div className="absolute z-50 right-0 top-6 w-64 bg-white border border-neutral-200 rounded shadow-lg p-2 space-y-1">
                            <div className="text-[10px] uppercase text-neutral-500">Sources</div>
                            <div className="flex justify-between text-xs"><span>platform_env</span><span className={effective[r.flag].sources.platform_env ? 'text-green-700' : 'text-neutral-600'}>{effective[r.flag].sources.platform_env ? 'on' : 'off'}</span></div>
                            <div className="flex justify-between text-xs"><span>platform_db</span><span className={effective[r.flag].sources.platform_db ? 'text-green-700' : 'text-neutral-600'}>{effective[r.flag].sources.platform_db ? 'on' : 'off'}</span></div>
                            <div className="flex justify-between text-xs"><span>allow_override</span><span className={effective[r.flag].sources.allow_override ? 'text-blue-700' : 'text-neutral-600'}>{effective[r.flag].sources.allow_override ? 'yes' : 'no'}</span></div>
                            {effective[r.flag].sources.platform_override !== undefined && (
                              <div className="flex justify-between text-xs"><span>platform_override</span><span className="text-purple-700">{String(effective[r.flag].sources.platform_override)}</span></div>
                            )}
                            <div className="flex justify-between text-xs"><span>tenant_db</span><span className={effective[r.flag].tenantSources.tenant_db ? 'text-green-700' : 'text-neutral-600'}>{effective[r.flag].tenantSources.tenant_db ? 'on' : 'off'}</span></div>
                            {effective[r.flag].tenantSources.tenant_override !== undefined && (
                              <div className="flex justify-between text-xs"><span>tenant_override</span><span className="text-purple-700">{String(effective[r.flag].tenantSources.tenant_override)}</span></div>
                            )}
                          </div>
                        )}
                      </span>
                  </div>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 text-xs rounded bg-red-600 text-white" disabled={saving === r.flag} onClick={() => setTenantOverride(r.flag, false)}>Kill</button>
                  <button className="px-2 py-1 text-xs rounded bg-green-600 text-white" disabled={saving === r.flag} onClick={() => setTenantOverride(r.flag, true)}>Force On</button>
                  <button className="px-2 py-1 text-xs rounded bg-neutral-200" disabled={saving === r.flag} onClick={() => setTenantOverride(r.flag, null)}>Clear</button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="py-4 text-gray-500">No flags yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
