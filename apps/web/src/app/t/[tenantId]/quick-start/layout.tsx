/**
 * Quick Start Layout with Capability Gating
 * 
 * Wraps the Quick Start page with capability-based access control.
 * Requires quickstart_options capability with canUseWizard or canUseAIWizard.
 * 
 * Three states:
 * 1. Has access → render children
 * 2. Tier includes quickstart but merchant disabled it → "Disabled" with settings link
 * 3. Tier does not include quickstart → "Unavailable" with dynamic tier list from API
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuickstartOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { tenantInfoService } from '@/services/TenantInfoService';
import { Rocket, Lock, Settings, ToggleLeft } from 'lucide-react';

interface TierWithCapability {
  tier_key: string;
  tier_name: string;
  tier_description: string;
}

export default function QuickStartLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const { data: quickstartState, loading } = useQuickstartOptionsCapability(tenantId);
  const [tiersWithQuickstart, setTiersWithQuickstart] = useState<TierWithCapability[] | null>(null);

  const router = useRouter();

  // Fetch tiers that include quickstart (for upgrade messaging)
  useEffect(() => {
    if (quickstartState && !quickstartState.enabled) {
      tenantInfoService.getTiersWithCapability('quickstart_options').then(setTiersWithQuickstart);
    }
  }, [quickstartState?.enabled]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Check if user has access to any quickstart wizard (static or AI)
  const hasAccess = quickstartState?.enabled && (quickstartState.canUseWizard || quickstartState.canUseAIWizard);

  // Distinguish why access is denied
  const tierHasQuickstart = quickstartState?.enabled ?? false;
  const masterSwitchOff = tierHasQuickstart && !quickstartState?.merchantPreferences.quickstart_enabled;

  if (!hasAccess) {
    // Merchant disabled the master switch — tier allows it but it's turned off
    if (masterSwitchOff) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-amber-200 dark:border-amber-800 max-w-md text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                <ToggleLeft className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Quick Start Disabled</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Your plan includes Quick Start, but it is currently turned off. Enable it in your Quickstart Settings to start using the wizard.
            </p>
            <button
              onClick={() => router.push(`/t/${tenantId}/settings/quickstart-options`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors mb-4"
            >
              <Settings className="w-4 h-4" />
              Go to Quickstart Settings
            </button>
          </div>
        </div>
      );
    }

    // Tier does not include quickstart — show dynamic tier list
    const tierNames = tiersWithQuickstart?.map(t => t.tier_name) || [];
    const tierListText = tierNames.length > 0
      ? tierNames.length === 1
        ? `the ${tierNames[0]} plan`
        : tierNames.length === 2
          ? `the ${tierNames[0]} or ${tierNames[1]} plans`
          : `the ${tierNames.slice(0, -1).join(', ')}, or ${tierNames[tierNames.length - 1]} plans`
      : 'a higher plan';

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700 max-w-md text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Quick Start Unavailable</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Your current plan does not include the Quick Start wizard. Upgrade to {tierListText} to access this feature.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Rocket className="w-4 h-4" />
            <span>Available on {tierListText}</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
