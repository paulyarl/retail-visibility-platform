/**
 * Unit tests for the campaign-derived geography grid directive.
 *
 * The geography grid is the category-independent enumeration floor: it is
 * derived from the campaign (city/state + intelligence_zip_codes), not authored
 * by the AI, so the same grid applies to every category in the market. These
 * tests pin the parsing, the empty-market guard, and the token-keying
 * prohibition that fixes the "name does not self-identify" blind spot.
 */

import { describe, it, expect } from 'vitest';
import {
  parseZipCodes,
  normalizeCityKey,
  isNationalSentinel,
  buildGeographyGrid,
  buildGeographyGridDirective,
} from '../intelligence/geography-grid';

describe('parseZipCodes', () => {
  it('parses comma-separated zips', () => {
    expect(parseZipCodes('64118, 64124,64111')).toEqual(['64118', '64124', '64111']);
  });

  it('parses whitespace- and pipe-separated zips', () => {
    expect(parseZipCodes('64118 64124|64111')).toEqual(['64118', '64124', '64111']);
  });

  it('normalizes ZIP+4 to the 5-digit ZIP', () => {
    expect(parseZipCodes('64118-1234')).toEqual(['64118']);
  });

  it('dedupes repeated zips', () => {
    expect(parseZipCodes('64118, 64118')).toEqual(['64118']);
  });

  it('ignores non-zip tokens', () => {
    expect(parseZipCodes('Kansas City, 64118, MO, abc')).toEqual(['64118']);
  });

  it('returns [] for null/undefined/empty', () => {
    expect(parseZipCodes(null)).toEqual([]);
    expect(parseZipCodes(undefined)).toEqual([]);
    expect(parseZipCodes('')).toEqual([]);
  });
});

describe('normalizeCityKey', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeCityKey(' Kansas City ', 'mo')).toBe('kansas city|MO|');
  });

  it('appends a sorted, deduped ZIP segment when zips are present', () => {
    expect(normalizeCityKey('Kansas City', 'MO', ['64124', '64118', '64124']))
      .toBe('kansas city|MO|64118,64124');
  });

  it('distinguishes city+state from city+state+zip (exact-string semantics)', () => {
    const cityWide = normalizeCityKey('Kansas City', 'MO');
    const zipScoped = normalizeCityKey('Kansas City', 'MO', ['64118']);
    expect(cityWide).not.toBe(zipScoped);
  });

  it('returns null when both parts are empty', () => {
    expect(normalizeCityKey('', '')).toBeNull();
    expect(normalizeCityKey(null, undefined)).toBeNull();
  });

  it('handles a state-only market', () => {
    expect(normalizeCityKey(null, 'MO')).toBe('|MO|');
  });
});

describe('buildGeographyGrid', () => {
  it('builds a grid from campaign fields', () => {
    const grid = buildGeographyGrid({
      city: 'Kansas City',
      state: 'MO',
      intelligence_zip_codes: '64118, 64124',
      intelligence_search_radius_miles: 15,
    });
    expect(grid).toEqual({
      city: 'Kansas City',
      state: 'MO',
      zips: ['64118', '64124'],
      corridors: [],
      adjacent_municipalities: [],
      radius_miles: 15,
    });
  });

  it('nulls absent fields', () => {
    const grid = buildGeographyGrid({});
    expect(grid).toEqual({
      city: null,
      state: null,
      zips: [],
      corridors: [],
      adjacent_municipalities: [],
      radius_miles: null,
    });
  });

  it('treats an empty-string radius as null', () => {
    expect(buildGeographyGrid({ intelligence_search_radius_miles: '' }).radius_miles).toBeNull();
  });
});

describe('buildGeographyGridDirective', () => {
  it('returns empty string when the campaign names no city and no state', () => {
    expect(buildGeographyGridDirective({})).toBe('');
  });

  it('lists the authoritative zip sweep units from the campaign', () => {
    const directive = buildGeographyGridDirective({
      city: 'Kansas City',
      state: 'MO',
      intelligence_zip_codes: '64118, 64124',
    });
    expect(directive).toContain('Market: Kansas City, MO');
    expect(directive).toContain('64118, 64124');
    expect(directive).toContain('from this campaign');
    expect(directive).toContain('=== GEOGRAPHY GRID');
  });

  it('falls back to metro-extent derivation when no zips are set', () => {
    const directive = buildGeographyGridDirective({ city: 'Kansas City', state: 'MO' });
    expect(directive).toContain('DERIVE them');
    expect(directive).toContain('RETAIL CATCHMENT');
    expect(directive).toContain('separately-incorporated municipalities that share ZIPs');
  });

  it('uses the city-level cache when the campaign has no zips', () => {
    const directive = buildGeographyGridDirective(
      { city: 'Kansas City', state: 'MO' },
      {
        city: 'Kansas City',
        state: 'MO',
        zips: ['64118', '64124'],
        corridors: ['Independence Ave / US-24'],
        adjacent_municipalities: ['Gladstone', 'North Kansas City'],
        radius_miles: null,
      },
    );
    expect(directive).toContain('from the cached market grid');
    expect(directive).toContain('64118, 64124');
    expect(directive).toContain('Independence Ave / US-24');
    expect(directive).toContain('Gladstone, North Kansas City');
  });

  it('reuses the cached grid for the exact key (cached wins over campaign zips)', () => {
    const directive = buildGeographyGridDirective(
      { city: 'Kansas City', state: 'MO', intelligence_zip_codes: '64118' },
      {
        city: 'Kansas City',
        state: 'MO',
        zips: ['64118'],
        corridors: ['North Oak Trafficway'],
        adjacent_municipalities: ['Gladstone'],
        radius_miles: null,
      },
    );
    expect(directive).toContain('from the cached market grid');
    expect(directive).toContain('64118');
    expect(directive).toContain('North Oak Trafficway');
    expect(directive).toContain('Gladstone');
  });

  it('carries the token-keying prohibition (the core fix)', () => {
    const directive = buildGeographyGridDirective({ city: 'Kansas City', state: 'MO' });
    expect(directive).toContain('Do NOT key these datasets on the category name');
    expect(directive).toContain('label-independent dataset makes it label-dependent');
    expect(directive).toContain('zero findings');
  });

  it('carries the shared-ZIP rule and the derivation-basis requirement', () => {
    const directive = buildGeographyGridDirective({ city: 'Kansas City', state: 'MO' });
    expect(directive).toContain('ONE sweep unit');
    expect(directive).toContain('RECORD THE DERIVATION BASIS');
  });

  it('returns empty string for the national __all__ sentinel (no single catchment)', () => {
    // A national establishment has no retail catchment — emitting the
    // directive would read "Market: __all__" and ask for a nationwide ZIP
    // derivation that no sweep can execute.
    expect(buildGeographyGridDirective({ city: '__all__', state: '__all__' })).toBe('');
    expect(buildGeographyGridDirective({ city: '__all__', state: 'IN' })).toBe('');
    expect(buildGeographyGridDirective({ city: 'Kansas City', state: '__all__' })).toBe('');
    // Case-insensitive — the sentinel is matched after trimming/lowercasing.
    expect(buildGeographyGridDirective({ city: ' __ALL__ ', state: ' mo ' })).toBe('');
  });
});

describe('isNationalSentinel', () => {
  it('matches __all__ case-insensitively and trims', () => {
    expect(isNationalSentinel('__all__')).toBe(true);
    expect(isNationalSentinel(' __ALL__ ')).toBe(true);
  });

  it('rejects real places and empties', () => {
    expect(isNationalSentinel('Indianapolis')).toBe(false);
    expect(isNationalSentinel('all')).toBe(false);
    expect(isNationalSentinel(null)).toBe(false);
    expect(isNationalSentinel(undefined)).toBe(false);
    expect(isNationalSentinel('')).toBe(false);
  });
});
