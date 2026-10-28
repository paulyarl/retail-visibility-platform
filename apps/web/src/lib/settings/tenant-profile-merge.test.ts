/**
 * Settings-card profile merge.
 *
 * Regression: the merge listed fields by hand and omitted `hours` / `seo_tags`,
 * so a tenant with business hours on file still lost those readiness points on
 * the card (the visible percentage disagreed with the stored profile). The
 * readiness score must survive the merge untouched.
 */
import { describe, it, expect } from 'vitest';
import { BusinessProfile, calculateSEOReadiness } from '@/lib/validation/businessProfile';
import { mergeTenantProfile } from './tenant-profile-merge';

const storedProfile: BusinessProfile = {
  business_name: 'VisibleShelf',
  address_line1: 'Service-area business',
  city: 'Plainfield',
  state: 'IN',
  postal_code: '46168',
  country_code: 'US',
  phone_number: '+13175550100',
  email: 'contact@visibleshelf.com',
  website: 'https://visibleshelf.com',
  logo_url: 'https://cdn.example.com/logo.png',
  business_description: 'The local visibility platform for independent retailers.',
  social_links: { facebook: 'https://facebook.com/shelfvisible' },
  hours: { monday: '9:00 AM - 5:00 PM', timezone: 'America/New_York' },
  seo_tags: ['grocery'],
  latitude: 39.6886583,
  longitude: -86.3883506,
  slug: 'visibleshelf',
};

describe('mergeTenantProfile', () => {
  it('carries hours and seo_tags through', () => {
    const merged = mergeTenantProfile(storedProfile, {});

    expect(merged.hours).toEqual(storedProfile.hours);
    expect(merged.seo_tags).toEqual(storedProfile.seo_tags);
  });

  it('does not change the readiness score', () => {
    const merged = mergeTenantProfile(storedProfile, {});

    expect(calculateSEOReadiness(merged)).toBe(calculateSEOReadiness(storedProfile));
    // 60 required + 25 trust + 11.25 enrichment (3 of 4: contact person absent)
    expect(calculateSEOReadiness(merged)).toBe(96);
  });

  it('prefers the saved profile over onboarding progress', () => {
    const merged = mergeTenantProfile(storedProfile, {
      business_name: 'Old Name',
      logo_url: '',
      hours: { tuesday: '10:00 AM - 2:00 PM' },
    });

    expect(merged.business_name).toBe('VisibleShelf');
    expect(merged.hours).toEqual(storedProfile.hours);
  });

  it('falls back to onboarding when the profile is missing', () => {
    const merged = mergeTenantProfile(null, { business_name: 'Draft Store', hours: { monday: '9-5' } });

    expect(merged.business_name).toBe('Draft Store');
    expect(merged.hours).toEqual({ monday: '9-5' });
    expect(merged.country_code).toBe('US');
  });

  it('keeps a 0 coordinate instead of treating it as missing', () => {
    const merged = mergeTenantProfile({ ...storedProfile, latitude: 0, longitude: 0 }, {});

    expect(merged.latitude).toBe(0);
    expect(merged.longitude).toBe(0);
  });
});
