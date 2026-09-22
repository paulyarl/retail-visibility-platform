/**
 * formatDiscoveryMarketContext — national ('__all__') framing tests.
 *
 * A national discovery campaign reads the (category,'__all__','__all__')
 * packet + the national __location__ packet. The formatter must:
 *   - use national phrasing (no city-scoped vocabulary)
 *   - render national_coverage aggregates (measured platform coverage)
 *   - omit city-only blocks (city_profile, notable_areas)
 *   - emit no literal '__all__' sentinel into model-visible copy
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../prisma', () => ({
  prisma: { $queryRaw: vi.fn() },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { formatDiscoveryMarketContext } from '../intelligence/MarketContextBindingFormatters';
import type { MarketContext } from '../intelligence/MarketContextLoader';

const NATIONAL_CATEGORY_CTX = {
  category_profile: { business_model: 'brick-and-mortar specialty grocery' },
  category_signals: ['halal counter', 'imported dry goods'],
  prospect_signals: ['handwritten signage'],
};

const NATIONAL_LOCATION_CTX = {
  market_summary: 'Specialty grocery density concentrates in coastal metros.',
  market_gaps: [{ category: 'african_grocery', signal: 'unmet demand', area: 'upper midwest' }],
  national_coverage: {
    totalStates: 12,
    totalCities: 47,
    totalListings: 1830,
    states: [
      { state: 'TX', cityCount: 9, listingCount: 402 },
      { state: 'CA', cityCount: 8, listingCount: 391 },
    ],
    topCities: [
      { city: 'Houston', state: 'TX', listingCount: 96 },
      { city: 'Atlanta', state: 'GA', listingCount: 84 },
    ],
  },
};

const CITY_LOCATION_CTX = {
  market_summary: 'Mid-size midwestern metro.',
  city_profile: { metro_description: 'mid-size metro' },
  notable_areas: ['Far Eastside'],
  market_gaps: [{ category: 'african_grocery', signal: 'unmet demand', area: 'Far Eastside' }],
};

const ctx = (category: object, location: object): MarketContext => ({
  category: category as MarketContext['category'],
  location: location as MarketContext['location'],
});

describe('formatDiscoveryMarketContext — national (__all__) framing', () => {
  it('uses national phrasing and renders measured coverage', () => {
    const out = formatDiscoveryMarketContext(
      ctx(NATIONAL_CATEGORY_CTX, NATIONAL_LOCATION_CTX),
      'african_grocery', '__all__', '__all__', 'emerging',
    );

    expect(out).toContain('=== MARKET CONTEXT');
    expect(out).toContain('national discovery');
    expect(out).toContain('--- NATIONAL LOCATION INTELLIGENCE ---');
    expect(out).toContain('NATIONAL COVERAGE (measured platform coverage):');
    expect(out).toContain('1830 listings across 47 markets in 12 states');
    expect(out).toContain('TX (402 listings / 9 markets)');
    expect(out).toContain('Houston, TX');
    expect(out).toContain('NATIONAL MARKET SUMMARY:');
  });

  it('omits city-only blocks and never leaks the sentinel', () => {
    const out = formatDiscoveryMarketContext(
      ctx(NATIONAL_CATEGORY_CTX, { ...NATIONAL_LOCATION_CTX, notable_areas: ['Nowhere'], city_profile: { metro_description: 'x' } }),
      'african_grocery', '__all__', '__all__', 'competitive',
    );

    expect(out).not.toContain('CITY MARKET SUMMARY:');
    expect(out).not.toContain('CITY PROFILE');
    expect(out).not.toContain('NOTABLE AREAS');
    expect(out).not.toContain("city's character");
    expect(out).not.toContain('__all__');
  });

  it('renders the national not-available line when the location row is absent', () => {
    const out = formatDiscoveryMarketContext(
      ctx(NATIONAL_CATEGORY_CTX, {}),
      'african_grocery', '__all__', '__all__', 'emerging',
    );

    expect(out).toContain('--- NATIONAL LOCATION INTELLIGENCE: not available ---');
    expect(out).toContain('National location enrichment has not run yet');
    expect(out).not.toContain('knowledge of the city');
  });

  it('city framing is unchanged for market-scoped discovery', () => {
    const out = formatDiscoveryMarketContext(
      ctx(NATIONAL_CATEGORY_CTX, CITY_LOCATION_CTX),
      'african_grocery', 'Indianapolis', 'IN', 'emerging',
    );

    expect(out).toContain('--- LOCATION INTELLIGENCE ---');
    expect(out).toContain('CITY MARKET SUMMARY:');
    expect(out).toContain('NOTABLE AREAS');
    expect(out).not.toContain('NATIONAL COVERAGE');
    expect(out).not.toContain('NATIONAL LOCATION INTELLIGENCE');
  });

  it('does not render national coverage for a city campaign even if present', () => {
    // Coverage aggregates only make sense framed nationally — a city campaign
    // carrying them (shouldn't happen) must not emit a national block.
    const out = formatDiscoveryMarketContext(
      ctx(NATIONAL_CATEGORY_CTX, { ...CITY_LOCATION_CTX, national_coverage: NATIONAL_LOCATION_CTX.national_coverage }),
      'african_grocery', 'Indianapolis', 'IN', 'emerging',
    );

    expect(out).not.toContain('NATIONAL COVERAGE');
  });
});
