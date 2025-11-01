"use client";
import React, { useEffect, useState } from "react";

export default function SyncStateBadge({ apiBase, tenantId }: { apiBase: string; tenantId: string }) {
  const [status, setStatus] = useState<{ in_sync: boolean; last_synced_at?: string; attempts?: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await fetch(`${apiBase}/api/tenant/${tenantId}/gbp/hours/status`, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      setStatus(j?.data || null);
    }
  };

  useEffect(() => { load(); }, []);

  const mirrorNow = async () => {
    setBusy(true);
    const prevLast = status?.last_synced_at;
    const prevAttempts = status?.attempts || 0;
    await fetch(`${apiBase}/api/tenant/${tenantId}/gbp/hours/mirror`, { method: "POST" });

    // Poll for a short window to reflect runner update
    const start = Date.now();
    const poll = async (): Promise<void> => {
      await load();
      const changed = (status?.last_synced_at && status.last_synced_at !== prevLast) || ((status?.attempts || 0) > prevAttempts);
      if (changed) {
        setBusy(false);
        return;
      }
      if (Date.now() - start > 6000) { // stop after 6s
        setBusy(false);
        return;
      }
      setTimeout(poll, 800);
    };
    setTimeout(poll, 800);
  };

  const cls = status?.in_sync ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800";
  const label = status?.in_sync ? "In Sync" : "Out of Sync";

  return (
    <div className="flex items-center gap-3">
      <span className={`px-2 py-1 rounded text-sm ${cls}`}>{label}</span>
      <button disabled={busy} onClick={mirrorNow} className="text-blue-600 underline disabled:text-gray-400">
        {busy ? "Mirroring..." : "Mirror Now"}
      </button>
      {status?.last_synced_at && <span className="text-xs text-gray-500">Last: {new Date(status.last_synced_at).toLocaleString()}</span>}
    </div>
  );
}
