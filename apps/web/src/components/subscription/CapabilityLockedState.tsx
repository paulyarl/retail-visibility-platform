'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';

interface CapabilityLockedStateProps {
  tenantId: string;
  featureName: string;
  className?: string;
}

export function CapabilityLockedState({ tenantId, featureName, className = '' }: CapabilityLockedStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 rounded-xl bg-gray-50 border border-gray-200 ${className}`}>
      <Lock className="w-8 h-8 text-gray-400 mb-3" />
      <p className="text-base font-medium text-gray-700 text-center mb-1">
        {featureName} is unavailable
      </p>
      <p className="text-sm text-gray-500 text-center mb-4 max-w-md">
        This feature is not available with your current subscription plan. Upgrade to regain access.
      </p>
      <Link
        href={`/t/${tenantId}/settings/subscription`}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        Upgrade plan →
      </Link>
    </div>
  );
}
