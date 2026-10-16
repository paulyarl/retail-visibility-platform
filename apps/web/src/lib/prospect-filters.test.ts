import { describe, it, expect } from 'vitest';
import { filterProspects, statusRank, PROSPECT_FILTERS_EMPTY } from './prospect-filters';
import type { ProspectSummary } from '@/services/MarketingOpsService';

/**
 * Segment filters for the communications picker. These run client-side over
 * the loaded list, so the edge cases are the sentinel lenses ('any'/'none'),
 * the campaign-linkage cut, and the search matching the same fields the old
 * inline filter did.
 */

function prospect(partial: Partial<ProspectSummary>): ProspectSummary {
  return {
    id: partial.id ?? partial.business_name ?? 'p',
    business_name: null,
    title: null,
    category: null,
    city: null,
    state: null,
    status: 'queued',
    priority: 'normal',
    assigned_to: null,
    seed_id: null,
    campaign_id: null,
    campaign_title: null,
    campaign_stage: null,
    business_prospect_id: null,
    last_contact_at: null,
    contact_count: 0,
    ...partial,
  } as ProspectSummary;
}

const names = (list: ProspectSummary[]) => list.map((p) => p.business_name);

describe('filterProspects', () => {
  it('returns everything for the empty filter set', () => {
    const list = [prospect({ business_name: 'A' }), prospect({ business_name: 'B' })];
    expect(filterProspects(list, PROSPECT_FILTERS_EMPTY)).toHaveLength(2);
  });

  it('filters by status', () => {
    const list = [
      prospect({ business_name: 'Queued', status: 'queued' }),
      prospect({ business_name: 'Created', status: 'campaign_created' }),
    ];
    expect(names(filterProspects(list, { ...PROSPECT_FILTERS_EMPTY, status: 'campaign_created' }))).toEqual(['Created']);
  });

  it('filters by campaign linkage — with_campaign vs queue_only', () => {
    const list = [
      prospect({ business_name: 'Graduated', campaign_id: 'mc-1' }),
      prospect({ business_name: 'Waiting', campaign_id: null }),
    ];
    expect(names(filterProspects(list, { ...PROSPECT_FILTERS_EMPTY, campaignLinkage: 'with_campaign' }))).toEqual(['Graduated']);
    expect(names(filterProspects(list, { ...PROSPECT_FILTERS_EMPTY, campaignLinkage: 'queue_only' }))).toEqual(['Waiting']);
  });

  it('filters proving-ground membership — any / none / a specific PG', () => {
    const pg = { id: 'pg-1', title: 'Milwaukee Grocers', category: 'grocery', city: 'Milwaukee' };
    const list = [
      prospect({ business_name: 'InPg', proving_ground: pg }),
      prospect({ business_name: 'Ungrouped', proving_ground: null }),
    ];
    expect(names(filterProspects(list, { ...PROSPECT_FILTERS_EMPTY, pgLens: 'any' }))).toEqual(['InPg']);
    expect(names(filterProspects(list, { ...PROSPECT_FILTERS_EMPTY, pgLens: 'none' }))).toEqual(['Ungrouped']);
    expect(names(filterProspects(list, { ...PROSPECT_FILTERS_EMPTY, pgLens: 'pg-1' }))).toEqual(['InPg']);
    expect(names(filterProspects(list, { ...PROSPECT_FILTERS_EMPTY, pgLens: 'pg-other' }))).toEqual([]);
  });

  it('matches search across name, title, city, state and category', () => {
    const list = [
      prospect({ business_name: 'Arsema G Food Mart', city: 'Indianapolis', state: 'IN', category: 'African Grocery Store' }),
      prospect({ business_name: 'Raja Bazaar', city: 'Milwaukee', state: 'WI', category: 'Grocery' }),
    ];
    expect(names(filterProspects(list, { ...PROSPECT_FILTERS_EMPTY, search: 'arsema' }))).toEqual(['Arsema G Food Mart']);
    expect(names(filterProspects(list, { ...PROSPECT_FILTERS_EMPTY, search: 'milwaukee' }))).toEqual(['Raja Bazaar']);
    expect(names(filterProspects(list, { ...PROSPECT_FILTERS_EMPTY, search: 'african' }))).toEqual(['Arsema G Food Mart']);
  });

  it('ANDs the facets together', () => {
    const pg = { id: 'pg-1', title: 'Milwaukee Grocers', category: 'grocery', city: 'Milwaukee' };
    const list = [
      prospect({ business_name: 'Match', status: 'queued', campaign_id: null, proving_ground: pg }),
      prospect({ business_name: 'HasCampaign', status: 'queued', campaign_id: 'mc-1', proving_ground: pg }),
      prospect({ business_name: 'NoPg', status: 'queued', campaign_id: null, proving_ground: null }),
      prospect({ business_name: 'WrongStatus', status: 'hold', campaign_id: null, proving_ground: pg }),
    ];
    const out = filterProspects(list, {
      status: 'queued',
      campaignLinkage: 'queue_only',
      pgLens: 'any',
      search: '',
    });
    expect(names(out)).toEqual(['Match']);
  });
});

describe('statusRank', () => {
  it('orders statuses in funnel order and sinks unknown ones', () => {
    expect(statusRank('intake')).toBeLessThan(statusRank('queued'));
    expect(statusRank('queued')).toBeLessThan(statusRank('dismissed'));
    expect(statusRank('mystery')).toBeGreaterThan(statusRank('dismissed'));
  });
});
