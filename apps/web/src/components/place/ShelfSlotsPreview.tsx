'use client';

import { useEffect, useState } from 'react';
import { Store } from 'lucide-react';

/**
 * ShelfSlotsPreview — the "5 free product slots" illustration.
 *
 * Shared by the /place/about offer section and the /place/[slug] entry-page
 * slot teaser so both surfaces show the same owner-facing shelf framing
 * (real prices + an "In Stock" badge) rather than empty placeholder boxes.
 */
export const SAMPLE_SHELF_ITEMS = [
  { name: 'Specialty Grains & Flours', tag: 'High-Demand Staple', price: '$7.99', stock: 'In Stock' },
  { name: 'Imported Spices & Seasonings', tag: 'Hard-to-Find', price: '$4.50', stock: 'In Stock' },
  { name: 'Fresh Regional Produce', tag: 'Weekly Favorite', price: '$3.99', stock: 'In Stock' },
  { name: 'Specialty Teas & Beverages', tag: 'Fast Mover', price: '$5.50', stock: 'In Stock' },
  { name: 'Traditional Pantry Provisions', tag: 'Store Signature', price: '$8.25', stock: 'In Stock' },
];

/**
 * A sourced shelf item — from the seed's evidence-backed `observed_assets`
 * (audit scan output). `tag` describes how the item is known ("Shoppers
 * mention", "Commonly carried"), NOT stock status — unlike the SAMPLE items
 * it must never assert "In Stock" or a price the source didn't carry.
 */
export interface SourcedShelfItem {
  name: string;
  tag: string;
  evidence?: string | null;
}

interface ShelfSlotsPreviewProps {
  className?: string;
  /**
   * Sourced items from the seed's `observed_assets`. When provided, the
   * preview shows what shoppers actually associate with THIS store —
   * framed as likelihoods, never asserted stock/prices. When absent,
   * falls back to the illustrative sample (client-only, unindexed).
   */
  items?: SourcedShelfItem[];
}

export default function ShelfSlotsPreview({ className = '', items }: ShelfSlotsPreviewProps) {
  // Mount-gated: the sample items are illustrative, not real inventory.
  // Keeping them out of SSR prevents crawlers from indexing the teaser as
  // the business's actual products/prices (and 80 identical item lists
  // across seed pages as duplicate content).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className={`min-h-[280px] ${className}`} aria-hidden="true" />;
  }

  return <ShelfSlotsContent items={items} className={className} />;
}

/** The post-mount shelf body — exported so tests can render it without effects. */
export function ShelfSlotsContent({ className = '', items }: ShelfSlotsPreviewProps) {
  const sourced = items && items.length > 0;
  const display = sourced ? items!.slice(0, 5) : SAMPLE_SHELF_ITEMS;

  return (
    <div className={`bg-neutral-50 dark:bg-neutral-950 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm ${className}`}>
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-bold">
            {sourced ? 'What shoppers find here' : 'Example shelf — claim to make it yours'}
          </span>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
          {sourced ? 'From public info' : 'Illustrative preview'}
        </span>
      </div>
      <div className="space-y-3">
        {display.map((item, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-neutral-900 rounded-xl p-3.5 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-3 shadow-2xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 font-bold text-xs">
                #{idx + 1}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate text-neutral-900 dark:text-white">
                  {item.name}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {item.tag}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              {sourced ? (
                <p className="text-xs font-medium text-teal-600 dark:text-teal-400">
                  {'evidence' in item && item.evidence ? item.evidence : 'Sourced'}
                </p>
              ) : (
                <>
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">{(item as { price?: string }).price}</p>
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {(item as { stock?: string }).stock}
                  </p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
