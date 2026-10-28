/**
 * Profile readiness scoring — the percentage on the Business Profile card.
 *
 * Regression: the score only looked at NAP + website/contact/social, so a
 * tenant with no logo could still read "SEO Ready 90%". The logo is now a trust
 * tier field (worth 6.25 of the 25 points) and `isSEOReady` gates on every
 * required + trust field.
 */
import { describe, it, expect } from 'vitest';
import {
  BusinessProfile,
  calculateSEOReadiness,
  getMissingProfileFields,
  isSEOReady,
} from './businessProfile';

const completeProfile: BusinessProfile = {
  business_name: 'VisibleShelf',
  address_line1: '123 Main Street',
  city: 'Plainfield',
  state: 'IN',
  postal_code: '46168',
  country_code: 'US',
  phone_number: '+13175550100',
  email: 'contact@visibleshelf.com',
  website: 'https://visibleshelf.com',
  logo_url: 'https://cdn.example.com/logo.png',
  business_description: 'The local visibility platform for independent retailers.',
  contact_person: 'Paul',
  social_links: { facebook: 'https://facebook.com/shelfvisible' },
  hours: { monday: '9:00 AM - 5:00 PM' },
  seo_tags: ['grocery'],
  latitude: 39.6886583,
  longitude: -86.3883506,
};

describe('calculateSEOReadiness', () => {
  it('scores a fully-populated profile 100', () => {
    expect(calculateSEOReadiness(completeProfile)).toBe(100);
  });

  it('drops the score when the logo is missing', () => {
    const { logo_url, ...withoutLogo } = completeProfile;
    expect(calculateSEOReadiness(withoutLogo)).toBe(94);
  });

  it('scores exactly 85 with every required + trust field and no enrichment', () => {
    const { contact_person, social_links, hours, seo_tags, ...core } = completeProfile;
    expect(calculateSEOReadiness(core)).toBe(85);
  });

  it('treats empty strings and empty objects as missing', () => {
    const blanks = {
      ...completeProfile,
      logo_url: '   ',
      social_links: {},
      hours: {},
      seo_tags: [],
    };
    // 60 required + 18.75 trust (logo gone) + 3.75 enrichment (contact_person only)
    expect(calculateSEOReadiness(blanks)).toBe(83);
    expect(isSEOReady(blanks)).toBe(false);
  });

  it('counts a 0 coordinate as a present map pin', () => {
    const { latitude, longitude, ...withoutPin } = completeProfile;
    const equator = calculateSEOReadiness({ ...withoutPin, latitude: 0, longitude: 0 });
    expect(equator).toBe(calculateSEOReadiness(completeProfile));
  });
});

describe('isSEOReady', () => {
  it('is ready when every required + trust field is present', () => {
    expect(isSEOReady(completeProfile)).toBe(true);
  });

  it('is not ready without a logo, even though the score stays high', () => {
    const { logo_url, ...withoutLogo } = completeProfile;
    expect(calculateSEOReadiness(withoutLogo)).toBeGreaterThanOrEqual(85);
    expect(isSEOReady(withoutLogo)).toBe(false);
  });

  it('is not ready when a required NAP field is missing', () => {
    const { email, ...withoutEmail } = completeProfile;
    expect(isSEOReady(withoutEmail)).toBe(false);
    expect(getMissingProfileFields(withoutEmail)).toContain('Email');
  });

  it('stays ready when only enrichment fields are missing', () => {
    const { contact_person, social_links, hours, seo_tags, ...core } = completeProfile;
    expect(isSEOReady(core)).toBe(true);
  });
});

describe('getMissingProfileFields', () => {
  it('names the logo instead of a generic "complete all fields" hint', () => {
    const { logo_url, website, ...rest } = completeProfile;
    expect(getMissingProfileFields(rest)).toEqual(['Logo', 'Website']);
  });

  it('is empty for a complete profile', () => {
    expect(getMissingProfileFields(completeProfile)).toEqual([]);
  });
});
