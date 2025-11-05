"use client";

import { useEffect, useState } from "react";
import { computeStoreStatus } from "@/lib/hours-utils";

interface HoursPreviewProps {
  apiBase: string;
  tenantId: string;
}

export default function HoursPreview({ apiBase, tenantId }: HoursPreviewProps) {
  const [status, setStatus] = useState<{ isOpen: boolean; label: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndCompute = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiBase}/public/tenant/${tenantId}/profile`, { cache: 'no-store' });
        if (!res.ok) {
          setStatus(null);
          return;
        }
        const data = await res.json();
        const hours = data?.hours;
        
        if (hours) {
          const computed = computeStoreStatus(hours);
          setStatus(computed);
        } else {
          setStatus(null);
        }
      } catch (error) {
        console.error('Failed to fetch hours:', error);
        setStatus(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAndCompute();
    
    // Refresh every 30 seconds to keep preview accurate
    const interval = setInterval(fetchAndCompute, 30000);
    return () => clearInterval(interval);
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
  const dotColor = isOpen ? 'bg-green-500' : 'bg-red-500';
  const statusText = isOpen ? 'Open' : 'Closed';
  const statusColor = isOpen ? 'text-green-700' : 'text-red-700';
  const bgGradient = isOpen 
    ? 'from-green-50 to-emerald-50 border-green-200' 
    : 'from-red-50 to-rose-50 border-red-200';

  return (
    <div className={`bg-gradient-to-br ${bgGradient} border-2 rounded-xl p-6 sticky top-6`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 ${isOpen ? 'bg-green-500' : 'bg-red-500'} rounded-full flex items-center justify-center`}>
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

      {/* Info Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          <strong>💡 Tip:</strong> This is exactly how your hours will appear to customers on your storefront and in your dashboard.
        </p>
      </div>
    </div>
  );
}
