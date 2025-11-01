"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent, Badge, Alert } from "@/components/ui";

type FlagRow = { 
  id: string; 
  flag: string; 
  enabled: boolean; 
  rollout?: string | null;
  _isPlatformInherited?: boolean;
};

export default function AdminTenantFlags({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      setSuccess(`${flag} updated successfully`);
      setTimeout(() => setSuccess(null), 3000);
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

  const handleToggle = (flag: string, currentEnabled: boolean) => {
    upsert(flag, { enabled: !currentEnabled });
  };

  useEffect(() => { load(); }, [tenantId]);

  if (loading) return <div className="text-sm text-neutral-500">Loading flags…</div>;
  if (error) return <Alert variant="error">{error}</Alert>;

  return (
    <div className="space-y-4">
      {/* Educational Alert */}
      <Alert variant="info" title="About Feature Flags">
        <div className="text-sm space-y-2">
          <p>
            This page shows feature flags that control functionality for this tenant:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Platform Flags:</strong> Flags with "Platform Override Allowed" badge can be toggled here even if disabled platform-wide</li>
            <li><strong>Custom Flags:</strong> Advanced feature for tenant-specific customizations (requires developer implementation)</li>
          </ul>
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
            <p className="font-medium text-blue-900 mb-1">⚠️ Advanced Feature</p>
            <p className="text-blue-800">
              Creating custom flags (TENANT_*) is an advanced feature that may not apply to common platform usage. 
              Custom flags require code deployment to function and are typically used for specialized tenant requirements.
            </p>
          </div>
        </div>
      </Alert>

      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Tenant Feature Flags</h2>
        <button className="bg-black text-white px-4 py-2 rounded hover:bg-neutral-800" onClick={addFlag}>
          Add Custom Flag
        </button>
      </div>

      {rows.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-neutral-500">
            No flags yet.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-neutral-900">
                      {r.flag}
                    </h3>
                    <Badge variant={r.enabled ? "success" : "default"}>
                      {r.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    {r._isPlatformInherited && (
                      <Badge variant="info">
                        Platform Override Allowed
                      </Badge>
                    )}
                    {r.flag.startsWith('TENANT_') && (
                      <Badge variant="warning">
                        Custom Flag
                      </Badge>
                    )}
                  </div>
                  {r.rollout && (
                    <p className="text-sm text-neutral-600 mb-3">
                      Rollout: {r.rollout}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Rollout notes (optional)"
                      defaultValue={r.rollout || ''}
                      onBlur={(e) => upsert(r.flag, { rollout: e.target.value })}
                      disabled={saving === r.flag}
                      className="px-3 py-1 text-sm border border-neutral-300 rounded w-64"
                    />
                    {saving === r.flag && <span className="text-sm text-neutral-500">Saving…</span>}
                  </div>
                </div>

                {/* Toggle Switch */}
                <div className="flex items-center gap-4 ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => handleToggle(r.flag, r.enabled)}
                      disabled={saving === r.flag}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
