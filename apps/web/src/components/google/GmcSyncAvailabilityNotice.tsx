'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface GmcSyncAvailabilityNoticeProps {
  tenantId: string;
  reason?: string | null;
}

interface NoticeCopy {
  title: string;
  body: string;
  action?: { label: string; href: string };
}

/**
 * Explains why GMC sync actions are hidden.
 *
 * The server gate distinguishes a fixable setup gap (storefront type, product
 * types) from a genuine plan limit, so this notice never tells a merchant to
 * upgrade for something their plan already includes.
 */
export function resolveGmcSyncNoticeCopy(reason: string | null | undefined, tenantId: string): NoticeCopy {
  switch (reason) {
    case 'storefront_type_required':
    case 'storefront_disabled':
      return {
        title: 'Choose your storefront type',
        body: 'Google Merchant Center sync needs a physical storefront. Select a retail or service storefront type to enable it.',
        action: {
          label: 'Choose storefront type',
          href: `/t/${tenantId}/settings/storefront-type-options`,
        },
      };
    case 'product_types_disabled':
    case 'product_types_ineligible':
      return {
        title: 'Enable physical products',
        body: 'Google Merchant Center sync is for physical, hybrid, or service products. Enable a physical product type to use it.',
        action: { label: 'Manage product types', href: `/t/${tenantId}/settings/product-types` },
      };
    case 'no_capabilities':
    case 'error':
      return {
        title: 'Sync temporarily unavailable',
        body: 'We could not verify your Google Merchant Center entitlements. Refresh the page or try again shortly.',
      };
    default:
      return {
        title: 'Not included in your plan',
        body: 'Google Merchant Center sync is not available on your current plan.',
        action: { label: 'View upgrade options', href: `/t/${tenantId}/settings/subscription` },
      };
  }
}

export default function GmcSyncAvailabilityNotice({ tenantId, reason }: GmcSyncAvailabilityNoticeProps) {
  const copy = resolveGmcSyncNoticeCopy(reason, tenantId);

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-amber-800 dark:text-amber-200 font-medium">{copy.title}</p>
        <p className="text-amber-700 dark:text-amber-300 text-sm">{copy.body}</p>
        {copy.action && (
          <Link
            href={copy.action.href}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-800 dark:text-amber-200 hover:underline"
          >
            {copy.action.label}
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
