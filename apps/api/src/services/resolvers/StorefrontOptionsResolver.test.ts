import { describe, it, expect } from 'vitest';
import { resolveStorefrontOptions } from './StorefrontOptionsResolver';

// Capability contract matrix:
//   `_disabled`  → explicit veto of the ENTIRE module (wins over every other key)
//   `_flexible`  → explicit module activation + all supported feature keys
//   `_enabled`   → explicit module activation (grants no features alone)
//   any other active storefront_opt_* key → implicit `_enabled` for the module
// (Addressing entitlements live in the separate `storefront_domains` module —
// see StorefrontDomainsResolver.test.ts.)
describe('resolveStorefrontOptions — capability contract', () => {
  it('no module keys → module off', () => {
    const r = resolveStorefrontOptions({}, null);
    expect(r.enabled).toBe(false);
    expect(r.category_enabled).toBe(false);
  });

  it('`_disabled` alone → module off', () => {
    const r = resolveStorefrontOptions({ storefront_opt_disabled: true }, null);
    expect(r.enabled).toBe(false);
  });

  it('`_disabled` + feature key → still off (absolute veto)', () => {
    const r = resolveStorefrontOptions(
      { storefront_opt_disabled: true, storefront_opt_category_store: true },
      null
    );
    expect(r.enabled).toBe(false);
    expect(r.category_enabled).toBe(false);
  });

  it('`_disabled` + `_enabled` + `_flexible` + keys → still off', () => {
    const r = resolveStorefrontOptions(
      {
        storefront_opt_disabled: true,
        storefront_opt_enabled: true,
        storefront_opt_flexible: true,
        storefront_opt_category_store: true,
      },
      null
    );
    expect(r.enabled).toBe(false);
    expect(r.is_flexible).toBe(true); // flexible flag is reported, not suppressed
    expect(r.category_enabled).toBe(false);
  });

  it('`_enabled` alone → module on, no features granted', () => {
    const r = resolveStorefrontOptions({ storefront_opt_enabled: true }, null);
    expect(r.enabled).toBe(true);
    expect(r.category_enabled).toBe(false);
    expect(r.recommend_enabled).toBe(false);
  });

  it('`_enabled` + desired key → module on, key granted', () => {
    const r = resolveStorefrontOptions(
      {
        storefront_opt_enabled: true,
        storefront_opt_category_store: true,
      },
      null
    );
    expect(r.enabled).toBe(true);
    expect(r.category_enabled).toBe(true);
    expect(r.can_use_category_store).toBe(true);
    expect(r.allowed_category_types).toEqual(['category_store']);
    expect(r.allowed_category_types).not.toContain('category_product');
  });

  it('lone feature key → implicit `_enabled`, key granted', () => {
    const r = resolveStorefrontOptions(
      { storefront_opt_category_store: true },
      null
    );
    expect(r.enabled).toBe(true);
    expect(r.category_enabled).toBe(true);
    expect(r.can_use_category_store).toBe(true);
    expect(r.allowed_category_types).toEqual(['category_store']);
  });

  it('`_flexible` alone → module on, all features granted', () => {
    const r = resolveStorefrontOptions({ storefront_opt_flexible: true }, null);
    expect(r.enabled).toBe(true);
    expect(r.is_flexible).toBe(true);
    expect(r.category_enabled).toBe(true);
    expect(r.recommend_enabled).toBe(true);
    expect(r.info_enabled).toBe(true);
    expect(r.advanced_enabled).toBe(true);
  });

  it('enabled:false sentinel does not activate the module', () => {
    const r = resolveStorefrontOptions({ storefront_opt_enabled: false }, null);
    expect(r.enabled).toBe(false);
  });
});
