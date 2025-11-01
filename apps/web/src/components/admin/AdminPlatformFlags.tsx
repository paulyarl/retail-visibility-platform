"use client";
import React, { useEffect, useState } from "react";

type FlagRow = { id: string; flag: string; enabled: boolean; rollout?: string | null };

export default function AdminPlatformFlags() {
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/platform-flags`, { cache: "no-store", credentials: 'include' });
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

  useEffect(() => { load(); }, []);

  const upsert = async (flag: string, next: Partial<FlagRow>) => {
    setSaving(flag);
    setError(null);
    try {
      const r = await fetch(`/api/admin/platform-flags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag, enabled: next.enabled, rollout: next.rollout ?? null }),
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
    const flag = prompt("Enter flag key (e.g., FF_TENANT_URLS)")?.trim();
    if (!flag) return;
    await upsert(flag, { enabled: true });
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
            <th className="py-2">Rollout</th>
            <th className="py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2 pr-4 font-mono">{r.flag}</td>
              <td className="py-2 pr-4">
                <input type="checkbox" checked={r.enabled} onChange={(e) => upsert(r.flag, { enabled: e.target.checked })} disabled={saving === r.flag} />
              </td>
              <td className="py-2 pr-4">
                <input className="border px-2 py-1 rounded w-64" defaultValue={r.rollout || ''} onBlur={(e) => upsert(r.flag, { rollout: e.target.value })} disabled={saving === r.flag} />
              </td>
              <td className="py-2 pr-4">
                {saving === r.flag ? <span className="text-gray-500">Saving…</span> : null}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={4} className="py-4 text-gray-500">No flags yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
