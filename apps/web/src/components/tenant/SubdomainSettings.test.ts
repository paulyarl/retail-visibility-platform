import { describe, it, expect } from 'vitest';
import { resolveSlugPickerContext } from './SubdomainSettings';

// Regression coverage for the subdomain picker showing another business's
// slugs: a repurposed/renamed tenant whose tenant_business_profiles_list row
// still describes a different business (tenant name "Ivoire African Market"
// vs profile business_name "ATOBABS AFRICA INTERNATIONAL MARKET") produced
// atobabs-* suggestions. The tenant record in page scope is authoritative.
describe('resolveSlugPickerContext', () => {
  it('uses the page-scope tenant name over a divergent profile business_name', () => {
    const ctx = resolveSlugPickerContext(
      { name: 'Ivoire African Market', city: 'Indianapolis', state: 'IN', countryCode: 'US' },
      { business_name: 'ATOBABS AFRICA INTERNATIONAL MARKET', city: 'East Pittsburgh', state: 'PA', country_code: 'US' },
    );
    expect(ctx.businessName).toBe('Ivoire African Market');
    expect(ctx.location).toEqual({ city: 'Indianapolis', state: 'IN', country: 'US' });
  });

  it('falls back to the profile business_name when the tenant name is blank', () => {
    const ctx = resolveSlugPickerContext(
      { name: '', city: null, state: null, countryCode: null },
      { business_name: 'Corner Store', city: 'Gary', state: 'IN', country_code: 'US' },
    );
    expect(ctx.businessName).toBe('Corner Store');
    expect(ctx.location).toEqual({ city: 'Gary', state: 'IN', country: 'US' });
  });

  it('returns an empty name when neither source provides one', () => {
    const ctx = resolveSlugPickerContext(null, null);
    expect(ctx.businessName).toBe('');
    expect(ctx.location).toEqual({ city: undefined, state: undefined, country: undefined });
  });
});
