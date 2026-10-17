'use client';

import Link from 'next/link';
import { CheckCircle, AlertTriangle, Globe, ExternalLink } from 'lucide-react';

/**
 * The storefront-domain summary shared by the Google integration surfaces —
 * the Settings tab's Domain Configuration card and the sync-status page's
 * status chip. Both render the canonical ladder the API resolves (an active
 * custom domain wins over the platform subdomain), so the two can't drift.
 *
 * Read-only by design: the domain is chosen automatically (see
 * `resolveStorefrontCanonical`), and a merchant only needs confirmation of the
 * address rendering the storefront — not a way to change it here.
 */
export interface StorefrontDomainStatus {
  /** Absolute canonical base GMC product links use; null = path-only tenant. */
  storefrontBaseUrl?: string | null;
  storefrontKind?: 'custom' | 'subdomain' | 'path' | null;
  customDomain?: string | null;
  platformSubdomainUrl?: string | null;
}

/** True when a merchant-controlled domain is live (GMC gets a valid link). */
export function hasLiveStorefrontDomain(status: StorefrontDomainStatus | null | undefined): boolean {
  return !!status?.storefrontBaseUrl;
}

/** e.g. "Custom domain: https://mybrand.com" | "No Storefront Domain". */
export function storefrontDomainLabel(status: StorefrontDomainStatus | null | undefined): string {
  if (!status?.storefrontBaseUrl) return 'No Storefront Domain';
  const source = status.storefrontKind === 'custom' ? 'Custom domain' : 'Subdomain';
  return `${source}: ${status.storefrontBaseUrl}`;
}

export function StorefrontDomainSummary({
  status,
  variant = 'card',
  tenantId,
}: {
  status: StorefrontDomainStatus | null | undefined;
  variant?: 'card' | 'inline';
  tenantId?: string;
}) {
  const live = hasLiveStorefrontDomain(status);
  const storefrontBaseUrl = status?.storefrontBaseUrl ?? null;
  const platformSubdomainUrl = status?.platformSubdomainUrl ?? null;
  const customDomain = status?.customDomain ?? null;
  const liveSource =
    status?.storefrontKind === 'custom' ? 'your custom domain' : 'your platform subdomain';

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2">
        {live ? (
          <CheckCircle className="w-4 h-4 text-green-600" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        )}
        <span className={live ? 'text-green-700 dark:text-green-300' : 'text-amber-600'}>
          {storefrontDomainLabel(status)}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
        <Globe className="w-5 h-5 text-blue-600" />
        Domain Configuration
      </h3>
      <p className="text-sm text-neutral-500 mb-4">
        Google Merchant Center requires product links to point to a valid domain. Your products link to
        your storefront&apos;s live address below — a custom domain wins over the platform subdomain once
        it&apos;s active.
      </p>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-neutral-400" />
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Platform subdomain</span>
          </div>
          <span className={`text-sm font-medium ${platformSubdomainUrl ? 'text-green-600' : 'text-amber-600'}`}>
            {platformSubdomainUrl ?? 'Not configured'}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-neutral-400" />
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Custom domain</span>
          </div>
          <span className={`text-sm font-medium ${customDomain ? 'text-green-600' : 'text-neutral-500'}`}>
            {customDomain ? `https://${customDomain}` : 'Not connected'}
          </span>
        </div>

        <div className={`p-3 rounded-lg border ${
          storefrontBaseUrl
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          <div className="flex items-start gap-3">
            {storefrontBaseUrl ? (
              <CheckCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-medium ${storefrontBaseUrl ? 'text-blue-800 dark:text-blue-200' : 'text-amber-800 dark:text-amber-200'}`}>
                {storefrontBaseUrl ? `Product links use ${liveSource}` : 'No live storefront domain yet'}
              </p>
              <p className={`text-xs mt-1 ${storefrontBaseUrl ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {storefrontBaseUrl
                  ? `Google Merchant Center receives ${storefrontBaseUrl} for your products.`
                  : 'Publish a platform subdomain or connect a custom domain so Google Merchant Center receives a valid product link.'}
              </p>
              {!customDomain && tenantId && (
                <Link
                  href={`/t/${tenantId}/settings/subdomain`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Configure your storefront domain
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
