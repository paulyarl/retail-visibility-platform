/**
 * Hook Library catalog tests (§15 slice 1)
 *
 * Verifies:
 * - HOOK_LIBRARY has exactly 12 entries
 * - Every angle key is unique
 * - Every template has all required fields populated
 * - Archetype codes are valid A1–A6
 * - Signal codes match the registry (no typos)
 * - getHook / isValidHookAngle / HOOK_ANGLE_KEYS helpers
 * - Body copy contains merge placeholders ({{salutation}}, {{sender_name}})
 * - No template contains the literal "Hey!" or "Adrien Yarl" (templatized)
 *
 * Spec: docs/LocalBiz/marketing_ops_outreach_intelligence_prep_sprint_plan.md §13
 */

import { describe, it, expect } from 'vitest';
import {
  HOOK_LIBRARY,
  HOOK_ANGLE_KEYS,
  getHook,
  isValidHookAngle,
  type HookAngle,
} from '../outreach-openers/hook-library';
import type { ArchetypeCode } from '../outreach-openers/archetype-selection';

const VALID_ARCHETYPES: ArchetypeCode[] = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'];

// Signal codes registered in migrations 158 + 170
const REGISTERED_SIGNALS = new Set([
  'RA_BBB_GRADE_SUPPRESSION',
  'RA_UNANSWERED_COMPLAINTS',
  'RA_REVIEW_DROUGHT',
  'RA_LOW_REVIEW_VOLUME',
  'RA_UNADDRESSED_NEGATIVE_BACKLOG',
  'RA_UNADDRESSED_POSITIVE_BACKLOG',
  'DS_CLAIMED_STATUS',
  'DS_MISSING_PROFILE',
  'DS_BROKEN_PROFILE_LINK',
  'DS_MISSING_SERVICE_MENU',
  'DS_OUTDATED_HOURS',
  'DS_PHOTO_DEFICIT',
  'WC_MISSING_WEBSITE',
  'WC_BROKEN_WEBSITE',
  'WC_URL_MISMATCH',
  'WC_MISSING_CTA',
  'WC_MISSING_SERVICE_PAGES',
  'WC_MOBILE_FRICTION',
  'CP_NAP_NAME_DRIFT',
  'CP_NAP_ADDRESS_DRIFT',
  'CP_NAP_PHONE_DRIFT',
  'CP_MISSING_CONTACT_INFO',
  'VP_MISSING_PROJECT_PHOTOS',
  'VP_STALE_SOCIAL_ACTIVITY',
  'DS_MISSING_PRODUCT_CATALOG',
  'DS_OUTDATED_HOLIDAY_HOURS',
  'WC_MISSING_PRODUCT_BROWSING',
  'WC_MISSING_AVAILABILITY_INQUIRY',
  'WC_MISSING_PICKUP_DELIVERY',
  'VP_MISSING_STOREFRONT_PHOTOS',
  'VP_MISSING_PRODUCT_PHOTOS',
  // EF_ZERO_INDEXED_PRESENCE is the operator vocabulary alias;
  // DS_ZERO_INDEXED_PRESENCE is the registered signal code (migration 191).
  'EF_ZERO_INDEXED_PRESENCE',
  'DS_ZERO_INDEXED_PRESENCE',
]);

describe('Hook Library catalog', () => {
  it('has exactly 14 entries', () => {
    expect(HOOK_LIBRARY).toHaveLength(14);
  });

  it('every angle key is unique', () => {
    const angles = HOOK_LIBRARY.map((h) => h.angle);
    expect(new Set(angles).size).toBe(angles.length);
  });

  it('HOOK_ANGLE_KEYS matches the library', () => {
    expect(HOOK_ANGLE_KEYS).toHaveLength(14);
    expect(HOOK_ANGLE_KEYS).toEqual(HOOK_LIBRARY.map((h) => h.angle));
  });

  it('every template has all required fields populated', () => {
    for (const hook of HOOK_LIBRARY) {
      expect(hook.angle).toBeTruthy();
      expect(hook.label).toBeTruthy();
      expect(hook.archetypes.length).toBeGreaterThan(0);
      expect(hook.signals.length).toBeGreaterThan(0);
      expect(hook.subject).toBeTruthy();
      expect(hook.body).toBeTruthy();
      expect(hook.shape.score_hook).toBeTruthy();
      expect(hook.shape.reassurance).toBeTruthy();
      expect(hook.shape.quantified_upside).toBeTruthy();
      expect(hook.shape.audit_offer).toBeTruthy();
      expect(hook.shape.soft_cta).toBeTruthy();
      expect(hook.phone_hook).toBeTruthy();
    }
  });

  it('zero_footprint is the 13th angle', () => {
    const zf = HOOK_LIBRARY.find((h) => h.angle === 'zero_footprint');
    expect(zf).toBeDefined();
    expect(zf!.archetypes).toContain('A3');
    expect(zf!.archetypes).toContain('A4');
    expect(zf!.signals).toContain('EF_ZERO_INDEXED_PRESENCE');
    expect(zf!.signals).toContain('DS_ZERO_INDEXED_PRESENCE');
  });

  it('every phone_hook contains neither {{salutation}} nor {{sender_name}}', () => {
    for (const hook of HOOK_LIBRARY) {
      expect(hook.phone_hook).not.toContain('{{salutation}}');
      expect(hook.phone_hook).not.toContain('{{sender_name}}');
    }
  });

  it('every archetype code is valid A1–A6', () => {
    for (const hook of HOOK_LIBRARY) {
      for (const archetype of hook.archetypes) {
        expect(VALID_ARCHETYPES).toContain(archetype);
      }
    }
  });

  it('every signal code is a known registry code', () => {
    for (const hook of HOOK_LIBRARY) {
      for (const signal of hook.signals) {
        expect(REGISTERED_SIGNALS.has(signal)).toBe(true);
      }
    }
  });

  it('body copy contains {{salutation}} and {{sender_name}} placeholders', () => {
    for (const hook of HOOK_LIBRARY) {
      expect(hook.body).toContain('{{salutation}}');
      expect(hook.body).toContain('{{sender_name}}');
    }
  });

  it('no template contains the literal "Hey!" greeting (templatized)', () => {
    for (const hook of HOOK_LIBRARY) {
      expect(hook.body).not.toContain('Hey!');
    }
  });

  it('no template contains the literal "Adrien Yarl" signature (templatized)', () => {
    for (const hook of HOOK_LIBRARY) {
      expect(hook.body).not.toContain('Adrien Yarl');
    }
  });

  it('no template contains niche-specific "African grocery" language (templatized)', () => {
    for (const hook of HOOK_LIBRARY) {
      expect(hook.body.toLowerCase()).not.toContain('african grocery');
      expect(hook.body.toLowerCase()).not.toContain('indianapolis');
      expect(hook.body.toLowerCase()).not.toContain('in indy');
    }
  });

  it('templates using {{category}} also use {{city}} (or neither)', () => {
    for (const hook of HOOK_LIBRARY) {
      const hasCategory = hook.body.includes('{{category}}');
      const hasCity = hook.body.includes('{{city}}');
      // If a template uses {{category}}, it should also use {{city}} (they
      // appear together in the "looking up {category} in {city}" pattern).
      // Templates that don't reference the niche at all use neither.
      if (hasCategory) {
        expect(hasCity).toBe(true);
      }
    }
  });
});

describe('getHook', () => {
  it('returns the template for a valid angle', () => {
    const hook = getHook('gbp_verification');
    expect(hook).toBeDefined();
    expect(hook!.angle).toBe('gbp_verification');
    expect(hook!.label).toBe('Google Business Profile verification & optimization');
  });

  it('returns undefined for an unknown angle', () => {
    const hook = getHook('nonexistent' as HookAngle);
    expect(hook).toBeUndefined();
  });
});

describe('isValidHookAngle', () => {
  it('returns true for all 13 catalog angles', () => {
    for (const angle of HOOK_ANGLE_KEYS) {
      expect(isValidHookAngle(angle)).toBe(true);
    }
  });

  it('returns false for unknown angles', () => {
    expect(isValidHookAngle('nonexistent')).toBe(false);
    expect(isValidHookAngle('')).toBe(false);
    expect(isValidHookAngle('GBP_VERIFICATION')).toBe(false); // case-sensitive
  });
});
