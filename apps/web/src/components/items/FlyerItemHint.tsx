'use client';

/**
 * FlyerItemHint — contextual guidance bridging the standard item-creation
 * workflow (/t/:tid/items, /t/:tid/items/create) to the specials flyer.
 *
 * Shows only when the flyer capability is enabled — the platform offers the
 * tool; discovery + adoption stays with the merchant. Dismiss is persisted
 * per-tenant in localStorage.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { useFlyerCapability } from '@/hooks/tenant-access/useCapabilityAccess';

const dismissKey = (tenantId: string) => `flyer-item-hint-dismissed-${tenantId}`;

export default function FlyerItemHint({ tenantId }: { tenantId: string }) {
  const { data: flyerCap, loading } = useFlyerCapability(tenantId);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(dismissKey(tenantId)) === '1';
  });

  if (loading || dismissed || !flyerCap?.enabled) return null;

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 flex items-start gap-2.5">
      <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="flex-1 text-xs text-amber-800 dark:text-amber-200">
        <span className="font-medium">Specials flyer:</span> items you create here
        can be linked to a time-boxed flyer (storefront, directory, share link).
        Quick specials (name + price) can also be added straight in the composer.{' '}
        <Link href={`/t/${tenantId}/settings/flyers`} className="underline hover:text-amber-900 dark:hover:text-amber-100">
          Open flyer settings
        </Link>
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
        onClick={() => {
          setDismissed(true);
          window.localStorage.setItem(dismissKey(tenantId), '1');
        }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
