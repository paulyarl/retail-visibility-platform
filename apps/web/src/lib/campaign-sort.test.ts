import { describe, it, expect } from 'vitest';
import { sortCampaigns } from './campaign-sort';
import type { Campaign } from '@/services/MarketingOpsService';

/**
 * Ordering for the campaign pickers (openers / follow-ups). Pins the
 * tie-breakers and the missing-name / missing-created_at edge cases.
 */

function campaign(partial: Partial<Campaign>): Campaign {
  return {
    id: partial.id ?? partial.business_name ?? 'c',
    title: null,
    business_name: null,
    category: 'restaurant',
    city: '',
    state: null,
    stage: 'seek',
    created_at: '2026-01-01T00:00:00Z',
    ...partial,
  } as unknown as Campaign;
}

const names = (list: Campaign[]) => list.map((c) => c.business_name ?? c.title);

describe('sortCampaigns', () => {
  it('sorts by name case-insensitively and does not mutate the input', () => {
    const input = [
      campaign({ business_name: 'zeta', id: 'z' }),
      campaign({ business_name: 'Alpha', id: 'a' }),
      campaign({ business_name: 'beta', id: 'b' }),
    ];
    const out = sortCampaigns(input, 'name');
    expect(names(out)).toEqual(['Alpha', 'beta', 'zeta']);
    expect(names(input)).toEqual(['zeta', 'Alpha', 'beta']);
  });

  it('prefers title over business_name and sinks blank names last', () => {
    const out = sortCampaigns(
      [
        campaign({ business_name: null, title: 'Titled Co', id: 't' }),
        campaign({ business_name: 'Bravo', id: 'b' }),
        campaign({ business_name: null, title: null, id: 'n' }),
      ],
      'name',
    );
    expect(names(out)).toEqual(['Bravo', 'Titled Co', null]);
  });

  it('breaks name ties by location', () => {
    const out = sortCampaigns(
      [
        campaign({ business_name: 'Twin', city: 'Milwaukee', state: 'WI', id: 'm' }),
        campaign({ business_name: 'Twin', city: 'Chicago', state: 'IL', id: 'c' }),
      ],
      'name',
    );
    expect(out.map((c) => c.city)).toEqual(['Chicago', 'Milwaukee']);
  });

  it('sorts by location (city, state) with name as tie-breaker', () => {
    const out = sortCampaigns(
      [
        campaign({ business_name: 'Zed', city: 'Milwaukee', state: 'WI', id: 'z' }),
        campaign({ business_name: 'Ace', city: 'Chicago', state: 'IL', id: 'a' }),
        campaign({ business_name: 'Bee', city: 'Chicago', state: 'IL', id: 'b' }),
      ],
      'location',
    );
    expect(out.map((c) => `${c.city} ${c.business_name}`)).toEqual([
      'Chicago Ace',
      'Chicago Bee',
      'Milwaukee Zed',
    ]);
  });

  it('sorts by stage then name', () => {
    const out = sortCampaigns(
      [
        campaign({ business_name: 'Zed', stage: 'seek', id: 'z' }),
        campaign({ business_name: 'Ace', stage: 'preview_built', id: 'a' }),
        campaign({ business_name: 'Bee', stage: 'seek', id: 'b' }),
      ],
      'stage',
    );
    expect(out.map((c) => `${c.stage}:${c.business_name}`)).toEqual([
      'preview_built:Ace',
      'seek:Bee',
      'seek:Zed',
    ]);
  });

  it('sorts recently created first, with a missing date last', () => {
    const out = sortCampaigns(
      [
        campaign({ business_name: 'Old', created_at: '2026-01-01T00:00:00Z', id: 'o' }),
        campaign({ business_name: 'Unknown', created_at: '', id: 'u' }),
        campaign({ business_name: 'New', created_at: '2026-09-01T00:00:00Z', id: 'n' }),
      ],
      'recent',
    );
    expect(names(out)).toEqual(['New', 'Old', 'Unknown']);
  });

  it('handles an empty list', () => {
    expect(sortCampaigns([], 'name')).toEqual([]);
  });
});
