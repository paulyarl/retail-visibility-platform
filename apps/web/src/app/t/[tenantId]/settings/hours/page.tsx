import React from "react";
import { cookies } from "next/headers";
import HoursEditor from "@/components/hours/HoursEditor";
import SpecialHoursCalendar from "@/components/hours/SpecialHoursCalendar";
import SyncStateBadge from "@/components/hours/SyncStateBadge";
import TimezonePicker from "@/components/hours/TimezonePicker";
import HoursPreview from "@/components/hours/HoursPreview";

export default async function HoursSettingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  
  // Check if business hours feature is enabled via feature flag system
  // Use effective-flags endpoint to check platform + tenant inheritance
  const serverApiBase = process.env.API_BASE_URL || "http://localhost:4000";
  const clientApiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
  let isEnabled = false;
  
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('ACCESS_TOKEN')?.value || cookieStore.get('access_token')?.value;
    
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(`${serverApiBase}/api/admin/effective-flags/${tenantId}`, {
      cache: 'no-store',
      headers
    });
    if (res.ok) {
      const data = await res.json();
      // Check if FF_TENANT_GBP_HOURS_SYNC is effectively enabled (platform or tenant)
      const hoursFlag = data.data?.find((f: any) => f.flag === 'FF_TENANT_GBP_HOURS_SYNC');
      isEnabled = hoursFlag?.tenantEffectiveOn === true;
    }
  } catch (e) {
    console.error('Failed to check hours flag:', e);
  }
  
  if (!isEnabled) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Business Hours is not enabled for this tenant. Enable the <strong>FF_TENANT_GBP_HOURS_SYNC</strong> flag in Admin → Tenant Flags.
      </div>
    );
  }

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
            <SyncStateBadge apiBase={clientApiBase} tenantId={tenantId} />
          </div>
        </div>
      </div>

      {/* Timezone */}
      <TimezonePicker tenantId={tenantId} apiBase={clientApiBase} />

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

      {/* Two Column Layout: Editor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Editors (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Regular Hours Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-xl font-bold text-gray-900">Business Hours</h2>
              <p className="text-sm text-gray-600 mt-1">Set your weekly operating schedule</p>
            </div>
            <div className="p-6">
              <HoursEditor apiBase={clientApiBase} tenantId={tenantId} />
            </div>
          </div>

          {/* Special / Holiday Hours Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-xl font-bold text-gray-900">Special Hours</h2>
              <p className="text-sm text-gray-600 mt-1">Manage holiday and exception hours</p>
            </div>
            <div className="p-6">
              <SpecialHoursCalendar apiBase={clientApiBase} tenantId={tenantId} />
            </div>
          </div>
        </div>

        {/* Right Column: Live Preview (1/3 width, sticky) */}
        <div className="lg:col-span-1">
          <HoursPreview apiBase={clientApiBase} tenantId={tenantId} />
        </div>
      </div>
    </div>
  );
}
