/**
 * isGbpManagementFeatureAllowed — the `gbp_management` capability gate.
 *
 * Pins the hard-gate contract for the Advanced GBP Features surface: each
 * feature reads its own resolver field, the flexible key unlocks everything,
 * and an absent/failed capability state denies (no fail-open).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockResolve } = vi.hoisted(() => ({ mockResolve: vi.fn() }));

vi.mock('../../../services/EffectiveCapabilityResolver', () => ({
  resolveEffectiveCapabilities: mockResolve,
}));

import {
  isGbpManagementFeatureAllowed,
  isStorefrontTypeGoogleEligible,
  evaluateGMCSyncGate,
  isGMCSyncAllowed,
  gmcSyncGateError,
} from '../capability-gate';

const withGbp = (gbp: Record<string, unknown>) => ({
  effective: { gbp_management: gbp },
});

beforeEach(() => {
  mockResolve.mockReset();
});

describe('isGbpManagementFeatureAllowed', () => {
  it('reads each feature from its resolver field', async () => {
    mockResolve.mockResolvedValue(
      withGbp({
        can_use_ai_response: true,
        can_use_posts_scheduler: false,
        can_use_media_upload: true,
        can_use_attributes: false,
      })
    );

    await expect(isGbpManagementFeatureAllowed('tid-1', 'ai_response')).resolves.toBe(true);
    await expect(isGbpManagementFeatureAllowed('tid-1', 'posts_scheduler')).resolves.toBe(false);
    await expect(isGbpManagementFeatureAllowed('tid-1', 'media_upload')).resolves.toBe(true);
    await expect(isGbpManagementFeatureAllowed('tid-1', 'attributes')).resolves.toBe(false);
  });

  it('the flexible key unlocks every feature', async () => {
    mockResolve.mockResolvedValue(
      withGbp({
        is_flexible: true,
        can_use_ai_response: true,
        can_use_posts_scheduler: true,
        can_use_media_upload: true,
        can_use_attributes: true,
      })
    );

    for (const feature of ['ai_response', 'posts_scheduler', 'media_upload', 'attributes'] as const) {
      await expect(isGbpManagementFeatureAllowed('tid-1', feature)).resolves.toBe(true);
    }
  });

  it('denies when the capability state is missing', async () => {
    mockResolve.mockResolvedValue({ effective: {} });
    await expect(isGbpManagementFeatureAllowed('tid-1', 'attributes')).resolves.toBe(false);
  });

  it('denies (no fail-open) when capability resolution throws', async () => {
    mockResolve.mockRejectedValue(new Error('resolver down'));
    await expect(isGbpManagementFeatureAllowed('tid-1', 'media_upload')).resolves.toBe(false);
  });
});

describe('isStorefrontTypeGoogleEligible', () => {
  it('accepts the physical types outright', () => {
    expect(isStorefrontTypeGoogleEligible('retail')).toBe(true);
    expect(isStorefrontTypeGoogleEligible('service')).toBe(true);
  });

  it('accepts flexible when the tier allows a physical type', () => {
    expect(isStorefrontTypeGoogleEligible('flexible', ['online', 'service', 'social'])).toBe(true);
    expect(isStorefrontTypeGoogleEligible('flexible', ['retail'])).toBe(true);
  });

  it('rejects flexible when no physical type is allowed', () => {
    expect(isStorefrontTypeGoogleEligible('flexible', ['online', 'social'])).toBe(false);
    expect(isStorefrontTypeGoogleEligible('flexible')).toBe(false);
  });

  it('rejects online, social and none', () => {
    expect(isStorefrontTypeGoogleEligible('online')).toBe(false);
    expect(isStorefrontTypeGoogleEligible('social')).toBe(false);
    expect(isStorefrontTypeGoogleEligible('none')).toBe(false);
  });
});

const gmcCaps = ({
  storefront = { enabled: true, effective_type: 'retail', allowed_types: ['retail'] },
  product_types = { enabled: true, effective_types: ['physical'] },
  integrations = { enabled: true, effective_google_types: ['google_merchant_center'] },
}: {
  storefront?: Record<string, unknown>;
  product_types?: Record<string, unknown>;
  integrations?: Record<string, unknown>;
} = {}) => ({ effective: { storefront, product_types, integrations } });

describe('evaluateGMCSyncGate', () => {
  it('allows a physical storefront with physical products on a GMC plan', async () => {
    mockResolve.mockResolvedValue(gmcCaps());
    await expect(evaluateGMCSyncGate('tid-1')).resolves.toEqual({ allowed: true, reason: 'ok' });
  });

  it('allows a flexible storefront when the tier permits a physical type', async () => {
    mockResolve.mockResolvedValue(
      gmcCaps({ storefront: { enabled: true, effective_type: 'flexible', allowed_types: ['online', 'service', 'social'] } })
    );
    await expect(evaluateGMCSyncGate('tid-1')).resolves.toEqual({ allowed: true, reason: 'ok' });
  });

  it('asks for a storefront type when a physical one is still selectable', async () => {
    mockResolve.mockResolvedValue(
      gmcCaps({ storefront: { enabled: true, effective_type: 'online', allowed_types: ['online', 'service'] } })
    );
    await expect(evaluateGMCSyncGate('tid-1')).resolves.toEqual({
      allowed: false,
      reason: 'storefront_type_required',
    });
  });

  it('reports an ineligible storefront when no physical type is allowed', async () => {
    mockResolve.mockResolvedValue(
      gmcCaps({ storefront: { enabled: true, effective_type: 'flexible', allowed_types: ['online', 'social'] } })
    );
    await expect(evaluateGMCSyncGate('tid-1')).resolves.toEqual({
      allowed: false,
      reason: 'storefront_type_ineligible',
    });
  });

  it('reports a disabled storefront', async () => {
    mockResolve.mockResolvedValue(gmcCaps({ storefront: { enabled: false } }));
    await expect(evaluateGMCSyncGate('tid-1')).resolves.toEqual({
      allowed: false,
      reason: 'storefront_disabled',
    });
  });

  it('reports digital-only product types', async () => {
    mockResolve.mockResolvedValue(
      gmcCaps({ product_types: { enabled: true, effective_types: ['digital'] } })
    );
    await expect(evaluateGMCSyncGate('tid-1')).resolves.toEqual({
      allowed: false,
      reason: 'product_types_ineligible',
    });
  });

  it('reports product types disabled', async () => {
    mockResolve.mockResolvedValue(gmcCaps({ product_types: { enabled: false } }));
    await expect(evaluateGMCSyncGate('tid-1')).resolves.toEqual({
      allowed: false,
      reason: 'product_types_disabled',
    });
  });

  it('reports GMC missing from the plan', async () => {
    mockResolve.mockResolvedValue(
      gmcCaps({ integrations: { enabled: true, effective_google_types: ['gbp'] } })
    );
    await expect(evaluateGMCSyncGate('tid-1')).resolves.toEqual({
      allowed: false,
      reason: 'integration_not_in_plan',
    });
  });

  it('reports integrations disabled', async () => {
    mockResolve.mockResolvedValue(
      gmcCaps({ integrations: { enabled: false, effective_google_types: ['gmc_sync'] } })
    );
    await expect(evaluateGMCSyncGate('tid-1')).resolves.toEqual({
      allowed: false,
      reason: 'integration_disabled',
    });
  });

  it('reports missing capabilities', async () => {
    mockResolve.mockResolvedValue(null);
    await expect(evaluateGMCSyncGate('tid-1')).resolves.toEqual({
      allowed: false,
      reason: 'no_capabilities',
    });
  });

  it('reports resolver failure without throwing (no fail-open)', async () => {
    mockResolve.mockRejectedValue(new Error('resolver down'));
    await expect(evaluateGMCSyncGate('tid-1')).resolves.toEqual({ allowed: false, reason: 'error' });
    await expect(isGMCSyncAllowed('tid-1')).resolves.toBe(false);
  });
});

describe('gmcSyncGateError', () => {
  it('sends a fixable storefront gap to the storefront-type settings, not an upgrade', () => {
    const err = gmcSyncGateError('storefront_type_required', 'tid-1');
    expect(err.status).toBe(409);
    expect(err.error).toBe('storefront_type_required');
    expect(err.actionUrl).toBe('/t/tid-1/settings/storefront-type-options');
    expect(err.message).not.toMatch(/upgrade/i);
  });

  it('sends a product-type gap to the product-types settings, not an upgrade', () => {
    const err = gmcSyncGateError('product_types_ineligible', 'tid-1');
    expect(err.status).toBe(409);
    expect(err.error).toBe('product_types_ineligible');
    expect(err.actionUrl).toBe('/t/tid-1/settings/product-types');
    expect(err.message).not.toMatch(/upgrade/i);
  });

  it('keeps the upgrade wording for genuine plan limits', () => {
    expect(gmcSyncGateError('integration_not_in_plan', 'tid-1').error).toBe('tier_restricted');
    expect(gmcSyncGateError('storefront_type_ineligible', 'tid-1').error).toBe('tier_restricted');
  });

  it('reports an unverifiable gate as a transient failure', () => {
    expect(gmcSyncGateError('error', 'tid-1').status).toBe(503);
    expect(gmcSyncGateError('no_capabilities', 'tid-1').error).toBe('capability_unavailable');
  });
});
