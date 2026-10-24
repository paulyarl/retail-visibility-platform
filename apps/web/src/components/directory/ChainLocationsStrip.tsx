import Link from 'next/link';
import { MapPin } from 'lucide-react';

/**
 * "Also visit" strip — sibling locations in the same operator-linked chain
 * (Migration 359, CHAIN_PROSPECTING_FEED_SPEC §5.3). Renders nothing unless
 * the listing carries chainLocations — which only happens after an operator
 * verdict-links a same-phone group, so the cross-promotion is the chain's
 * free value demo before the owner ever claims.
 */
export interface ChainLocation {
  slug: string;
  businessName: string | null;
  city: string | null;
  state: string | null;
  listingOrigin: string | null;
}

export default function ChainLocationsStrip({ locations }: { locations: ChainLocation[] }) {
  if (!Array.isArray(locations) || locations.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
        <MapPin className="h-3.5 w-3.5" />
        Also visit
      </div>
      <div className="flex flex-wrap gap-2">
        {locations.map((loc) => (
          <Link
            key={loc.slug}
            href={loc.listingOrigin === 'directory_seed' ? `/place/${loc.slug}` : `/directory/${loc.slug}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-white px-3 py-1.5 text-sm text-emerald-900 hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-900/40 dark:bg-neutral-900 dark:text-emerald-200"
          >
            <span className="font-medium">{loc.businessName || 'Location'}</span>
            {(loc.city || loc.state) && (
              <span className="text-xs text-emerald-700/70 dark:text-emerald-400/70">
                — {[loc.city, loc.state].filter(Boolean).join(', ')}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
