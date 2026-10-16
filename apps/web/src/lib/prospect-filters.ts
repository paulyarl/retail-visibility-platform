import type { ProspectSummary } from '@/services/MarketingOpsService';

/**
 * Segment filters for the prospect pickers (communications page).
 *
 * The queue page filters server-side; the communications picker loads the
 * list once and narrows it in the browser, so these run over the already
 * loaded array — instant, no refetch, and the selected prospect never drops
 * out from under the operator.
 *
 * A "segment" is the slice of the registry the operator wants to work
 * together: by queue status, by campaign linkage (graduated vs still in the
 * queue), and by proving-ground membership.
 */

export type CampaignLinkage = 'all' | 'with_campaign' | 'queue_only';

/** '' = every prospect, 'any' = in a PG tree, 'none' = ungrouped, else a PG id. */
export type PgLens = string;

export interface ProspectFilters {
  /** 'all' or a queue status. */
  status: string;
  campaignLinkage: CampaignLinkage;
  pgLens: PgLens;
  search: string;
}

export const PROSPECT_FILTERS_EMPTY: ProspectFilters = {
  status: 'all',
  campaignLinkage: 'all',
  pgLens: '',
  search: '',
};

export function filterProspects(
  list: ProspectSummary[],
  filters: ProspectFilters,
): ProspectSummary[] {
  const q = filters.search.trim().toLowerCase();
  return list.filter((p) => {
    if (filters.status !== 'all' && p.status !== filters.status) return false;
    if (filters.campaignLinkage === 'with_campaign' && !p.campaign_id) return false;
    if (filters.campaignLinkage === 'queue_only' && p.campaign_id) return false;
    if (filters.pgLens === 'any' && !p.proving_ground) return false;
    if (filters.pgLens === 'none' && p.proving_ground) return false;
    if (
      filters.pgLens &&
      filters.pgLens !== 'any' &&
      filters.pgLens !== 'none' &&
      p.proving_ground?.id !== filters.pgLens
    ) {
      return false;
    }
    if (q) {
      return [p.business_name, p.title, p.city, p.state, p.category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    }
    return true;
  });
}

/** Funnel order for the status filter — mirrors the queue page's tab order. */
export const STATUS_FILTER_ORDER = [
  'intake', 'verify_then_outreach', 'queued', 'in_thread', 'hold', 'campaign_created', 'dismissed',
];

/** Funnel rank for the status filter; unknown statuses sink to the end. */
export function statusRank(status: string): number {
  const i = STATUS_FILTER_ORDER.indexOf(status);
  return i === -1 ? STATUS_FILTER_ORDER.length : i;
}
