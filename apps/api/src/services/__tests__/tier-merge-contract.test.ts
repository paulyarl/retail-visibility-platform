/**
 * Tier contract — Phase 3.1–3.5: the merged-map semantics.
 *
 * `EffectiveCapabilityResolver.fetchRawCapabilities` used to embed the merge
 * inside prisma-bound code that no test could reach. It is now pure —
 * `mergeCapabilitySources` — and these are the money rules it must obey
 * (D4/D7):
 *
 *   3.1  `_disabled` vetoes SURVIVE the merge alongside purchases — the veto
 *        key is delivered to the resolvers; a purchase must not erase it
 *        (veto application is resolver-side, pinned by CapabilityResolversOnOff)
 *   3.2  `_disabled` never counts as engagement — a module carrying ONLY a
 *        `_disabled` key contributes no ordinary feature grants
 *   3.3  `*_flexible` expands to EVERY linked feature in the capability type —
 *        and emits no negative keys (the 090/332 phantom-veto history)
 *   3.4  a single non-gate feature key lands in its capability bucket
 *        (implicit engagement); uncategorized keys land in
 *        `uncategorizedFeatures`
 *   3.5  `granted=false` overrides are IGNORED — not a deny
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md, Phase 3.
 */
import { describe, it, expect } from 'vitest';
import { mergeCapabilitySources, capabilitySaleAllowed } from '../effectiveCapabilityMerge';

const cap = (key: string) => ({ key, name: key, category: 'test' });
const tf = (
  feature_key: string,
  capKey = 'storefront',
  extra: Partial<{ is_enabled: boolean; is_highlighted: boolean }> = {},
) => ({
  feature_key,
  is_enabled: true,
  is_highlighted: false,
  capability_type_list: cap(capKey),
  ...extra,
});
const base = () => ({
  tierFeatures: [] as ReturnType<typeof tf>[],
  purchases: [] as Array<{ feature_key: string }>,
  purchaseCapTypeByFeature: new Map<string, any>(),
  purchaseFlexibleExpansion: new Map<string, string[]>(),
  overrides: [] as Array<{ feature: string; granted: boolean }>,
  overrideCapTypeByFeature: new Map<string, any>(),
  overrideFlexibleExpansion: new Map<string, string[]>(),
});

describe('merge contract — 3.1/3.2: _disabled veto rows survive and never grant', () => {
  it('a tier _disabled row is carried to the resolvers even when a feature is purchased', () => {
    const out = mergeCapabilitySources({
      ...base(),
      tierFeatures: [tf('storefront_disabled')],
      purchases: [{ feature_key: 'storefront_retail' }],
      purchaseCapTypeByFeature: new Map([['storefront_retail', cap('storefront')]]),
    });
    // The veto key arrives enabled=true — "the veto key is present" is what the
    // resolver reads; purchase adds its feature WITHOUT touching the veto row.
    expect(out.mergedFeatures.get('storefront_disabled')?.is_enabled).toBe(true);
    expect(out.mergedFeatures.get('storefront_retail')?.is_enabled).toBe(true);
    expect(out.capabilities.storefront.features).toEqual({
      storefront_disabled: true,
      storefront_retail: true,
    });
  });

  it('a module whose only row is _disabled contributes no ordinary feature grant', () => {
    const out = mergeCapabilitySources({ ...base(), tierFeatures: [tf('storefront_disabled')] });
    // Only the veto key exists — the resolver's "any other active key implies
    // engagement" rule sees no ordinary key. The merge must not fabricate one.
    expect(Object.keys(out.capabilities.storefront.features)).toEqual(['storefront_disabled']);
  });
});

describe('merge contract — 3.3: _flexible expands to the whole module', () => {
  const flexibleInput = (source: 'purchase' | 'override') => ({
    ...base(),
    purchases: source === 'purchase' ? [{ feature_key: 'storefront_flexible' }] : [],
    overrides: source === 'override' ? [{ feature: 'storefront_flexible', granted: true }] : [],
    purchaseCapTypeByFeature:
      source === 'purchase' ? new Map([['storefront_flexible', cap('storefront')]]) : new Map(),
    overrideCapTypeByFeature:
      source === 'override' ? new Map([['storefront_flexible', cap('storefront')]]) : new Map(),
    purchaseFlexibleExpansion: new Map([
      // Deliberately includes the negative keys the DB link table returns —
      // the merge must drop them (the MV does it in SQL; 332 BUG-2).
      ['storefront', ['storefront_retail', 'storefront_gallery', 'storefront_hours', 'storefront_disabled', 'storefront_gallery_off']],
    ]),
    overrideFlexibleExpansion: new Map([
      ['storefront', ['storefront_retail', 'storefront_gallery', 'storefront_hours', 'storefront_disabled', 'storefront_gallery_off']],
    ]),
  });

  it.each(['purchase', 'override'] as const)('%s _flexible grants every linked feature', (source) => {
    const out = mergeCapabilitySources(flexibleInput(source));
    for (const key of ['storefront_retail', 'storefront_gallery', 'storefront_hours']) {
      expect(out.mergedFeatures.get(key)?.is_enabled, key).toBe(true);
    }
  });

  it('flexible expansion emits NO negative keys (the 090/332 phantom-veto rule)', () => {
    for (const out of [mergeCapabilitySources(flexibleInput('purchase')), mergeCapabilitySources(flexibleInput('override'))]) {
      for (const key of out.mergedFeatures.keys()) {
        expect(key.endsWith('_disabled') || key.endsWith('_off'), `expansion emitted veto key ${key}`).toBe(false);
      }
    }
  });
});

describe('merge contract — 3.4: implicit engagement and grouping', () => {
  it('a lone feature key lands in its capability bucket', () => {
    const out = mergeCapabilitySources({ ...base(), tierFeatures: [tf('storefront_retail')] });
    expect(out.capabilities.storefront.features).toEqual({ storefront_retail: true });
  });

  it('a feature with no capability type lands in uncategorized_features', () => {
    const out = mergeCapabilitySources({
      ...base(),
      tierFeatures: [{ feature_key: 'loose_feature', is_enabled: true, is_highlighted: false, capability_type_list: null }],
    });
    expect(out.uncategorizedFeatures).toEqual(['loose_feature']);
    expect(Object.keys(out.capabilities)).toEqual([]);
  });
});

describe('merge contract — 3.5: granted=false is ignored, not a deny', () => {
  it('a granted=false override contributes nothing', () => {
    const out = mergeCapabilitySources({
      ...base(),
      overrides: [{ feature: 'storefront_retail', granted: false }],
      overrideCapTypeByFeature: new Map([['storefront_retail', cap('storefront')]]),
    });
    expect(out.mergedFeatures.has('storefront_retail')).toBe(false);
    expect(Object.keys(out.capabilities)).toEqual([]);
  });

  it('a granted=false override does NOT veto a tier-granted feature', () => {
    const out = mergeCapabilitySources({
      ...base(),
      tierFeatures: [tf('storefront_retail')],
      overrides: [{ feature: 'storefront_retail', granted: false }],
    });
    expect(out.mergedFeatures.get('storefront_retail')?.is_enabled).toBe(true);
  });

  it('a granted=true override force-enables an absent feature', () => {
    const out = mergeCapabilitySources({
      ...base(),
      overrides: [{ feature: 'storefront_retail', granted: true }],
      overrideCapTypeByFeature: new Map([['storefront_retail', cap('storefront')]]),
    });
    expect(out.mergedFeatures.get('storefront_retail')?.is_enabled).toBe(true);
  });
});

describe('merge contract — 3.1 consequence: store sale eligibility (D7)', () => {
  it('a tier-vetoed capability is unsellable even alongside positive keys', () => {
    // The veto is absolute — a purchase can't revive the module, so the
    // store must refuse the sale. Regression pin: the old check only refused
    // when EVERY enabled key was `*_disabled`.
    expect(capabilitySaleAllowed('storefront', ['storefront_disabled', 'storefront_retail'])).toBe(false);
  });

  it('a capability whose only keys are *_disabled is unsellable (no positive engagement)', () => {
    expect(capabilitySaleAllowed('storefront', ['storefront_disabled', 'storefront_gallery_off'])).toBe(false);
  });

  it('an engaged capability is sellable', () => {
    expect(capabilitySaleAllowed('storefront', ['storefront_retail'])).toBe(true);
    expect(capabilitySaleAllowed('storefront', ['storefront_enabled'])).toBe(true);
  });
});
