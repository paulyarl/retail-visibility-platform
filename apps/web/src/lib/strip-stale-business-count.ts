/**
 * Stored location-enrichment copy written before the count-free composer
 * contract carries a baked business count.
 *
 * `SeedSeoComposer` composed both the meta title (`{n} Businesses in {City} —
 * VisibleShelf Directory`) and the description (`Discover {n} local businesses
 * in {City}, …`) with a live listing count interpolated in. A packet is written
 * once and outlives the aggregate it was composed from, so that number goes
 * stale — "Discover 0 local businesses in Kansas City, MO" on a city that now
 * has listings, and a "0 Businesses" SERP title.
 *
 * The composer no longer emits a count (the page renders the live count itself:
 * "{total} businesses listed from public information"), but rows written under
 * the old contract keep the baked number forever. Normalizing at render
 * converges those legacy rows on the copy the composer emits today — the honest
 * alternative to displaying a count that can't reflect actual.
 *
 * Narrow on purpose: only a number immediately bound to "local businesses" or a
 * leading "N Businesses in" is dropped, so ordinary prose is untouched.
 */
const LEADING_BUSINESSES = /^\s*\d[\d,]*\s+businesses in\b/i;
const LOCAL_BUSINESSES = /\b\d[\d,]*\s+local businesses\b/gi;

export function stripStaleBusinessCount(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .replace(LEADING_BUSINESSES, 'Local Businesses in')
    .replace(LOCAL_BUSINESSES, 'local businesses');
}
