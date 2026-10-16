import type { Campaign } from '@/services/MarketingOpsService';

/**
 * Ordering for the campaign pickers (opener / follow-up workspaces).
 *
 * The campaign list endpoint returns workflow order, which reads as arbitrary
 * when an operator is scanning for a business by name or market. These sorts
 * re-order the already-loaded array — no extra fetch.
 */

export type CampaignSortKey = 'name' | 'location' | 'stage' | 'recent';

export const CAMPAIGN_SORT_OPTIONS: Array<{ value: CampaignSortKey; label: string }> = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'location', label: 'Location (city, state)' },
  { value: 'stage', label: 'Stage' },
  { value: 'recent', label: 'Recently created' },
];

function nameKey(c: Campaign): string {
  return (c.title || c.business_name || '').trim();
}

function locationKey(c: Campaign): string {
  return [c.city, c.state].filter(Boolean).join(', ');
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

/** Case-insensitive text compare that pushes blanks to the end. */
function compareKeys(a: string, b: string): number {
  if (!a || !b) {
    if (!a && !b) return 0;
    return a ? -1 : 1;
  }
  return compareText(a, b);
}

function createdTime(c: Campaign): number {
  const t = c.created_at ? new Date(c.created_at).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/** Returns a new array; never mutates the input. */
export function sortCampaigns(list: Campaign[], sortBy: CampaignSortKey): Campaign[] {
  const sorted = [...list];
  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'location': {
        const byLocation = compareKeys(locationKey(a), locationKey(b));
        return byLocation !== 0 ? byLocation : compareKeys(nameKey(a), nameKey(b));
      }
      case 'stage': {
        const byStage = compareText(a.stage, b.stage);
        return byStage !== 0 ? byStage : compareKeys(nameKey(a), nameKey(b));
      }
      case 'recent': {
        const byRecent = createdTime(b) - createdTime(a);
        return byRecent !== 0 ? byRecent : compareKeys(nameKey(a), nameKey(b));
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
