import React from "react";
import HoursEditor from "@/components/hours/HoursEditor";
import SpecialHoursCalendar from "@/components/hours/SpecialHoursCalendar";
import SyncStateBadge from "@/components/hours/SyncStateBadge";
import TimezonePicker from "@/components/hours/TimezonePicker";

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
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Business Hours</h1>
            <p className="text-gray-600">Set your regular operating hours and manage special or holiday schedules.</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/t/${tenantId}/onboarding`}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
              title="Edit Business Profile"
            >
              Business Profile
            </a>
            <SyncStateBadge apiBase={apiBase} tenantId={tenantId} />
          </div>
        </div>
      </div>

      {/* Timezone */}
      <TimezonePicker tenantId={tenantId} apiBase={apiBase} />

      {/* Helpful Reminder */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1 text-sm text-blue-800">
            Keep your hours up to date so customers see accurate information across your storefront and integrations.
          </div>
        </div>
      </div>

      {/* Regular Hours Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Regular Hours</h2>
        </div>
        <div className="p-6">
          <HoursEditor apiBase={apiBase} tenantId={tenantId} />
        </div>
      </div>

      {/* Special / Holiday Hours Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Special / Holiday Hours</h2>
        </div>
        <div className="p-6">
          <SpecialHoursCalendar apiBase={apiBase} tenantId={tenantId} />
        </div>
      </div>
    </div>
  );
}
