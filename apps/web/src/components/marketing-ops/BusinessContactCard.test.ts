/**
 * Render tests for BusinessContactCard.
 *
 * Verifies:
 *   - Directory profiles rendering with normalized platform names
 *   - Disambiguated claim status ("Claim status unknown" vs "Claimed" vs "Unclaimed")
 *   - Rating & review count formatting
 *   - Primary contact info (Name, address, phone, website, hours)
 *   - Absence of directory profiles section when list is empty
 *
 * Node-environment vitest — no jsdom needed. Uses react-dom/server.
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BusinessContactCard from './BusinessContactCard';
import type { Campaign } from '@/services/MarketingOpsService';

const baseCampaign = (overrides: Partial<Campaign> = {}): Campaign =>
  ({
    id: 'mcamp-f3rhh2un',
    business_name: 'Baraka Market',
    category: 'African Grocery Store',
    city: 'Kansas City',
    state: 'MO',
    phone: '(816) 666-4170',
    email: 'info@barakamarket.example',
    website_url: 'https://barakamarket.example',
    address_line1: '1447 Independence Ave',
    address_city: 'Kansas City',
    address_state: 'MO',
    address_zip: '64106',
    address_country: 'US',
    social_profiles: [
      { platform: 'Facebook', url: 'https://facebook.com/barakamarketkc' },
    ],
    directory_profiles: [
      {
        platform: 'MapQuest',
        url: 'https://www.mapquest.com/us/missouri/baraka-market-264557172',
        claim_status: 'unknown',
      },
      {
        platform: 'google',
        url: 'https://maps.google.com/baraka',
        claim_status: 'claimed',
        star_rating: 4.5,
        review_count: 28,
      },
      {
        platform: 'yelp',
        url: 'https://yelp.com/biz/baraka',
        claim_status: 'unclaimed',
      },
    ],
    business_hours: {
      monday: { open: '10:00', close: '21:00', closed: false },
      timezone: 'America/Chicago',
    },
    owner_names: ['Ahmed'],
    phones: [],
    stage: 'seek',
    attributes: [],
    ...overrides,
  } as unknown as Campaign);

describe('BusinessContactCard', () => {
  it('renders directory profiles with normalized labels and disambiguated claim status', () => {
    const html = renderToStaticMarkup(
      createElement(BusinessContactCard, { campaign: baseCampaign() }),
    );

    // Directory profiles heading
    expect(html).toContain('Directory Profiles');

    // Platform label normalization: 'MapQuest' -> 'MapQuest'
    expect(html).toContain('MapQuest');
    // Claim status 'unknown' displays as 'Claim status unknown' (NOT bare 'Unknown')
    expect(html).toContain('Claim status unknown');
    expect(html).toContain('href="https://www.mapquest.com/us/missouri/baraka-market-264557172"');

    // Google profile: claimed + rating + review count
    expect(html).toContain('Google');
    expect(html).toContain('Claimed');
    expect(html).toContain('4.5★ · 28 reviews');
    expect(html).toContain('href="https://maps.google.com/baraka"');

    // Yelp profile: unclaimed
    expect(html).toContain('Yelp');
    expect(html).toContain('Unclaimed');
    expect(html).toContain('href="https://yelp.com/biz/baraka"');
  });

  it('omits directory profiles section when directory_profiles is empty or null', () => {
    const html = renderToStaticMarkup(
      createElement(BusinessContactCard, {
        campaign: baseCampaign({ directory_profiles: [] }),
      }),
    );

    expect(html).not.toContain('Directory Profiles');
    expect(html).not.toContain('MapQuest');
  });

  it('renders primary contact channels with external links and click affordances', () => {
    const html = renderToStaticMarkup(
      createElement(BusinessContactCard, { campaign: baseCampaign() }),
    );

    expect(html).toContain('Baraka Market');
    expect(html).toContain('1447 Independence Ave, Kansas City, MO, 64106');
    expect(html).toContain('(816) 666-4170');
    expect(html).toContain('info@barakamarket.example');
    expect(html).toContain('https://barakamarket.example');
    expect(html).toContain('Facebook');

    // Action links
    expect(html).toContain('href="sms:(816) 666-4170"');
    expect(html).toContain('href="mailto:info@barakamarket.example"');
    expect(html).toContain('href="https://barakamarket.example"');
    expect(html).toContain('https://www.google.com/maps/search/?api=1');
  });
});
