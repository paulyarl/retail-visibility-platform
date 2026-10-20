'use client';

import { useState } from 'react';

export interface SuggestedCategory {
  category: string;
  confidence: 'high' | 'medium' | 'low';
  is_known_category?: boolean;
  basis?: string[];
}

type Outcome = 'primary' | 'secondary';

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const eq = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * SuggestedCategoryChips — discovery suggestions on a derived prospect's audit
 * tab. "+ Secondary" registers the suggestion on this campaign through the same
 * category-identification act route the category card uses (destination
 * 'secondary'); the route fills the primary slot when empty, otherwise appends.
 */
export default function SuggestedCategoryChips({
  campaignId,
  businessName,
  suggestions,
  currentCategory,
  currentSecondaryCategories,
  onSynced,
}: {
  campaignId: string;
  businessName: string;
  suggestions: SuggestedCategory[];
  currentCategory?: string | null;
  currentSecondaryCategories?: string[];
  onSynced?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, Outcome>>({});
  const [error, setError] = useState<string | null>(null);

  const outcomeFor = (label: string): Outcome | null => {
    if (done[label]) return done[label];
    if (eq(currentCategory, label)) return 'primary';
    if ((currentSecondaryCategories ?? []).some((s) => eq(s, label))) return 'secondary';
    return null;
  };

  const addSecondary = async (s: SuggestedCategory) => {
    setBusy(s.category);
    setError(null);
    try {
      const { default: service } = await import('@/services/MarketingOpsService');
      const result = await service.categoryIdentificationAct(campaignId, {
        category_label: s.category,
        is_known: s.is_known_category !== false,
        destination: 'secondary',
        business_name: businessName,
        confidence: s.confidence,
      });
      const outcome: Outcome = result.registered_as === 'primary' ? 'primary' : 'secondary';
      setDone((prev) => ({ ...prev, [s.category]: outcome }));
      onSynced?.();
    } catch (err: any) {
      setError(err?.message || 'Could not add category');
    } finally {
      setBusy(null);
    }
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="mt-2" aria-label="Suggested categories">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-gray-500 dark:text-gray-400">Suggested categories:</span>
        {suggestions.map((s) => {
          const outcome = outcomeFor(s.category);
          return (
            <span
              key={s.category}
              title={(s.basis ?? []).join('; ') || undefined}
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
            >
              <span className={`px-1 rounded uppercase tracking-wide text-[9px] ${CONFIDENCE_STYLES[s.confidence] ?? ''}`}>
                {s.confidence}
              </span>
              <span>{s.category}</span>
              {s.is_known_category === false && <span className="text-gray-400">(new)</span>}
              {outcome ? (
                <span className="ml-0.5 text-gray-400">{outcome === 'primary' ? 'Primary' : 'Secondary'}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => addSecondary(s)}
                  disabled={busy !== null}
                  className="ml-0.5 text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                >
                  {busy === s.category ? 'Adding…' : '+ Secondary'}
                </button>
              )}
            </span>
          );
        })}
      </div>
      {error && <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
