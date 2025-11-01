import React from "react";
import HoursEditor from "@/components/hours/HoursEditor";
import SpecialHoursCalendar from "@/components/hours/SpecialHoursCalendar";
import SyncStateBadge from "@/components/hours/SyncStateBadge";

export default async function HoursSettingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const uiFlag = (process.env.NEXT_PUBLIC_ENABLE_HOURS_UI === 'true') || (process.env as any).NEXT_PUBLIC_ENABLE_HOURS_UI_ === 'true';
  const allowList = (process.env.NEXT_PUBLIC_HOURS_TENANTS || '').split(',').map(s => s.trim()).filter(Boolean);
  const isTenantEnabled = allowList.includes(tenantId);
  if (!uiFlag || !isTenantEnabled) {
    return (
      <div className="p-6 text-sm text-gray-500">Business Hours is not enabled for this tenant.</div>
    );
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Business Hours</h1>
        <SyncStateBadge apiBase={apiBase} tenantId={tenantId} />
      </div>
      <div className="space-y-6">
        <section>
          <h2 className="font-medium mb-2">Regular Hours</h2>
          <HoursEditor apiBase={apiBase} tenantId={tenantId} />
        </section>
        <section>
          <h2 className="font-medium mb-2">Special / Holiday Hours</h2>
          <SpecialHoursCalendar apiBase={apiBase} tenantId={tenantId} />
        </section>
      </div>
    </div>
  );
}
