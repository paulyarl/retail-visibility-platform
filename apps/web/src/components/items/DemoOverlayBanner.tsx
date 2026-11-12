'use client';

/**
 * DemoOverlayBanner — persistent state indicator while the Clover demo
 * overlay is layered on the tenant's inventory.
 *
 * Unlike FlyerItemHint this is NOT dismissible: it is a state indicator,
 * not onboarding guidance. While the overlay is on, ~25 CLOVER_DEMO items
 * coexist with real inventory and a merchant who forgot the toggle needs a
 * visible way back out. Renders only when the integration reports
 * demoActive — hidden for every other tenant/state.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { cloverIntegrationService } from '@/services/CloverIntegrationSingletonService';

export default function DemoOverlayBanner({ tenantId }: { tenantId: string }) {
  const [demoActive, setDemoActive] = useState(false);
  const [demoItems, setDemoItems] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    cloverIntegrationService
      .getCloverStatus(tenantId)
      .then((status) => {
        if (cancelled || !status) return;
        setDemoActive(!!status.demoActive);
        setDemoItems(status.demoItems ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (!demoActive) return null;

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 flex items-start gap-2.5">
      <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <p className="flex-1 text-xs text-amber-800 dark:text-amber-200">
        <span className="font-semibold">Demo Overlay active</span>
        {demoItems ? ` — ${demoItems} sample products` : ' — sample products'} are
        layered on your inventory for test-driving (marked <span className="font-medium">Demo</span>).
        They never sync to Clover, Google, or your storefront.{' '}
        <Link
          href={`/t/${tenantId}/settings/integrations/clover`}
          className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100"
        >
          Disable in Clover integration
        </Link>
      </p>
    </div>
  );
}
