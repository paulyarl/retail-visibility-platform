'use client';

import { ReactNode } from 'react';

interface MarketIntelCardProps {
  /** Emoji or icon shown in the card header. */
  icon: string;
  /** Card title. */
  title: string;
  /** One-line teaser summary (the free, crawlable content). */
  teaser: string;
  /** Whether the underlying intelligence is available. */
  available: boolean;
  /** CTA label (e.g. "Unlock →", "Verify Ownership →"). */
  ctaLabel?: string;
  /** CTA href. When omitted, the CTA renders as "Coming soon" (Phase 1). */
  ctaHref?: string;
  /** Optional extra content rendered below the teaser (Phase 2+ partial content). */
  children?: ReactNode;
}

/**
 * MarketIntelCard — reusable shell for a single sidebar card.
 *
 * Phase 1: teaser + "Coming soon" CTA (no paywall yet). The teaser text
 * is server-rendered and crawlable; the CTA is a no-op affordance until
 * Phase 3 wires the paywall.
 *
 * Spec: §3 (card definitions), §7.1 (component tree).
 */
export function MarketIntelCard({
  icon,
  title,
  teaser,
  available,
  ctaLabel = 'Unlock →',
  ctaHref,
  children,
}: MarketIntelCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg" aria-hidden>{icon}</span>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>

      {/* Teaser — the crawlable, free content (§11.5). */}
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{teaser}</p>

      {children}

      {/* CTA: real link when wired, "Coming soon" affordance in Phase 1. */}
      {available && ctaHref ? (
        <a
          href={ctaHref}
          className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {ctaLabel}
        </a>
      ) : (
        <span className="inline-flex items-center text-sm text-gray-400 dark:text-gray-500">
          {ctaLabel} <span className="ml-1 italic">(Coming soon)</span>
        </span>
      )}
    </div>
  );
}
