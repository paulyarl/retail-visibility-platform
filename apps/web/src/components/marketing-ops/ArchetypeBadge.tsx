'use client';

/**
 * ArchetypeBadge — renders the A1–A6 archetype code as a compact pill.
 *
 * Sibling campaigns share a business_prospect_id + business_name, so the
 * archetype code is the only signal that distinguishes them in a flat list.
 * Used on the campaign list, the openers workspace, and the siblings tab.
 *
 * Pass `showLabel` to append the human-readable label (e.g. "A1 · Review Gap")
 * for contexts with more room (siblings tab, openers dropdown). Omit it for
 * dense table cells where just the code suffices.
 */

export const ARCHETYPE_LABELS: Record<string, string> = {
  A1: 'Review Gap',
  A2: 'Negative Review Recovery',
  A3: 'Listing Drift',
  A4: 'Conversion / CTA Gap',
  A5: 'Multi-Signal Footprint',
  A6: 'Product Visibility Gap',
};

const ARCHETYPE_COLORS: Record<string, string> = {
  A1: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  A2: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  A3: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  A4: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  A5: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  A6: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
};

interface ArchetypeBadgeProps {
  archetype: string | null | undefined;
  /** When true, appends the human-readable label after the code. */
  showLabel?: boolean;
  className?: string;
}

export default function ArchetypeBadge({ archetype, showLabel, className }: ArchetypeBadgeProps) {
  if (!archetype) return null;
  const color = ARCHETYPE_COLORS[archetype] ?? 'bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-gray-300';
  const label = ARCHETYPE_LABELS[archetype];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold leading-none ${color} ${className ?? ''}`}
      title={label ? `${archetype} — ${label}` : archetype}
    >
      {archetype}
      {showLabel && label ? <span className="ml-1 font-medium">{label}</span> : null}
    </span>
  );
}
