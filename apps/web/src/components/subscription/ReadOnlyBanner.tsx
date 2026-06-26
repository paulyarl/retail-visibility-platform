'use client';

import { AlertTriangle, Lock, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface ReadOnlyBannerProps {
  internalStatus: string;
  tenantId: string;
  variant?: 'full' | 'compact';
}

const STATUS_MESSAGES: Record<string, string> = {
  frozen: 'Your account is frozen. Your storefront remains visible, but editing is disabled.',
  canceled: 'Your subscription has been canceled. Please reactivate to make changes.',
  expired: 'Your subscription has expired. Please renew to continue managing your products.',
  past_due: 'Your payment is past due. Some features may be limited.',
  maintenance: 'Your account is in maintenance mode. Growth is limited but editing is available.',
};

/**
 * Banner shown on product editing and storefront settings pages
 * when the tenant's subscription is in a read-only state.
 */
export function ReadOnlyBanner({ internalStatus, tenantId, variant = 'full' }: ReadOnlyBannerProps) {
  const message = STATUS_MESSAGES[internalStatus] || 'Your subscription is in a restricted state. Editing is disabled.';

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
        <Lock className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium">Read-only mode</span>
        <Link
          href={`/t/${tenantId}/settings/subscription`}
          className="ml-auto inline-flex items-center gap-1 text-amber-900 underline font-semibold hover:text-amber-700"
        >
          <RefreshCw className="h-3 w-3" />
          Renew
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4">
      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-900">Subscription {internalStatus.replace('_', ' ')}</p>
        <p className="text-sm text-red-700 mt-1">{message}</p>
        <Link
          href={`/t/${tenantId}/settings/subscription`}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Renew Subscription
        </Link>
      </div>
    </div>
  );
}
