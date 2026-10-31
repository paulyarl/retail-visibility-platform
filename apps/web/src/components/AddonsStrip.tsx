'use client';

/**
 * AddonsStrip — horizontal-scroll add-on catalog (NRS "Premium Feature
 * Add-Ons" band parity). Renders the à-la-carte solutions list as
 * snap-scroll chips; `hrefFor` wires each chip to its workspace settings
 * page when the surface knows a tenant (claim teaser, upgrade page) —
 * chips render inert on public surfaces.
 */
import type { UpgradeSolution } from '@/services/DirectoryPresenceUpgradeService';

interface AddonsStripProps {
  items: UpgradeSolution[];
  hrefFor?: (key: string) => string | null;
  className?: string;
}

export default function AddonsStrip({ items, hrefFor, className = '' }: AddonsStripProps) {
  if (!items.length) return null;
  const chip =
    'snap-start flex-shrink-0 whitespace-nowrap rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 transition-colors';

  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="flex w-max gap-2 snap-x">
        {items.map((s) => {
          const href = hrefFor?.(s.key) ?? null;
          return href ? (
            <a key={s.key} href={href} title={s.tagline} className={`${chip} hover:bg-teal-100`}>
              {s.label} →
            </a>
          ) : (
            <span key={s.key} title={s.tagline} className={chip}>
              {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
