/**
 * Tests for the emerging-archetype → hook angle map.
 *
 * Covers:
 * - Map completeness (every EmergingArchetype has an entry)
 * - getEmergingAngles ordering
 * - isValidEmergingArchetype
 * - deriveChannelHint (all combinations)
 * - extractEmergingArchetype / extractGrowthReadiness from V3 audit payloads
 */

import { describe, it, expect } from 'vitest';
import {
  EMERGING_ANGLE_MAP,
  isValidEmergingArchetype,
  getEmergingAngles,
  deriveChannelHint,
  extractEmergingArchetype,
  extractGrowthReadiness,
  type EmergingArchetype,
} from '../outreach-openers/emerging-angle-map';

describe('emerging-angle-map', () => {
  // ─── Map completeness ──────────────────────────────────────────────────

  describe('EMERGING_ANGLE_MAP', () => {
    it('has an entry for every EmergingArchetype', () => {
      const archetypes: EmergingArchetype[] = [
        'SINGLE_PLATFORM',
        'DIRECTORY_GHOST',
        'MISCATEGORIZED_OR_MISLABELED',
        'INVISIBLE_ANCHOR',
        'INSUFFICIENT_EVIDENCE',
      ];
      for (const a of archetypes) {
        expect(EMERGING_ANGLE_MAP[a]).toBeDefined();
        expect(Array.isArray(EMERGING_ANGLE_MAP[a])).toBe(true);
        expect(EMERGING_ANGLE_MAP[a].length).toBeGreaterThan(0);
      }
    });

    it('DIRECTORY_GHOST lists zero_footprint first', () => {
      expect(EMERGING_ANGLE_MAP.DIRECTORY_GHOST[0]).toBe('zero_footprint');
    });

    it('INVISIBLE_ANCHOR lists local_seo first', () => {
      expect(EMERGING_ANGLE_MAP.INVISIBLE_ANCHOR[0]).toBe('local_seo');
    });

    it('INSUFFICIENT_EVIDENCE maps to only zero_footprint', () => {
      expect(EMERGING_ANGLE_MAP.INSUFFICIENT_EVIDENCE).toEqual(['zero_footprint']);
    });
  });

  // ─── isValidEmergingArchetype ──────────────────────────────────────────

  describe('isValidEmergingArchetype', () => {
    it('returns true for valid archetypes', () => {
      expect(isValidEmergingArchetype('DIRECTORY_GHOST')).toBe(true);
      expect(isValidEmergingArchetype('INVISIBLE_ANCHOR')).toBe(true);
      expect(isValidEmergingArchetype('SINGLE_PLATFORM')).toBe(true);
      expect(isValidEmergingArchetype('MISCATEGORIZED_OR_MISLABELED')).toBe(true);
      expect(isValidEmergingArchetype('INSUFFICIENT_EVIDENCE')).toBe(true);
    });

    it('returns false for invalid strings', () => {
      expect(isValidEmergingArchetype('FOO')).toBe(false);
      expect(isValidEmergingArchetype('')).toBe(false);
      expect(isValidEmergingArchetype('directory_ghost')).toBe(false); // case-sensitive
    });
  });

  // ─── getEmergingAngles ─────────────────────────────────────────────────

  describe('getEmergingAngles', () => {
    it('returns the ordered list for a valid archetype', () => {
      expect(getEmergingAngles('DIRECTORY_GHOST')).toEqual(
        ['zero_footprint', 'gbp_verification', 'cross_platform_expansion'],
      );
    });

    it('returns an empty array for unknown archetypes', () => {
      expect(getEmergingAngles('FOO')).toEqual([]);
      expect(getEmergingAngles('')).toEqual([]);
    });
  });

  // ─── deriveChannelHint ─────────────────────────────────────────────────

  describe('deriveChannelHint', () => {
    it('returns phone_first when foundation_needed + phone only', () => {
      expect(deriveChannelHint('foundation_needed', true, false, false)).toBe('phone_first');
    });

    it('returns phone_first when insufficient_evidence + phone only', () => {
      expect(deriveChannelHint('insufficient_evidence', true, false, false)).toBe('phone_first');
    });

    it('returns null when growth_readiness is high_readiness', () => {
      expect(deriveChannelHint('high_readiness', true, false, false)).toBeNull();
    });

    it('returns null when growth_readiness is moderate_readiness', () => {
      expect(deriveChannelHint('moderate_readiness', true, false, false)).toBeNull();
    });

    it('returns null when growth_readiness is null', () => {
      expect(deriveChannelHint(null, true, false, false)).toBeNull();
    });

    it('returns null when phone-first but has email', () => {
      expect(deriveChannelHint('foundation_needed', true, true, false)).toBeNull();
    });

    it('returns null when phone-first but has social', () => {
      expect(deriveChannelHint('insufficient_evidence', true, false, true)).toBeNull();
    });

    it('returns null when no phone', () => {
      expect(deriveChannelHint('foundation_needed', false, false, false)).toBeNull();
    });

    it('returns null when undefined growth_readiness', () => {
      expect(deriveChannelHint(undefined, true, false, false)).toBeNull();
    });
  });

  // ─── extractEmergingArchetype ──────────────────────────────────────────

  describe('extractEmergingArchetype', () => {
    const v3AuditData = {
      prospect_discovery: {
        highest_opportunity_businesses: [
          {
            business_name: 'Acme Plumbing',
            city: 'Denver',
            emerging_archetype: 'INVISIBLE_ANCHOR',
            growth_readiness: 'foundation_needed',
          },
          {
            business_name: 'Beta Bakery',
            city: 'Boulder',
            emerging_archetype: 'DIRECTORY_GHOST',
            growth_readiness: 'insufficient_evidence',
          },
        ],
      },
    };

    it('matches by business name', () => {
      expect(extractEmergingArchetype(v3AuditData, 'Acme Plumbing')).toBe('INVISIBLE_ANCHOR');
      expect(extractEmergingArchetype(v3AuditData, 'Beta Bakery')).toBe('DIRECTORY_GHOST');
    });

    it('falls back to first business when name does not match', () => {
      expect(extractEmergingArchetype(v3AuditData, 'Unknown Corp')).toBe('INVISIBLE_ANCHOR');
    });

    it('falls back to first business when no businessName provided', () => {
      expect(extractEmergingArchetype(v3AuditData)).toBe('INVISIBLE_ANCHOR');
    });

    it('is case-insensitive on business name', () => {
      expect(extractEmergingArchetype(v3AuditData, 'acme plumbing')).toBe('INVISIBLE_ANCHOR');
    });

    it('returns null when audit data is null', () => {
      expect(extractEmergingArchetype(null)).toBeNull();
    });

    it('returns null when no highest_opportunity_businesses', () => {
      expect(extractEmergingArchetype({ prospect_discovery: {} })).toBeNull();
    });

    it('returns null when businesses array is empty', () => {
      expect(
        extractEmergingArchetype({ prospect_discovery: { highest_opportunity_businesses: [] } }),
      ).toBeNull();
    });

    it('returns null when archetype is not in the enum', () => {
      const data = {
        prospect_discovery: {
          highest_opportunity_businesses: [
            { business_name: 'X', emerging_archetype: 'UNKNOWN_TYPE' },
          ],
        },
      };
      expect(extractEmergingArchetype(data)).toBeNull();
    });

    it('handles audit data without prospect_discovery wrapper', () => {
      const flat = {
        highest_opportunity_businesses: [
          { business_name: 'X', emerging_archetype: 'SINGLE_PLATFORM' },
        ],
      };
      expect(extractEmergingArchetype(flat)).toBe('SINGLE_PLATFORM');
    });
  });

  // ─── extractGrowthReadiness ────────────────────────────────────────────

  describe('extractGrowthReadiness', () => {
    const v3AuditData = {
      prospect_discovery: {
        highest_opportunity_businesses: [
          {
            business_name: 'Acme Plumbing',
            emerging_archetype: 'INVISIBLE_ANCHOR',
            growth_readiness: 'foundation_needed',
          },
        ],
      },
    };

    it('matches by business name', () => {
      expect(extractGrowthReadiness(v3AuditData, 'Acme Plumbing')).toBe('foundation_needed');
    });

    it('falls back to first business', () => {
      expect(extractGrowthReadiness(v3AuditData)).toBe('foundation_needed');
    });

    it('returns null when audit data is null', () => {
      expect(extractGrowthReadiness(null)).toBeNull();
    });

    it('returns null when growth_readiness is not a valid enum value', () => {
      const data = {
        prospect_discovery: {
          highest_opportunity_businesses: [
            { business_name: 'X', growth_readiness: 'unknown' },
          ],
        },
      };
      expect(extractGrowthReadiness(data)).toBeNull();
    });
  });
});
