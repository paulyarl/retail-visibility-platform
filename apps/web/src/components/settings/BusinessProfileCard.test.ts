/**
 * Business Profile card — the readiness stat must notice the logo.
 *
 * The card used to score NAP + website/contact/social only, so a logo-less
 * tenant still read "SEO Ready"; nothing on the card said a logo was missing.
 * Rendered through Mantine's pre-compiled CSS modules (no jsdom needed) — see
 * AGENTS.md "Web component render tests".
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import BusinessProfileCard from './BusinessProfileCard';
import { BusinessProfile } from '@/lib/validation/businessProfile';

const baseProfile: BusinessProfile = {
  business_name: 'VisibleShelf',
  address_line1: '123 Main Street',
  city: 'Plainfield',
  state: 'IN',
  postal_code: '46168',
  country_code: 'US',
  phone_number: '+13175550100',
  email: 'contact@visibleshelf.com',
  website: 'https://visibleshelf.com',
  business_description: 'The local visibility platform for independent retailers.',
  contact_person: 'Paul',
  social_links: { facebook: 'https://facebook.com/shelfvisible' },
  hours: { monday: '9:00 AM - 5:00 PM' },
  seo_tags: ['grocery'],
  latitude: 39.6886583,
  longitude: -86.3506,
};

const render = (profile: BusinessProfile) =>
  renderToStaticMarkup(
    createElement(MantineProvider, null, createElement(BusinessProfileCard, { profile })),
  );

describe('BusinessProfileCard — logo awareness', () => {
  it('shows an empty-logo prompt and names the logo as missing', () => {
    const html = render(baseProfile);

    expect(html).toContain('No logo yet');
    expect(html).toContain('Missing: Logo');
    expect(html).not.toContain('SEO Ready');
  });

  it('renders the uploaded logo and drops it from the missing list', () => {
    const html = render({
      ...baseProfile,
      logo_url: 'https://cdn.example.com/tenants/tid-sud4ky1c/logo-1.png',
    });

    expect(html).toContain('https://cdn.example.com/tenants/tid-sud4ky1c/logo-1.png');
    expect(html).not.toContain('No logo yet');
    expect(html).not.toContain('Missing: Logo');
    expect(html).toContain('SEO Ready');
  });

  it('counts the logo in the score, not just the checklist', () => {
    const withoutLogo = render(baseProfile);
    const withLogo = render({ ...baseProfile, logo_url: 'https://cdn.example.com/logo.png' });

    expect(withoutLogo).toContain('94%');
    expect(withLogo).toContain('100%');
  });
});
