import { describe, it, expect } from 'vitest';
import { searchCampaigns } from './campaign-filters';
import type { Campaign } from '@/services/MarketingOpsService';

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

describe('searchCampaigns', () => {
  it('returns the list unchanged for a blank query', () => {
    const list = [campaign({ business_name: 'A', id: 'a' }), campaign({ business_name: 'B', id: 'b' })];
    expect(searchCampaigns(list, '   ')).toBe(list);
  });

  it('matches business name / title, city, state, category and archetype', () => {
    const list = [
      campaign({ business_name: 'Arsema G Food Mart', city: 'Indianapolis', state: 'IN', category: 'Grocery', id: '1' }),
      campaign({ business_name: 'Raja Bazaar', city: 'Milwaukee', state: 'WI', category: 'Grocery', archetype: 'A3', id: '2' }),
    ];
    expect(names(searchCampaigns(list, 'arsema'))).toEqual(['Arsema G Food Mart']);
    expect(names(searchCampaigns(list, 'milwaukee'))).toEqual(['Raja Bazaar']);
    expect(names(searchCampaigns(list, 'wi'))).toEqual(['Raja Bazaar']);
    expect(names(searchCampaigns(list, 'a3'))).toEqual(['Raja Bazaar']);
    expect(names(searchCampaigns(list, 'grocery'))).toEqual(['Arsema G Food Mart', 'Raja Bazaar']);
  });

  it('returns an empty list when nothing matches', () => {
    const list = [campaign({ business_name: 'Only One', id: '1' })];
    expect(searchCampaigns(list, 'zzz')).toEqual([]);
  });
});
