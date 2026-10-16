import type { ProspectSummary } from '@/services/MarketingOpsService';

/**
 * Ordering for the prospect pickers (communications page, and any other
 * prospect selector that loads the whole list client-side).
 *
 * The list endpoint returns prospects in workflow order (status, then
 * priority, then newest) which reads as arbitrary to an operator scanning
 * for a business by name or market. These sorts re-order the already-loaded
 * array — no extra fetch — so the picker is instantly organized.
 */

export type ProspectSortKey = 'name' | 'location' | 'recent' | 'status';

export const PROSPECT_SORT_OPTIONS: Array<{ value: ProspectSortKey; label: string }> = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'location', label: 'Location (city, state)' },
  { value: 'recent', label: 'Recently contacted' },
  { value: 'status', label: 'Status' },
];

function nameKey(p: ProspectSummary): string {
  return (p.business_name || p.title || '').trim();
}

function locationKey(p: ProspectSummary): string {
  return [p.city, p.state].filter(Boolean).join(', ');
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

/** Case-insensitive text compare that pushes blanks to the end, so named
 *  businesses and known locations lead the picker. */
function compareKeys(a: string, b: string): number {
  if (!a || !b) {
    if (!a && !b) return 0;
    return a ? -1 : 1;
  }
  return compareText(a, b);
}

function contactTime(p: ProspectSummary): number {
  const t = p.last_contact_at ? new Date(p.last_contact_at).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/** Returns a new array; never mutates the input. */
export function sortProspects(list: ProspectSummary[], sortBy: ProspectSortKey): ProspectSummary[] {
  const sorted = [...list];
  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'location': {
        const byLocation = compareKeys(locationKey(a), locationKey(b));
        return byLocation !== 0 ? byLocation : compareKeys(nameKey(a), nameKey(b));
      }
      case 'recent': {
        const byRecent = contactTime(b) - contactTime(a);
        return byRecent !== 0 ? byRecent : compareKeys(nameKey(a), nameKey(b));
      }
      case 'status': {
        const byStatus = compareText(a.status, b.status);
        return byStatus !== 0 ? byStatus : compareKeys(nameKey(a), nameKey(b));
      }
      case 'name':
      default: {
        const byName = compareKeys(nameKey(a), nameKey(b));
        return byName !== 0 ? byName : compareKeys(locationKey(a), locationKey(b));
      }
    }
  });
  return sorted;
}
