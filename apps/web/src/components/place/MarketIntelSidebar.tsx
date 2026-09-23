'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, Check, X, Lock, Download } from 'lucide-react';
import marketIntelPublicService, { MarketIntelTeaserSummary } from '@/services/MarketIntelPublicService';
import marketIntelCustomerService, {
  MarketIntelPartialContent,
  MarketIntelFullContent,
} from '@/services/MarketIntelCustomerService';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { MarketIntelCard } from './MarketIntelCard';
import { MarketIntelPaywall } from './MarketIntelPaywall';
import { MarketIntelBanner } from './MarketIntelBanner';

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
 * Phase 2: logged-in free shoppers see partial content (top 2-3 items).
 * Phase 3: paid/owner see full content + download button; unlock flow
 *   via the paywall modal.
 *
 * The teaser text is server-rendered via `initialTeaser` so crawlers see
 * it without JS; the client re-fetches only to refresh stale data (ttl: 0).
 *
 * Mounts only on directory seed pages (gated in PlacePageClient).
 *
 * Spec: §2.1 (surface model), §3 (cards), §4.2 (partial), §4.3 (full),
 *       §6.2 (paywall), §7.1 (component tree).
 */
export function MarketIntelSidebar({ slug, initialTeaser, activeClaimToken }: MarketIntelSidebarProps) {
  const { isAuthenticated } = useCustomerAuth();
  const [teaser, setTeaser] = useState<MarketIntelTeaserSummary | null>(initialTeaser ?? null);
  const [partial, setPartial] = useState<MarketIntelPartialContent | null>(null);
  const [full, setFull] = useState<MarketIntelFullContent | null>(null);
  const [unlockRequired, setUnlockRequired] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [open, setOpen] = useState(false);

  // Refresh teaser client-side (ttl: 0 — no cache).
  useEffect(() => {
    let cancelled = false;
    marketIntelPublicService.getTeaserSummary(slug).then((fresh) => {
      if (!cancelled && fresh) setTeaser(fresh);
    });
    return () => { cancelled = true; };
  }, [slug]);

  // When the sidebar opens and the user is authenticated, try to fetch
  // full content first. If 402 (unlock_required), fall back to partial.
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    let cancelled = false;

    (async () => {
      // Try full content first — paid/owner get it directly.
      const fullResult = await marketIntelCustomerService.getFullContent(slug);
      if (cancelled) return;

      if (fullResult.content) {
        setFull(fullResult.content);
        setUnlockRequired(false);
        return;
      }

      if (fullResult.unlockRequired) {
        setUnlockRequired(true);
        // Fall back to partial content for free shoppers.
        const partialData = await marketIntelCustomerService.getPartialContent(slug);
        if (!cancelled && partialData) setPartial(partialData);
        return;
      }

      // Other error — try partial as fallback.
      const partialData = await marketIntelCustomerService.getPartialContent(slug);
      if (!cancelled && partialData) setPartial(partialData);
    })();

    return () => { cancelled = true; };
  }, [slug, open, isAuthenticated]);

  // Re-fetch full content after a successful unlock.
  const handleUnlocked = async () => {
    setUnlockRequired(false);
    setPaywallOpen(false);
    const fullResult = await marketIntelCustomerService.getFullContent(slug);
    if (fullResult.content) setFull(fullResult.content);
  };

  // Claim card CTA: prefer the live token, fall back to #claim-inquiry (§3.4).
  const claimHref = activeClaimToken
    ? `/place/claim/${activeClaimToken}`
    : '#claim-inquiry';
  const claimCtaLabel = activeClaimToken ? 'Verify Ownership →' : 'Claim This Business →';

  // Determine the content tier to render.
  // - full: paid/owner → full content + download button
  // - partial: free shopper → partial content + "Unlock Full Report"
  // - teaser: anonymous → teaser only
  const hasFull = !!full;
  const hasPartial = !hasFull && !!partial;

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
          <span className="ml-auto text-xs text-gray-400">
            {hasFull ? 'Unlocked' : 'Insights available'}
          </span>
        )}
      </button>

      {/* Collapsible panel. */}
      {open && (
        <div id="market-intel-panel" className="mt-2 space-y-3">
          {/* Tall banner slot (300x600) — reserved seed banner inventory at the
              top of the panel, filled with this seed's report offer. */}
          <div className="flex justify-center">
            <MarketIntelBanner variant="tall" surfaceType="seed" teaser={teaser} />
          </div>

          {!teaser || !teaser.hasAudit ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm text-gray-500 dark:text-gray-400">
              We haven't gathered intel on this business yet — check back soon.
            </div>
          ) : (
            <>
              {/* Growth Opportunities */}
              <MarketIntelCard
                icon="📈"
                title="Growth Opportunities"
                teaser={teaser.cards.growthOpportunities.teaser}
                available={teaser.cards.growthOpportunities.available}
                ctaLabel={hasFull ? undefined : 'Unlock Full Report →'}
                ctaHref={hasFull ? undefined : undefined}
              >
                {/* Full content (paid/owner) */}
                {hasFull && full!.growthOpportunities.available && (
                  <div className="mb-3 space-y-2">
                    {full!.growthOpportunities.items.map((item, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {i + 1}. {item.title}
                          </span>
                          {item.impact && (
                            <span className="text-xs text-gray-400 mt-0.5">· {item.impact}</span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-gray-600 dark:text-gray-400 ml-4">{item.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Partial content (free shopper) */}
                {hasPartial && partial!.growthOpportunities.available && (
                  <div className="mb-3 space-y-1">
                    {partial!.growthOpportunities.items.map((item, i) => (
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
                    {partial!.growthOpportunities.lockedCount > 0 && (
                      <p className="text-xs text-gray-400 pl-6">
                        {partial!.growthOpportunities.lockedCount} more opportunit{partial!.growthOpportunities.lockedCount !== 1 ? 'ies' : 'y'}
                      </p>
                    )}
                  </div>
                )}
              </MarketIntelCard>

              {/* How It Stacks Up */}
              <MarketIntelCard
                icon="⚖️"
                title="How It Stacks Up"
                teaser={teaser.cards.howItStacksUp.teaser}
                available={teaser.cards.howItStacksUp.available}
                ctaLabel={hasFull ? undefined : 'Unlock Full Report →'}
              >
                {/* Full content (paid/owner) */}
                {hasFull && full!.howItStacksUp.available && (
                  <div className="mb-3 space-y-1">
                    {full!.howItStacksUp.signals.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        {s.met === true ? (
                          <Check className="w-3.5 h-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                        ) : s.met === false ? (
                          <X className="w-3.5 h-3.5 mt-0.5 text-red-400 flex-shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400">·</span>
                        )}
                        <div>
                          <span className="text-gray-700 dark:text-gray-300">{s.signal}</span>
                          {s.evidence && (
                            <p className="text-xs text-gray-400 ml-0">{s.evidence}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Partial content (free shopper) */}
                {hasPartial && partial!.howItStacksUp.available && (
                  <div className="mb-3 space-y-1">
                    {partial!.howItStacksUp.signals.map((s, i) => (
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

              {/* Full Audit Report — download button when unlocked */}
              <MarketIntelCard
                icon="📋"
                title="Full Audit Report"
                teaser={teaser.cards.fullReport.teaser}
                available={teaser.cards.fullReport.available}
                ctaLabel={hasFull ? undefined : 'Unlock →'}
              >
                {hasFull && (
                  <button
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={async () => {
                      // Fetch the PDF via the customer service (adds JWT headers),
                      // then trigger the browser download.
                      const res = await marketIntelCustomerService.downloadReportPdf(slug);
                      if (!res.blob) {
                        if (res.error === 'unauthorized') {
                          window.alert('Please sign in to download your report.');
                        } else if (res.error === 'unlock_required') {
                          window.alert(
                            "This account doesn't have access to the full report. If you claimed or purchased it, make sure you're signed in with the same email.",
                          );
                        } else {
                          window.alert('Failed to download report. Please try again.');
                        }
                        return;
                      }
                      const url = URL.createObjectURL(res.blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `market-intel-report-${slug}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="w-4 h-4" /> Download PDF Report
                  </button>
                )}
              </MarketIntelCard>

              {/* Claim This Business */}
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

          {/* Unlock CTA — shown when authenticated but not unlocked (§6.2) */}
          {isAuthenticated && unlockRequired && !hasFull && (
            <button
              onClick={() => setPaywallOpen(true)}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 text-sm font-semibold transition-colors"
            >
              Unlock Full Report — $29
            </button>
          )}
        </div>
      )}

      {/* Paywall modal */}
      <MarketIntelPaywall
        slug={slug}
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onUnlocked={handleUnlocked}
      />
    </aside>
  );
}
