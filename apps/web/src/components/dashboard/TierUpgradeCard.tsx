'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import directoryPresenceUpgradeService, {
  type UpgradeTierOption,
} from '@/services/DirectoryPresenceUpgradeService';
import { CONNECT_GATE_COPY, FALLBACK_PRESENCE_MODES, MODE_UNLOCK_COPY, PRESENCE_SOLUTIONS, sortPresenceModes } from '@/lib/presence-modes';

interface TierUpgradeCardProps {
  tenantId: string;
  /** True when the tenant is on the free directory_presence tier */
  isDirectoryPresence: boolean;
  /** True when the tenant has at least one inventory item (State B). Unknown → State A copy. */
  hasInventory?: boolean;
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
export default function TierUpgradeCard({ tenantId, isDirectoryPresence, hasInventory }: TierUpgradeCardProps) {
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
  // CONNECT_LADDER_COPY_SPEC §5 — connection is a state, not a tier. When the
  // connection state is unknown, State A is the safe default: "connect" is
  // never wrong advice for a tenant with no catalog.
  const connected = hasInventory === true;
  const copy = connected ? CONNECT_GATE_COPY.stateB : CONNECT_GATE_COPY.stateA;
  const href = connected
    ? `/t/${tenantId}/settings/subscription/upgrade`
    : `/t/${tenantId}/items/create`;

  return (
    <Link
      href={href}
      className="block bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white hover:from-blue-700 hover:to-indigo-700 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold">{copy.heading}</h3>
          <p className="text-sm text-blue-100 mt-1">{copy.body}</p>
          {connected ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {modes.map((mode) => (
                <div key={mode.tierKey} className="rounded-lg bg-white/10 p-3">
                  <div className="text-sm font-semibold flex items-center gap-1.5 flex-wrap">
                    {mode.tagline || mode.displayName || mode.name}
                    {mode.isPrimary && (
                      <span className="text-[10px] uppercase tracking-wide bg-white/20 rounded px-1.5 py-0.5">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-blue-100 font-medium mt-0.5">
                    {mode.displayName || mode.name} ·{' '}
                    {isLive ? `$${mode.priceMonthly}/mo` : `from $${mode.priceMonthly}/mo`}
                  </div>
                  <p className="text-xs text-blue-100/90 mt-1">
                    {MODE_UNLOCK_COPY[mode.tierKey] ?? ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-blue-100/90">
              Three surfaces to grow into once your inventory is connected — products on
              Google, a full catalog, and checkout.
            </p>
          )}
          <p className="mt-3 text-xs text-blue-100">
            Runs on the register you already have —{' '}
            {PRESENCE_SOLUTIONS.map((s) => s.label).join(' and ')} sync your real catalog
            as add-ons.
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium">
            {connected ? copy.secondary : copy.cta} <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}
