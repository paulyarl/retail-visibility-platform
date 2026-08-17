'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';

interface TierUpgradeCardProps {
  tenantId: string;
  /** True when the tenant is on the free directory_presence tier */
  isDirectoryPresence: boolean;
}

/**
 * Shown on the dashboard for directory_presence tenants to surface the
 * upgrade path. Hidden for all other tiers.
 */
export default function TierUpgradeCard({ tenantId, isDirectoryPresence }: TierUpgradeCardProps) {
  if (!isDirectoryPresence) return null;

  return (
    <Link
      href={`/t/${tenantId}/settings/subscription/upgrade`}
      className="block bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white hover:from-blue-700 hover:to-indigo-700 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold">Upgrade to Sell Online</h3>
          <p className="text-sm text-blue-100 mt-1">
            You&apos;re on the free Directory Presence plan. Upgrade to manage inventory, accept
            online orders, and unlock the full retail platform.
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium">
            Compare plans <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}
