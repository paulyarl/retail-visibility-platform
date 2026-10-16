import { describe, it, expect } from 'vitest';
import { sortProspects } from './prospect-sort';
import type { ProspectSummary } from '@/services/MarketingOpsService';

/**
 * Ordering for the prospect pickers. The endpoint returns workflow order
 * (status/priority/newest), so the client re-sorts the loaded array by name,
 * location, recency or status. These pin the tie-breakers and the
 * never-contacted / missing-name edge cases.
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

describe('sortProspects', () => {
  it('sorts by name case-insensitively and does not mutate the input', () => {
    const input = [
      prospect({ business_name: 'zeta market' }),
      prospect({ business_name: 'Alpha Grocery' }),
      prospect({ business_name: 'beta foods' }),
    ];
    const out = sortProspects(input, 'name');
    expect(names(out)).toEqual(['Alpha Grocery', 'beta foods', 'zeta market']);
    // input untouched
    expect(names(input)).toEqual(['zeta market', 'Alpha Grocery', 'beta foods']);
  });

  it('falls back to title when business_name is missing and sorts blanks last', () => {
    const out = sortProspects(
      [
        prospect({ business_name: null, title: 'Untitled Co' }),
        prospect({ business_name: 'Bravo' }),
        prospect({ business_name: null, title: null }),
      ],
      'name',
    );
    expect(names(out)).toEqual(['Bravo', null, null]);
    expect(out[1].title).toBe('Untitled Co');
  });

  it('breaks name ties by location', () => {
    const out = sortProspects(
      [
        prospect({ business_name: 'Twin Market', city: 'Milwaukee', state: 'WI' }),
        prospect({ business_name: 'Twin Market', city: 'Chicago', state: 'IL' }),
      ],
      'name',
    );
    expect(out.map((p) => p.city)).toEqual(['Chicago', 'Milwaukee']);
  });

  it('sorts by location (city, state) with name as tie-breaker', () => {
    const out = sortProspects(
      [
        prospect({ business_name: 'Zed', city: 'Milwaukee', state: 'WI' }),
        prospect({ business_name: 'Ace', city: 'Chicago', state: 'IL' }),
        prospect({ business_name: 'Bee', city: 'Chicago', state: 'IL' }),
      ],
      'location',
    );
    expect(out.map((p) => `${p.city} ${p.business_name}`)).toEqual([
      'Chicago Ace',
      'Chicago Bee',
      'Milwaukee Zed',
    ]);
  });

  it('sorts recently contacted first, with never-contacted last', () => {
    const out = sortProspects(
      [
        prospect({ business_name: 'Old', last_contact_at: '2026-01-01T00:00:00Z' }),
        prospect({ business_name: 'Never', last_contact_at: null }),
        prospect({ business_name: 'New', last_contact_at: '2026-09-01T00:00:00Z' }),
      ],
      'recent',
    );
    expect(names(out)).toEqual(['New', 'Old', 'Never']);
  });

  it('sorts by status then name', () => {
    const out = sortProspects(
      [
        prospect({ business_name: 'Zed', status: 'queued' }),
        prospect({ business_name: 'Ace', status: 'campaign_created' }),
        prospect({ business_name: 'Bee', status: 'queued' }),
      ],
      'status',
    );
    expect(out.map((p) => `${p.status}:${p.business_name}`)).toEqual([
      'campaign_created:Ace',
      'queued:Bee',
      'queued:Zed',
    ]);
  });

  it('handles an empty list', () => {
    expect(sortProspects([], 'name')).toEqual([]);
  });
});
