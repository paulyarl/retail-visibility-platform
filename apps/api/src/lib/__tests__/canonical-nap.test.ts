import { describe, it, expect } from 'vitest';
import {
  resolveCampaignNap,
  formatNapAddress,
  formatCampaignAddress,
  type CampaignNapSource,
  type NapAuditData,
} from '../canonical-nap';

// canonical-nap — the single contract for "what is this campaign's NAP".
// Precedence: campaign structured columns → audit canonical (nap_consistency)
// → audit_metadata.matched_business → components parsed from a combined
// canonical_address → requested_business → market scope (opt-in only).

const campaign: CampaignNapSource = {
  business_name: 'Arsema Market',
  phone: '317-555-0100',
  website_url: 'https://arsema.example.com',
  address_line1: '123 Main St',
  address_city: 'Indianapolis',
  address_state: 'IN',
  address_zip: '46201',
  city: 'Indianapolis',
  state: 'IN',
};

const audit: NapAuditData = {
  audit_metadata: {
    matched_business: {
      business_name: 'Arsema Market',
      city: 'Carmel',
      state: 'IN',
      phone: '317-555-0199',
    },
    requested_business: {
      business_name: 'Arsema Market',
      city: 'Gary',
      state: 'IN',
    },
  },
};

describe('resolveCampaignNap', () => {
  it('lets structured campaign columns win over every audit source', () => {
    const r = resolveCampaignNap(campaign, {
      audit_metadata: {
        matched_business: { city: 'Carmel', state: 'IN' },
        requested_business: { city: 'Gary', state: 'IN' },
      },
      nap_consistency: {
        canonical_address: '999 Other Ave, Carmel, IN 46032',
        canonical_city: 'Carmel',
        canonical_state: 'IN',
        canonical_zip: '46032',
      },
    });
    expect(r.name).toBe('Arsema Market');
    expect(r.address).toBe('123 Main St');
    expect(r.city).toBe('Indianapolis');
    expect(r.state).toBe('IN');
    expect(r.zip).toBe('46201');
    expect(r.phone).toBe('317-555-0100');
    expect(r.website).toBe('https://arsema.example.com');
    expect(r.combinedAddress).toBeNull();
  });

  it('splits a combined canonical_address into street + city + state + zip', () => {
    const r = resolveCampaignNap(
      { business_name: "Jay's Grocery & Restaurant" },
      {
        nap_consistency: {
          canonical_address: '2605 Independence Avenue, Kansas City, MO 64124',
        },
      },
    );
    expect(r.address).toBe('2605 Independence Avenue');
    expect(r.city).toBe('Kansas City');
    expect(r.state).toBe('MO');
    expect(r.zip).toBe('64124');
    expect(r.combinedAddress).toBe('2605 Independence Avenue, Kansas City, MO 64124');
  });

  it('keeps a suite/unit on the street line instead of dropping it', () => {
    const r = resolveCampaignNap(
      {},
      {
        nap_consistency: {
          canonical_address: '123 Main St, Suite 200, Kansas City, MO 64124',
        },
      },
    );
    // The US parser folds the suite segment into address_line1 rather than
    // truncating it — the old split(',')[0] heuristic lost nothing here,
    // but parse-aware extraction is what prevents "Suite 200" from being
    // read as the city.
    expect(r.address).toBe('123 Main St, Suite 200');
    expect(r.city).toBe('Kansas City');
    expect(r.state).toBe('MO');
  });

  it('prefers canonical_* components over matched_business city/state', () => {
    const r = resolveCampaignNap(
      {},
      {
        nap_consistency: { canonical_city: 'Carmel', canonical_state: 'IN' },
        audit_metadata: {
          matched_business: { city: 'Indianapolis', state: 'IN' },
        },
      },
    );
    expect(r.city).toBe('Carmel');
  });

  it('falls back matched → parsed combined → requested for city/state', () => {
    // matched wins over requested
    const matched = resolveCampaignNap({}, audit);
    expect(matched.city).toBe('Carmel');
    expect(matched.state).toBe('IN');

    // parsed components of a combined string sit between matched and
    // requested — a real address on the audit beats the intake request.
    const parsed = resolveCampaignNap(
      {},
      {
        audit_metadata: {
          requested_business: { city: 'Gary', state: 'IN' },
        },
        nap_consistency: { canonical_address: '2605 Independence Ave, Kansas City, MO 64124' },
      },
    );
    expect(parsed.city).toBe('Kansas City');
    expect(parsed.state).toBe('MO');

    // requested when nothing else knows the city
    const requested = resolveCampaignNap(
      {},
      {
        audit_metadata: {
          requested_business: { city: 'Gary', state: 'IN' },
        },
      },
    );
    expect(requested.city).toBe('Gary');
  });

  it('uses the first comma segment as street when the combined address is unparseable', () => {
    const r = resolveCampaignNap(
      {},
      { nap_consistency: { canonical_address: 'The Corner Shop, downtown' } },
    );
    expect(r.address).toBe('The Corner Shop');
    expect(r.city).toBeNull();
  });

  it('treats market scope as opt-in — off by default, on for display callers', () => {
    const strict = resolveCampaignNap({ business_name: 'B', city: 'Topeka', state: 'KS' });
    expect(strict.city).toBeNull();
    expect(strict.state).toBeNull();

    const loose = resolveCampaignNap(
      { business_name: 'B', city: 'Topeka', state: 'KS' },
      null,
      { marketScopeFallback: true },
    );
    expect(loose.city).toBe('Topeka');
    expect(loose.state).toBe('KS');

    // …but scope never overrides a real business field.
    const overridden = resolveCampaignNap(
      { address_city: 'Kansas City', city: 'Topeka', state: 'KS' },
      null,
      { marketScopeFallback: true },
    );
    expect(overridden.city).toBe('Kansas City');
    expect(overridden.state).toBe('KS');
  });

  it('returns nulls when nothing knows the business', () => {
    const r = resolveCampaignNap(null, null);
    expect(r).toMatchObject({
      name: null, address: null, city: null, state: null,
      zip: null, phone: null, website: null, combinedAddress: null,
    });
  });
});

describe('formatNapAddress', () => {
  it('composes street + city + state, joining line2 onto the street', () => {
    expect(
      formatNapAddress({ address: '123 Main St', address2: 'Suite 200', city: 'Kansas City', state: 'MO' }),
    ).toBe('123 Main St, Suite 200, Kansas City, MO');
  });

  it('appends zip only when asked', () => {
    const nap = { address: '123 Main St', city: 'Kansas City', state: 'MO', zip: '64124' };
    expect(formatNapAddress(nap)).toBe('123 Main St, Kansas City, MO');
    expect(formatNapAddress(nap, { includeZip: true })).toBe('123 Main St, Kansas City, MO, 64124');
  });

  it('returns null when there is nothing to compose', () => {
    expect(formatNapAddress({})).toBeNull();
    expect(formatNapAddress({ address: '  ', city: null })).toBeNull();
  });
});

describe('formatCampaignAddress', () => {
  it('renders structured columns with market-scope fallback', () => {
    expect(formatCampaignAddress(campaign)).toBe('123 Main St, Indianapolis, IN');
    expect(formatCampaignAddress(campaign, null, { includeZip: true })).toBe(
      '123 Main St, Indianapolis, IN, 46201',
    );
    // Scope fills display-only gaps.
    expect(formatCampaignAddress({ address_line1: '1 Elm St', city: 'Topeka', state: 'KS' })).toBe(
      '1 Elm St, Topeka, KS',
    );
  });
});
