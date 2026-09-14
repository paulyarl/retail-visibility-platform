'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, Check, X, Lock } from 'lucide-react';
import marketIntelPublicService, { MarketIntelTeaserSummary } from '@/services/MarketIntelPublicService';
import marketIntelCustomerService, { MarketIntelPartialContent } from '@/services/MarketIntelCustomerService';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { MarketIntelCard } from './MarketIntelCard';

interface MarketIntelSidebarProps {
  slug: string;
  /** Server-rendered teaser data (§11.5 — crawlable DOM content). */
  initialTeaser?: MarketIntelTeaserSummary | null;
  /** Active claim token for the Claim card CTA (§3.4). */
  activeClaimToken?: string | null;
}

/**
 * MarketIntelSidebar — collapsible intelligence sidebar for seed pages.
 *
 * Phase 1: teaser cards + "Coming soon" CTAs.
 * Phase 2: when the visitor is a logged-in free customer, fetches partial
 * content (top 2-3 items per card) and renders it inline. "Unlock Full
 * Report →" CTAs remain "Coming soon" until Phase 3 wires the paywall.
 *
 * The teaser text is server-rendered via `initialTeaser` so crawlers see
 * it without JS; the client re-fetches only to refresh stale data (ttl: 0).
 *
 * Mounts only on directory seed pages (gated in PlacePageClient).
 *
 * Spec: §2.1 (surface model), §3 (cards), §4.2 (partial), §7.1 (component tree).
 */
export function MarketIntelSidebar({ slug, initialTeaser, activeClaimToken }: MarketIntelSidebarProps) {
  const { isAuthenticated } = useCustomerAuth();
  const [teaser, setTeaser] = useState<MarketIntelTeaserSummary | null>(initialTeaser ?? null);
  const [partial, setPartial] = useState<MarketIntelPartialContent | null>(null);
  const [open, setOpen] = useState(false);

  // Refresh teaser client-side (ttl: 0 — no cache). Falls back to the
  // server-rendered initialTeaser on failure.
  useEffect(() => {
    let cancelled = false;
    marketIntelPublicService.getTeaserSummary(slug).then((fresh) => {
      if (!cancelled && fresh) setTeaser(fresh);
    });
    return () => { cancelled = true; };
  }, [slug]);

  // Fetch partial content only when the sidebar is open AND the visitor
  // is authenticated (Phase 2). Anonymous visitors see teasers only.
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    let cancelled = false;
    marketIntelCustomerService.getPartialContent(slug).then((fresh) => {
      if (!cancelled && fresh) setPartial(fresh);
    });
    return () => { cancelled = true; };
  }, [slug, open, isAuthenticated]);

  // Claim card CTA: prefer the live token, fall back to #claim-inquiry (§3.4).
  const claimHref = activeClaimToken
    ? `/place/claim/${activeClaimToken}`
    : '#claim-inquiry';
  const claimCtaLabel = activeClaimToken ? 'Verify Ownership →' : 'Claim This Business →';

  return (
    <aside className="w-full">
      {/* Toggle tab — discoverable, not demanding (§1.3). */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="market-intel-panel"
        className="flex w-full items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-left shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Market Intel</span>
        {teaser?.hasAudit && (
          <span className="ml-auto text-xs text-gray-400">Insights available</span>
        )}
      </button>

      {/* Collapsible panel. */}
      {open && (
        <div
          id="market-intel-panel"
          className="mt-2 space-y-3"
        >
          {!teaser || !teaser.hasAudit ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm text-gray-500 dark:text-gray-400">
              No market intelligence available for this business yet.
            </div>
          ) : (
            <>
              {/* Growth Opportunities — partial content when authenticated. */}
              <MarketIntelCard
                icon="📈"
                title="Growth Opportunities"
                teaser={teaser.cards.growthOpportunities.teaser}
                available={teaser.cards.growthOpportunities.available}
                ctaLabel="Unlock Full Report →"
              >
                {isAuthenticated && partial?.growthOpportunities.available && (
                  <div className="mb-3 space-y-1">
                    {partial.growthOpportunities.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        {item.locked ? (
                          <Lock className="w-3.5 h-3.5 mt-0.5 text-gray-400 flex-shrink-0" />
                        ) : (
                          <Check className="w-3.5 h-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                        )}
                        <span className={item.locked ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}>
                          {item.title}
                          {item.impact && (
                            <span className="ml-1 text-xs text-gray-400">· {item.impact}</span>
                          )}
                        </span>
                      </div>
                    ))}
                    {partial.growthOpportunities.lockedCount > 0 && (
                      <p className="text-xs text-gray-400 pl-6">
                        {partial.growthOpportunities.lockedCount} more opportunit{partial.growthOpportunities.lockedCount !== 1 ? 'ies' : 'y'}
                      </p>
                    )}
                  </div>
                )}
              </MarketIntelCard>

              {/* How It Stacks Up — partial content when authenticated. */}
              <MarketIntelCard
                icon="⚖️"
                title="How It Stacks Up"
                teaser={teaser.cards.howItStacksUp.teaser}
                available={teaser.cards.howItStacksUp.available}
                ctaLabel="Unlock Full Report →"
              >
                {isAuthenticated && partial?.howItStacksUp.available && (
                  <div className="mb-3 space-y-1">
                    {partial.howItStacksUp.signals.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        {s.met === true ? (
                          <Check className="w-3.5 h-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                        ) : s.met === false ? (
                          <X className="w-3.5 h-3.5 mt-0.5 text-red-400 flex-shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400">·</span>
                        )}
                        <span className="text-gray-700 dark:text-gray-300">{s.signal}</span>
                      </div>
                    ))}
                  </div>
                )}
              </MarketIntelCard>

              <MarketIntelCard
                icon="📋"
                title="Full Audit Report"
                teaser={teaser.cards.fullReport.teaser}
                available={teaser.cards.fullReport.available}
              />
              <MarketIntelCard
                icon="🔑"
                title="Claim This Business"
                teaser={teaser.cards.claimBusiness.teaser}
                available={teaser.cards.claimBusiness.available}
                ctaLabel={claimCtaLabel}
                ctaHref={claimHref}
              />
            </>
          )}
        </div>
      )}
    </aside>
  );
}
