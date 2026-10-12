import { describe, it, expect } from 'vitest';
import { resolveStorefrontDomains } from './StorefrontDomainsResolver';

// Capability contract matrix for the `storefront_domains` entitlement module
// (module-responsibility split from storefront_options — R37):
//   `_disabled`  → explicit veto of the ENTIRE module (wins over every key)
//   `_flexible`  → explicit module activation + all addressing levels
//   `_enabled`   → explicit module activation (level-1 path baseline only)
//   any other active storefront_domains_* key → implicit `_enabled`
describe('resolveStorefrontDomains — capability contract', () => {
  it('no module keys → module off, no levels', () => {
    const r = resolveStorefrontDomains({});
    expect(r.enabled).toBe(false);
    expect(r.allowed_levels).toEqual([]);
    expect(r.platform_subdomain_enabled).toBe(false);
    expect(r.custom_domain_enabled).toBe(false);
  });

  it('`_disabled` alone → module off', () => {
    const r = resolveStorefrontDomains({ storefront_domains_disabled: true });
    expect(r.enabled).toBe(false);
    expect(r.allowed_levels).toEqual([]);
  });

  it('`_disabled` + feature key → still off (absolute veto)', () => {
    const r = resolveStorefrontDomains({
      storefront_domains_disabled: true,
      storefront_domains_platform_subdomain: true,
    });
    expect(r.enabled).toBe(false);
    expect(r.platform_subdomain_enabled).toBe(false);
  });

  it('`_disabled` + `_enabled` + `_flexible` + keys → still off', () => {
    const r = resolveStorefrontDomains({
      storefront_domains_disabled: true,
      storefront_domains_enabled: true,
      storefront_domains_flexible: true,
      storefront_domains_platform_subdomain: true,
      storefront_domains_custom_domain: true,
    });
    expect(r.enabled).toBe(false);
    expect(r.is_flexible).toBe(true); // reported, not suppressed
    expect(r.allowed_levels).toEqual([]);
  });

  it('`_enabled` alone → module on, path baseline only', () => {
    const r = resolveStorefrontDomains({ storefront_domains_enabled: true });
    expect(r.enabled).toBe(true);
    expect(r.allowed_levels).toEqual(['path']);
    expect(r.platform_subdomain_enabled).toBe(false);
    expect(r.custom_domain_enabled).toBe(false);
  });

  it('`_enabled` + level key → level granted (Discovery shape)', () => {
    const r = resolveStorefrontDomains({
      storefront_domains_enabled: true,
      storefront_domains_platform_subdomain: true,
    });
    expect(r.enabled).toBe(true);
    expect(r.allowed_levels).toEqual(['path', 'platform_subdomain']);
    expect(r.custom_domain_enabled).toBe(false);
  });

  it('lone level key → implicit `_enabled`, level granted', () => {
    const r = resolveStorefrontDomains({ storefront_domains_custom_domain: true });
    expect(r.enabled).toBe(true);
    expect(r.custom_domain_enabled).toBe(true);
    expect(r.platform_subdomain_enabled).toBe(false);
    expect(r.allowed_levels).toEqual(['path', 'custom_domain']);
  });

  it('`_flexible` alone → module on, all levels granted', () => {
    const r = resolveStorefrontDomains({ storefront_domains_flexible: true });
    expect(r.enabled).toBe(true);
    expect(r.is_flexible).toBe(true);
    expect(r.allowed_levels).toEqual(['path', 'platform_subdomain', 'custom_domain']);
  });

  it('enabled:false sentinel does not activate the module', () => {
    const r = resolveStorefrontDomains({ storefront_domains_enabled: false });
    expect(r.enabled).toBe(false);
  });
});
