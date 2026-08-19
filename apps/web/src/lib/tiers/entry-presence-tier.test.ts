/**
 * V3.1 Entry Presence tier feature map tests
 *
 * Verifies:
 * - `presence` tier exists in TIER_FEATURES with directory-mode capabilities only
 * - `presence` has logo/about/gallery/social/editorial/immersive features
 * - `presence` does NOT have Google or platform product-browse features
 * - `presence` inherits only [directory_presence] (no google_only)
 * - `presence` is in TIER_DISPLAY_NAMES as "Starter" and priced at $19
 * - Legacy `starter` remains separate and inactive (different feature bag)
 * - `google_only` remains inactive (not in active V3 hierarchy)
 */
import { describe, it, expect } from 'vitest';
import {
  TIER_FEATURES,
  TIER_HIERARCHY,
  TIER_DISPLAY_NAMES,
  TIER_PRICING,
} from './tier-features';

describe('V3.1 Entry Presence tier feature maps', () => {
  describe('presence tier definition', () => {
    it('exists in TIER_FEATURES', () => {
      expect(TIER_FEATURES).toHaveProperty('presence');
      expect(Array.isArray(TIER_FEATURES.presence)).toBe(true);
    });

    it('has directory enrichment features (logo, about, gallery, social)', () => {
      const features = TIER_FEATURES.presence as readonly string[];
      expect(features).toContain('directory_entry_logo_on');
      expect(features).toContain('directory_entry_about_on');
      expect(features).toContain('directory_entry_gallery_on');
      expect(features).toContain('directory_entry_social_on');
    });

    it('has editorial and immersive layout features', () => {
      const features = TIER_FEATURES.presence as readonly string[];
      expect(features).toContain('directory_entry_layout_editorial');
      expect(features).toContain('directory_entry_layout_immersive');
    });

    it('has base directory features (hours, map, contact, qr, classic layout)', () => {
      const features = TIER_FEATURES.presence as readonly string[];
      expect(features).toContain('directory_entry_hours_on');
      expect(features).toContain('directory_entry_map_on');
      expect(features).toContain('directory_entry_contact_on');
      expect(features).toContain('directory_entry_qr_on');
      expect(features).toContain('directory_entry_layout_classic');
    });

    it('does NOT have Google capabilities', () => {
      const features = TIER_FEATURES.presence as readonly string[];
      expect(features).not.toContain('google_shopping');
      expect(features).not.toContain('google_merchant_center');
      expect(features).not.toContain('google_swis');
    });

    it('does NOT have platform product-browse or storefront features', () => {
      const features = TIER_FEATURES.presence as readonly string[];
      // `storefront_enabled` and `storefront_retail` are base directory chrome,
      // NOT platform marketplace browse. The legacy `storefront` feature key
      // (without _enabled) is the platform browse one — presence must NOT have it.
      expect(features).not.toContain('storefront');
      expect(features).not.toContain('product_search');
    });

    it('does NOT have legacy starter feature bag (clover, enhanced_seo, etc.)', () => {
      const features = TIER_FEATURES.presence as readonly string[];
      expect(features).not.toContain('clover_pos');
      expect(features).not.toContain('enhanced_seo');
      expect(features).not.toContain('image_finder');
      expect(features).not.toContain('category_quick_start');
      expect(features).not.toContain('mobile_responsive');
    });
  });

  describe('presence tier hierarchy', () => {
    it('inherits only directory_presence (no google_only)', () => {
      expect(TIER_HIERARCHY.presence).toEqual(['directory_presence']);
    });

    it('does NOT inherit google_only', () => {
      expect(TIER_HIERARCHY.presence).not.toContain('google_only');
    });

    it('does NOT inherit starter', () => {
      expect(TIER_HIERARCHY.presence).not.toContain('starter');
    });
  });

  describe('presence tier display and pricing', () => {
    it('has display name "Starter"', () => {
      expect(TIER_DISPLAY_NAMES.presence).toBe('Starter');
    });

    it('is priced at $19/month', () => {
      expect(TIER_PRICING.presence).toBe(19);
    });
  });

  describe('legacy starter remains separate and inactive', () => {
    it('starter still exists in TIER_FEATURES (dormant, not removed)', () => {
      expect(TIER_FEATURES).toHaveProperty('starter');
    });

    it('starter has the legacy feature bag (storefront, clover, etc.)', () => {
      const features = TIER_FEATURES.starter as readonly string[];
      // These are the dormant legacy features that would be wrong for presence
      expect(features).toContain('storefront');
      expect(features).toContain('clover_pos');
      expect(features).toContain('enhanced_seo');
    });

    it('starter inherits google_only (legacy — presence does NOT)', () => {
      expect(TIER_HIERARCHY.starter).toContain('google_only');
      // Contrast: presence must NOT inherit google_only
      expect(TIER_HIERARCHY.presence).not.toContain('google_only');
    });

    it('starter display name is still "Starter" (same display, different key)', () => {
      expect(TIER_DISPLAY_NAMES.starter).toBe('Starter');
    });
  });

  describe('google_only remains inactive maintenance', () => {
    it('google_only exists in TIER_FEATURES', () => {
      expect(TIER_FEATURES).toHaveProperty('google_only');
    });

    it('google_only has Google features but not storefront', () => {
      const features = TIER_FEATURES.google_only as readonly string[];
      expect(features).toContain('google_shopping');
      // google_only is maintenance mode — no storefront
      expect(features).not.toContain('storefront');
    });
  });

  describe('directory_presence gateway', () => {
    it('has empty inheritance (root of hierarchy)', () => {
      expect(TIER_HIERARCHY.directory_presence).toEqual([]);
    });

    it('is priced at $0 (free gateway)', () => {
      expect(TIER_PRICING.directory_presence).toBe(0);
    });

    it('does NOT have logo/about/gallery enrichment (those are presence+)', () => {
      const features = TIER_FEATURES.directory_presence as readonly string[];
      expect(features).not.toContain('directory_entry_logo_on');
      expect(features).not.toContain('directory_entry_about_on');
      expect(features).not.toContain('directory_entry_gallery_on');
      expect(features).not.toContain('directory_entry_layout_editorial');
      expect(features).not.toContain('directory_entry_layout_immersive');
    });
  });
});
