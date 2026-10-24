/**
 * computeChainSignals — the chain-candidacy scorer behind the dedup
 * prospecting feed (Migration 359, CHAIN_PROSPECTING_FEED_SPEC §4).
 * Pure function: members are pre-loaded phone-match rows.
 */

import { describe, it, expect } from 'vitest';
import { computeChainSignals, type ChainMemberSignals } from '../DirectoryChainService';

const member = (over: Partial<ChainMemberSignals>): ChainMemberSignals => ({
  id: 'dps-1',
  business_name: null,
  city: 'Indianapolis',
  state: 'IN',
  phone: '(317) 998-2510',
  category: 'African Grocery Store',
  same_as: [],
  owner_email: null,
  owner_phone: null,
  ...over,
});

describe('computeChainSignals', () => {
  it('returns null for fewer than 2 members', () => {
    expect(computeChainSignals([member({})])).toBeNull();
    expect(computeChainSignals([])).toBeNull();
  });

  it('confirmed: same phone + shared brand token (the Victory case)', () => {
    const r = computeChainSignals([
      member({ id: 'a', business_name: 'Victory Super Store African Foods LLC', city: 'Indianapolis' }),
      member({ id: 'b', business_name: 'Victory International Market Plainfield', city: 'Plainfield' }),
    ]);
    expect(r?.confidence).toBe('chain_confirmed');
    expect(r?.signals).toContain('same_phone');
    expect(r?.signals).toContain('name_token_overlap');
    expect(r?.nameTokenOverlap).toContain('victory');
    expect(r?.sharedPhone).toBe('3179982510');
    expect(r?.cities.sort()).toEqual(['Indianapolis', 'Plainfield']);
  });

  it('confirmed: same phone + shared same_as domain', () => {
    const r = computeChainSignals([
      member({ id: 'a', business_name: 'A One Foods', same_as: ['https://www.facebook.com/victorymkt'] }),
      member({ id: 'b', business_name: 'A Two Foods', same_as: ['facebook.com/victorymkt', 'https://yelp.com/x'] }),
    ]);
    expect(r?.confidence).toBe('chain_confirmed');
    expect(r?.signals).toContain('same_as_overlap');
  });

  it('confirmed: same phone + identical owner contact', () => {
    const r = computeChainSignals([
      member({ id: 'a', business_name: 'North Foods', owner_phone: '317-998-2510' }),
      member({ id: 'b', business_name: 'South Foods', owner_phone: '(317) 998-2510' }),
    ]);
    expect(r?.confidence).toBe('chain_confirmed');
    expect(r?.signals).toContain('owner_contact_match');
  });

  it('probable: same phone alone, no other corroboration', () => {
    const r = computeChainSignals([
      member({ id: 'a', business_name: 'Elm Street Grocery', category: 'Grocery Store' }),
      member({ id: 'b', business_name: 'Oak Avenue Pharmacy', category: 'Pharmacy' }),
    ]);
    expect(r?.confidence).toBe('chain_probable');
    expect(r?.signals).toEqual(['same_phone']);
  });

  it('probable: name overlap + same category, different phones', () => {
    const r = computeChainSignals([
      member({ id: 'a', business_name: 'Zamzam Foods East', phone: '317-111-1111' }),
      member({ id: 'b', business_name: 'Zamzam Foods West', phone: '317-222-2222' }),
    ]);
    expect(r?.confidence).toBe('chain_probable');
    expect(r?.signals).not.toContain('same_phone');
    expect(r?.signals).toContain('name_token_overlap');
    expect(r?.signals).toContain('same_category');
  });

  it('returns null: different phones AND no name overlap', () => {
    const r = computeChainSignals([
      member({ id: 'a', business_name: 'Elm Street Grocery', phone: '317-111-1111' }),
      member({ id: 'b', business_name: 'Oak Avenue Pharmacy', phone: '317-222-2222' }),
    ]);
    expect(r).toBeNull();
  });

  it('city names are not brand tokens — "Milwaukee Market" vs "Milwaukee Foods" does not overlap on milwaukee', () => {
    const r = computeChainSignals([
      member({ id: 'a', business_name: 'Milwaukee Halal Market', city: 'Milwaukee' }),
      member({ id: 'b', business_name: 'Milwaukee Halal Foods', city: 'Milwaukee' }),
    ]);
    // halal overlaps (not a stopword) — so this IS a candidate; use a case
    // where the ONLY shared token is the city name.
    expect(r?.nameTokenOverlap).not.toContain('milwaukee');
  });

  it('stopword-only names produce no brand tokens', () => {
    const r = computeChainSignals([
      member({ id: 'a', business_name: 'Super Food Store', category: 'Bakery' }),
      member({ id: 'b', business_name: 'Super Grocery Mart', category: 'Bakery' }),
    ]);
    // Same phone but every token is a stopword → probable via phone only.
    expect(r?.confidence).toBe('chain_probable');
    expect(r?.nameTokenOverlap).toEqual([]);
  });
});
