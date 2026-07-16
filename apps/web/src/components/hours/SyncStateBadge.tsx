"use client";
import React, { useEffect, useState, useRef } from "react";
import { tenantManagementService } from "@/services/TenantManagementService";
import { clientLogger } from '@/lib/client-logger';



export default function SyncStateBadge({ tenantId }: { tenantId: string }) {
  const [status, setStatus] = useState<{ in_sync: boolean; last_synced_at?: string; attempts?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);

  const load = async () => {
    try {
      const data = await tenantManagementService.getGBPHoursStatus(tenantId);
      if (mountedRef.current) {
        setStatus(data || null);
      }
    } catch (error) {
      clientLogger.error('Failed to load GBP hours status:', { detail: error });
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [tenantId]);

  const mirrorNow = async () => {
    setBusy(true);
    const prevLast = status?.last_synced_at;
    const prevAttempts = status?.attempts || 0;
    try {
      await tenantManagementService.triggerGBPHoursMirror(tenantId);
    } catch (error) {
      clientLogger.error('Failed to trigger GBP hours mirroring:', { detail: error });
    }

    // Poll for a short window to reflect runner update
    const start = Date.now();
    const poll = async (): Promise<void> => {
      if (!mountedRef.current) return; // Stop if unmounted
      
      await load();
      
      if (!mountedRef.current) return; // Check again after async
      
      const currentStatus = status;
      const changed = (currentStatus?.last_synced_at && currentStatus.last_synced_at !== prevLast) || ((currentStatus?.attempts || 0) > prevAttempts);
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
