/**
 * evidenceDimensions — authority-class → evidence-dimension vocabulary tests.
 *
 * Covers:
 *   - class inference from source names (the observed packet sources)
 *   - tier fallback when a name carries no class token (`official_website`)
 *   - precedence (owner outranks every other pattern)
 *   - the class → dimension map, incl. owner-above-dimensions (null)
 *   - runtime guards
 */

import { describe, it, expect } from 'vitest';
import {
  AUTHORITY_CLASS_DIMENSION,
  AUTHORITY_CLASSES,
  EVIDENCE_DIMENSIONS,
  dimensionForClass,
  inferAuthorityClass,
  isAuthorityClass,
  isEvidenceDimension,
} from '../evidenceDimensions';

describe('inferAuthorityClass', () => {
  it('classifies the observed Istanbul Super Market packet sources', () => {
    expect(inferAuthorityClass('Yelp', 'secondary_aggregator')).toBe('directory');
    expect(inferAuthorityClass('apple_maps', 'major_aggregator')).toBe('directory');
    expect(inferAuthorityClass('Zabihah', 'secondary_aggregator')).toBe('directory');
    expect(inferAuthorityClass('Grubhub', 'secondary_aggregator')).toBe('directory');
    expect(inferAuthorityClass('cap_times_press', 'secondary_aggregator')).toBe('directory');
    expect(inferAuthorityClass('mapquest', 'secondary_aggregator')).toBe('directory');
    expect(inferAuthorityClass('LinkedIn', 'secondary_aggregator')).toBe('social');
    expect(inferAuthorityClass('USDA SNAP retailer list', 'authoritative')).toBe('government');
    expect(inferAuthorityClass('usda_fns_snap_retailer_listing', 'authoritative')).toBe('government');
    expect(inferAuthorityClass('Owner website', 'first_party')).toBe('owner');
  });

  it('classifies government sources', () => {
    expect(inferAuthorityClass('Indiana Secretary of State')).toBe('government');
    expect(inferAuthorityClass('SAM.gov')).toBe('government');
    expect(inferAuthorityClass('State business registry')).toBe('government');
    expect(inferAuthorityClass('City business license')).toBe('government');
  });

  it('classifies trade and community sources', () => {
    expect(inferAuthorityClass('National Grocers trade network')).toBe('trade');
    expect(inferAuthorityClass('Neighborhood community group')).toBe('community');
    expect(inferAuthorityClass('Downtown chamber of commerce')).toBe('community');
  });

  it('falls back to the tier when the name carries no class token', () => {
    // `official_website` is first_party by tier but has no owner token in its
    // name — this is the case that keeps the tier fallback necessary.
    expect(inferAuthorityClass('official_website', 'first_party')).toBe('owner');
    expect(inferAuthorityClass('Some Random Directory', 'secondary_aggregator')).toBe('directory');
  });

  it('defaults unrecognized sources conservatively to directory', () => {
    expect(inferAuthorityClass('Some Random Directory')).toBe('directory');
    expect(inferAuthorityClass('Google Business Profile')).toBe('directory');
    expect(inferAuthorityClass('')).toBe('directory');
  });

  it('gives owner precedence over every other pattern', () => {
    // "owner" wins even when the name also looks like a registry.
    expect(inferAuthorityClass('Owner-confirmed state registry')).toBe('owner');
  });
});

describe('authority class → dimension', () => {
  it('maps the four classes to the four dimensions', () => {
    expect(dimensionForClass('directory')).toBe('operational');
    expect(dimensionForClass('social')).toBe('operational');
    expect(dimensionForClass('government')).toBe('identity');
    expect(dimensionForClass('trade')).toBe('category');
    expect(dimensionForClass('community')).toBe('location');
  });

  it('places owner above the dimensions (null)', () => {
    expect(dimensionForClass('owner')).toBeNull();
    expect(AUTHORITY_CLASS_DIMENSION.owner).toBeNull();
  });

  it('covers every class and dimension', () => {
    expect(AUTHORITY_CLASSES).toHaveLength(6);
    expect(EVIDENCE_DIMENSIONS).toHaveLength(4);
  });
});

describe('guards', () => {
  it('validates classes and dimensions', () => {
    expect(isAuthorityClass('government')).toBe(true);
    expect(isAuthorityClass('registry')).toBe(false);
    expect(isEvidenceDimension('operational')).toBe(true);
    expect(isEvidenceDimension('owner')).toBe(false);
  });
});
