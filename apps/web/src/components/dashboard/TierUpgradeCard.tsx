'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import directoryPresenceUpgradeService, {
  type UpgradeTierOption,
} from '@/services/DirectoryPresenceUpgradeService';
import { FALLBACK_PRESENCE_MODES, MODE_UNLOCK_COPY, sortPresenceModes } from '@/lib/presence-modes';

interface TierUpgradeCardProps {
  tenantId: string;
  /** True when the tenant is on the free directory_presence tier */
  isDirectoryPresence: boolean;
}

/**
 * Shown on the dashboard for directory_presence tenants to surface the
 * upgrade path. Hidden for all other tiers.
 *
 * Copy aligned with the claim success screen (claim handoff spec follow-up):
 * the same Entry Presence mode triad from the shared presence-modes copy —
 * live display names + prices from the upgrade options endpoint when an
 * Auth0 session resolves them, the shared static fallback otherwise.
 */
export default function TierUpgradeCard({ tenantId, isDirectoryPresence }: TierUpgradeCardProps) {
  const [options, setOptions] = useState<UpgradeTierOption[] | null>(null);

  useEffect(() => {
    if (!isDirectoryPresence) return;
    let cancelled = false;
    directoryPresenceUpgradeService.getUpgradeOptions(tenantId).then((opts) => {
      if (!cancelled && Array.isArray(opts?.upgradeOptions) && opts.upgradeOptions.length > 0) {
        setOptions(opts.upgradeOptions);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, isDirectoryPresence]);

  if (!isDirectoryPresence) return null;

  const isLive = Array.isArray(options) && options.length > 0;
  const modes = sortPresenceModes(isLive ? options : FALLBACK_PRESENCE_MODES);

  return (
    <Link
      href={`/t/${tenantId}/settings/subscription/upgrade`}
      className="block bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white hover:from-blue-700 hover:to-indigo-700 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold">Choose your Presence Mode</h3>
          <p className="text-sm text-blue-100 mt-1">
            Your directory listing is live and free forever — upgrade when you&apos;re ready
            to unlock more.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {modes.map((mode) => (
              <div key={mode.tierKey} className="rounded-lg bg-white/10 p-3">
                <div className="text-sm font-semibold flex items-center gap-1.5 flex-wrap">
                  {mode.displayName || mode.name}
                  {mode.isPrimary && (
                    <span className="text-[10px] uppercase tracking-wide bg-white/20 rounded px-1.5 py-0.5">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="text-xs text-blue-100 font-medium mt-0.5">
                  {isLive ? `$${mode.priceMonthly}/mo` : `from $${mode.priceMonthly}/mo`}
                </div>
                <p className="text-xs text-blue-100/90 mt-1">
                  {MODE_UNLOCK_COPY[mode.tierKey] ?? mode.tagline ?? ''}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium">
            Compare modes <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}
