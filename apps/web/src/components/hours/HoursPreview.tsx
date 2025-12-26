"use client";

import { useEffect, useState } from "react";
import { getTodaySpecialHours } from "@/lib/hours-utils";
import { useStoreStatus } from "@/hooks/useStoreStatus";

interface HoursPreviewProps {
  apiBase: string;
  tenantId: string;
}

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function HoursPreview({ apiBase, tenantId }: HoursPreviewProps) {
  const { status, loading } = useStoreStatus(tenantId, apiBase);
  const [specialHours, setSpecialHours] = useState<any[]>([]);

  // Fetch special hours separately since the hook only handles status
  useEffect(() => {
    const fetchSpecialHours = async () => {
      try {
        const response = await fetch(`${apiBase}/api/tenant/${tenantId}/business-hours/special`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.overrides) {
            // Create a mock hours object for getTodaySpecialHours
            const mockHours = {
              special: data.data.overrides.map((override: any) => ({
                date: override.date,
                open: override.open,
                close: override.close,
                isClosed: override.isClosed,
                note: override.note
              }))
            };
            const todaySpecial = getTodaySpecialHours(mockHours);
            setSpecialHours(todaySpecial);
          }
        }
      } catch (error) {
        console.error('Failed to fetch special hours:', error);
      }
    };

    fetchSpecialHours();
  }, [apiBase, tenantId]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-purple-900">Live Preview</h3>
            <p className="text-sm text-purple-700">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Live Preview</h3>
            <p className="text-sm text-gray-600">No hours configured yet</p>
          </div>
        </div>
        <p className="text-sm text-gray-500">Set your business hours above to see how they'll appear to customers.</p>
      </div>
    );
  }

  const isOpen = status.isOpen;
  const statusType = status.status; // 'open' | 'closed' | 'opening-soon' | 'closing-soon'
  
  // Determine colors based on status type
  let dotColor = 'bg-gray-500';
  let statusText = 'Unknown';
  let statusColor = 'text-gray-700';
  let bgGradient = 'from-gray-50 to-gray-100 border-gray-200';
  
  if (statusType === 'open') {
    dotColor = 'bg-green-500';
    statusText = 'Open';
    statusColor = 'text-green-700';
    bgGradient = 'from-green-50 to-emerald-50 border-green-200';
  } else if (statusType === 'closed') {
    dotColor = 'bg-red-500';
    statusText = 'Closed';
    statusColor = 'text-red-700';
    bgGradient = 'from-red-50 to-rose-50 border-red-200';
  } else if (statusType === 'opening-soon') {
    dotColor = 'bg-yellow-500';
    statusText = 'Opening Soon';
    statusColor = 'text-yellow-700';
    bgGradient = 'from-yellow-50 to-amber-50 border-yellow-200';
  } else if (statusType === 'closing-soon') {
    dotColor = 'bg-orange-500';
    statusText = 'Closing Soon';
    statusColor = 'text-orange-700';
    bgGradient = 'from-orange-50 to-amber-50 border-orange-200';
  }

  return (
    <div className={`bg-gradient-to-br ${bgGradient} border-2 rounded-xl p-6 sticky top-6`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 ${dotColor} rounded-full flex items-center justify-center`}>
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Live Preview</h3>
          <p className="text-xs text-gray-600">Updates every 30 seconds</p>
        </div>
      </div>

      {/* Storefront Preview */}
      <div className="bg-white rounded-lg p-4 mb-3 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Storefront</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`}></span>
          <span className={`font-bold ${statusColor}`}>{statusText}</span>
          <span className="text-gray-400">•</span>
          <span className="text-sm text-gray-900">{status.label}</span>
        </div>
      </div>

      {/* Dashboard Preview */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`}></span>
          <span className={`font-bold ${statusColor}`}>{statusText}</span>
          <span className="text-gray-400">•</span>
          <span className="text-sm text-gray-900">{status.label}</span>
        </div>
      </div>

      {/* Special Hours - Today & Upcoming */}
      {specialHours.length > 0 && (() => {
        const todayHours = specialHours.filter(sh => sh.label === 'today');
        const upcomingHours = specialHours.filter(sh => sh.label === 'upcoming');
        
        const formatTime = (time24: string): string => {
          if (!time24) return "";
          const [h, m] = time24.split(":").map(Number);
          const period = h >= 12 ? "PM" : "AM";
          const hour12 = h % 12 || 12;
          return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
        };
        
        const formatDate = (dateStr: string): string => {
          const date = new Date(dateStr + 'T00:00:00');
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };
        
        return (
          <div className="mt-4 pt-4 border-t border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Special Hours</span>
            </div>
            <div className="space-y-2">
              {/* Today's Special Hours */}
              {todayHours.map((sh, idx) => (
                <div key={`today-${idx}`} className="bg-amber-50 rounded p-2 border border-amber-200">
                  <div className="flex justify-between items-start text-sm">
                    <span className="font-medium text-amber-900">Today</span>
                    <span className="text-amber-800">
                      {sh.isClosed ? 'Closed' : `${formatTime(sh.open!)} - ${formatTime(sh.close!)}`}
                    </span>
                  </div>
                  {sh.note && (
                    <p className="text-xs text-amber-700 italic mt-1">{sh.note}</p>
                  )}
                </div>
              ))}
              
              {/* Upcoming Special Hours */}
              {upcomingHours.map((sh, idx) => (
                <div key={`upcoming-${idx}`} className="bg-blue-50 rounded p-2 border border-blue-200">
                  <div className="flex justify-between items-start text-sm">
                    <span className="font-medium text-blue-900">
                      {formatDate(sh.date)} {sh.daysAway && `(in ${sh.daysAway} day${sh.daysAway > 1 ? 's' : ''})`}
                    </span>
                    <span className="text-blue-800">
                      {sh.isClosed ? 'Closed' : `${formatTime(sh.open!)} - ${formatTime(sh.close!)}`}
                    </span>
                  </div>
                  {sh.note && (
                    <p className="text-xs text-blue-700 italic mt-1">{sh.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Info Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          <strong>💡 Tip:</strong> This is exactly how your hours will appear to customers on your storefront and in your dashboard.
        </p>
      </div>
    </div>
  );
}
