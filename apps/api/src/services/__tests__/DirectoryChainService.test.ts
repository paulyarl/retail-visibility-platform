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
  address: null,
  zip_code: null,
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

  it('returns null: identical street + zip is one storefront, not a chain (the Enerem case)', () => {
    // Same name, phone, street, zip — only the city label differs
    // (Fort Wayne vs Huntertown, same 46748 address). A city-label data
    // issue, not a second location — distinct_address is required (§2.1).
    const r = computeChainSignals([
      member({ id: 'a', business_name: 'Enerem African Food Store', address: '17189 Delancey Court', zip_code: '46748', city: 'Fort Wayne' }),
      member({ id: 'b', business_name: 'Enerem African Food Store', address: '17189 Delancey Court', zip_code: '46748', city: 'Huntertown' }),
    ]);
    expect(r).toBeNull();
  });

  it('same street, different zip still candidates (zip mismatch could be either)', () => {
    const r = computeChainSignals([
      member({ id: 'a', business_name: 'Victory Foods A', address: '100 Main St', zip_code: '46201' }),
      member({ id: 'b', business_name: 'Victory Foods B', address: '100 Main St', zip_code: '46202' }),
    ]);
    expect(r?.confidence).toBe('chain_confirmed');
  });

  it('different streets with shared phone stay candidates', () => {
    const r = computeChainSignals([
      member({ id: 'a', business_name: 'Victory Super Store African Foods LLC', address: '7460 Rockville Rd', zip_code: '46214', city: 'Indianapolis' }),
      member({ id: 'b', business_name: 'Victory International Market Plainfield', address: '1601 E Main St #12', zip_code: '46168', city: 'Plainfield' }),
    ]);
    expect(r?.confidence).toBe('chain_confirmed');
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
