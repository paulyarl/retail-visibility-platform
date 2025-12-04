"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

export default function TimezonePicker({ tenantId, apiBase }: { tenantId: string; apiBase: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>("");
  const [existingHours, setExistingHours] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiBase}/public/tenant/${tenantId}/profile`, { cache: "no-store" });
        if (res.ok) {
          const prof = await res.json();
          const tz = prof?.hours?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          setTimezone(tz);
          setExistingHours(prof?.hours || {});
        } else {
          setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
          setExistingHours({});
        }
      } catch (e) {
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
        setExistingHours({});
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenantId, apiBase]);

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await apiRequest("tenant/profile", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: tenantId,
          hours: { ...(existingHours || {}), timezone },
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to save timezone");
      }
    } catch (e) {
      setError("Failed to save timezone");
    } finally {
      setSaving(false);
    }
  };

  const tzOptions: string[] = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Anchorage",
    "Pacific/Honolulu",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Asia/Tokyo",
    "Asia/Hong_Kong",
    "Asia/Singapore",
    "Australia/Sydney",
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Timezone</h2>
        {loading ? (
          <span className="text-sm text-gray-500">Loading…</span>
        ) : error ? (
          <span className="text-sm text-red-600">{error}</span>
        ) : null}
      </div>
      <div className="p-6 flex flex-col sm:flex-row gap-3 sm:items-center">
        <label className="text-sm text-gray-700">Store Timezone</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 w-full sm:max-w-xs"
        >
          {tzOptions.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="px-6 pb-4 text-xs text-gray-500">
        Used to calculate open/closed status on your storefront.
      </div>
    </div>
  );
}
