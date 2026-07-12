import { describe, it, expect } from 'vitest';
import { resolveTargetIcon, buildPromoQRUrl, type FeatureLookup } from './bsaas-promotions';

describe('resolveTargetIcon', () => {
  it('returns null when targets is null', () => {
    expect(resolveTargetIcon(null)).toBeNull();
  });

  it('returns null when targets has no matching rules', () => {
    expect(resolveTargetIcon({ target_features: null, target_capability_types: null, target_tiers: null })).toBeNull();
  });

  it('returns null when all target arrays are empty', () => {
    expect(resolveTargetIcon({ target_features: [], target_capability_types: [], target_tiers: [] })).toBeNull();
  });

  it('resolves single feature target with feature lookup', () => {
    const featureData: FeatureLookup = {
      icon_name: 'IconRobot',
      marketing_name: 'AI Chatbot',
      name: 'chatbot_skill_crm_assistant',
    };
    const result = resolveTargetIcon(
      { target_features: ['chatbot_skill_crm_assistant'] },
      () => featureData,
    );
    expect(result).toEqual({
      type: 'feature',
      feature_key: 'chatbot_skill_crm_assistant',
      icon_name: 'IconRobot',
      marketing_name: 'AI Chatbot',
    });
  });

  it('falls back to feature name when marketing_name is null', () => {
    const result = resolveTargetIcon(
      { target_features: ['analytics_dashboard'] },
      () => ({ icon_name: 'IconChartBar', marketing_name: null, name: 'Analytics Dashboard' }),
    );
    expect(result?.marketing_name).toBe('Analytics Dashboard');
  });

  it('falls back to feature_key when both marketing_name and name are null', () => {
    const result = resolveTargetIcon(
      { target_features: ['custom_feature'] },
      () => ({ icon_name: null, marketing_name: null, name: null }),
    );
    expect(result?.marketing_name).toBe('custom_feature');
    expect(result?.icon_name).toBeNull();
  });

  it('returns null for single feature when featureLookup returns null', () => {
    const result = resolveTargetIcon(
      { target_features: ['unknown_feature'] },
      () => null,
    );
    expect(result).toBeNull();
  });

  it('returns null for single feature when no featureLookup provided', () => {
    const result = resolveTargetIcon({ target_features: ['some_feature'] });
    expect(result).toBeNull();
  });

  it('resolves multiple features as bundle', () => {
    const result = resolveTargetIcon({ target_features: ['feature_a', 'feature_b'] });
    expect(result).toEqual({
      type: 'bundle',
      feature_key: null,
      icon_name: 'IconPackage',
      marketing_name: 'Multiple Features',
    });
  });

  it('resolves capability type with mapped icon', () => {
    const result = resolveTargetIcon({ target_capability_types: ['chatbot'] });
    expect(result).toEqual({
      type: 'capability',
      feature_key: 'chatbot',
      icon_name: 'IconRobot',
      marketing_name: 'chatbot',
    });
  });

  it('resolves capability type with default icon for unknown type', () => {
    const result = resolveTargetIcon({ target_capability_types: ['unknown_cap'] });
    expect(result?.icon_name).toBe('IconCircle');
  });

  it('resolves tier with mapped icon', () => {
    const result = resolveTargetIcon({ target_tiers: ['enterprise'] });
    expect(result).toEqual({
      type: 'tier',
      feature_key: 'enterprise',
      icon_name: 'IconCrown',
      marketing_name: 'enterprise',
    });
  });

  it('resolves tier with default icon for unknown tier', () => {
    const result = resolveTargetIcon({ target_tiers: ['custom_tier'] });
    expect(result?.icon_name).toBe('IconTag');
  });

  it('prioritizes features over capability types when both present', () => {
    const result = resolveTargetIcon(
      { target_features: ['feature_a'], target_capability_types: ['chatbot'] },
      () => ({ icon_name: 'IconStar', marketing_name: 'Feature A', name: null }),
    );
    expect(result?.type).toBe('feature');
  });

  it('prioritizes capability types over tiers when both present (no features)', () => {
    const result = resolveTargetIcon({
      target_capability_types: ['analytics'],
      target_tiers: ['professional'],
    });
    expect(result?.type).toBe('capability');
  });
});

describe('buildPromoQRUrl', () => {
  it('constructs correct URL with simple promo code', () => {
    const url = buildPromoQRUrl('https://app.visibleshelf.com', 'SAVE20');
    expect(url).toBe('https://app.visibleshelf.com/settings/feature-store?promo=SAVE20');
  });

  it('encodes special characters in promo code', () => {
    const url = buildPromoQRUrl('https://app.visibleshelf.com', 'SAVE 20% OFF');
    expect(url).toBe('https://app.visibleshelf.com/settings/feature-store?promo=SAVE%2020%25%20OFF');
  });

  it('handles promo code with slashes', () => {
    const url = buildPromoQRUrl('https://example.com', 'A/B/C');
    expect(url).toBe('https://example.com/settings/feature-store?promo=A%2FB%2FC');
  });

  it('handles localhost domain', () => {
    const url = buildPromoQRUrl('http://localhost:3000', 'TESTCODE');
    expect(url).toBe('http://localhost:3000/settings/feature-store?promo=TESTCODE');
  });

  it('handles empty promo code', () => {
    const url = buildPromoQRUrl('https://app.visibleshelf.com', '');
    expect(url).toBe('https://app.visibleshelf.com/settings/feature-store?promo=');
  });
});
