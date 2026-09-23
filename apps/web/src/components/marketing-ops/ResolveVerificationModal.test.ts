/**
 * Render tests for ResolveVerificationModal.
 *
 * Verifies that the modal correctly initializes from entry.business_snapshot
 * across all tabs (NAP, Enrichment & Profiles, Call Notes), including:
 *   - directory_profiles and social_profiles prefill in Enrichment
 *   - email, owner contact, and website prefill
 *   - NAP prefill (name, phone, street, city, state, zip)
 *   - mode="campaign" vs mode="queue" UI affordances
 *
 * Node-environment vitest — no jsdom needed. Uses react-dom/server.
 */

import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ResolveVerificationModal, {
  snapshotWebsite,
  type VerificationEntryLike,
} from './ResolveVerificationModal';
import { verificationClearsCampaign } from '@/services/MarketingOpsService';

const noop = () => {};

describe('ResolveVerificationModal', () => {
  it('renders prefilled directory and social profiles in the enrichment tab', () => {
    const entry: VerificationEntryLike = {
      id: 'mcamp-f3rhh2un',
      business_name: 'Baraka Market',
      category: 'African Grocery Store',
      city: 'Kansas City',
      state: 'MO',
      business_snapshot: {
        email: 'info@barakamarket.example',
        social_profiles: [
          { platform: 'Facebook', url: 'https://facebook.com/barakamarketkc' },
        ],
        directory_profiles: [
          {
            platform: 'MapQuest',
            url: 'https://www.mapquest.com/us/missouri/baraka-market-264557172',
            claim_status: 'unknown',
          },
        ],
        verified_nap: {
          name: 'Baraka Market',
          phone: '(816) 666-4170',
          address: '1447 Independence Ave',
          city: 'Kansas City',
          state: 'MO',
          zip: '64106',
          website: 'https://barakamarket.example',
          category: 'African Grocery Store',
          owner_name: 'Ahmed',
          owner_phone: '(816) 555-0199',
          owner_email: 'ahmed@barakamarket.example',
        },
      },
    };

    const html = renderToStaticMarkup(
      createElement(ResolveVerificationModal, {
        entry,
        onClose: noop,
        onResolved: noop,
        mode: 'campaign',
        initialTab: 'enrichment',
      }),
    );

    // Header & campaign mode context
    expect(html).toContain('Verify record');
    expect(html).toContain('writes the campaign record');

    // Enrichment tab: website, email, category, owner name & contact
    expect(html).toContain('value="https://barakamarket.example"');
    expect(html).toContain('value="info@barakamarket.example"');
    expect(html).toContain('value="African Grocery Store"');
    expect(html).toContain('value="Ahmed"');
    expect(html).toContain('value="(816) 555-0199"');
    expect(html).toContain('value="ahmed@barakamarket.example"');

    // Social profile row prefilled
    expect(html).toContain('value="Facebook"');
    expect(html).toContain('value="https://facebook.com/barakamarketkc"');

    // Directory profile row prefilled (regression test for MapQuest disappearance)
    expect(html).toContain('value="MapQuest"');
    expect(html).toContain('value="https://www.mapquest.com/us/missouri/baraka-market-264557172"');

    // Add buttons are present
    expect(html).toContain('Add social profile');
    expect(html).toContain('Add directory profile');
  });

  it('renders clean add buttons when no directory or social profiles exist', () => {
    const entry: VerificationEntryLike = {
      id: 'mcamp-empty',
      business_name: 'New Shop',
      category: 'Retail',
      business_snapshot: {
        verified_nap: {
          name: 'New Shop',
          phone: '(816) 000-0000',
        },
      },
    };

    const html = renderToStaticMarkup(
      createElement(ResolveVerificationModal, {
        entry,
        onClose: noop,
        onResolved: noop,
        mode: 'campaign',
        initialTab: 'enrichment',
      }),
    );

    expect(html).toContain('Add social profile');
    expect(html).toContain('Add directory profile');
    // Does not render prefilled profile values
    expect(html).not.toContain('value="MapQuest"');
    expect(html).not.toContain('value="Facebook"');
  });

  it('renders prefilled verified NAP fields on the nap tab', () => {
    const entry: VerificationEntryLike = {
      id: 'mcamp-123',
      business_name: 'Baraka Market',
      category: 'African Grocery Store',
      city: 'Kansas City',
      state: 'MO',
      business_snapshot: {
        verified_nap: {
          name: 'Baraka Market',
          phone: '(816) 666-4170',
          address: '1447 Independence Ave',
          city: 'Kansas City',
          state: 'MO',
          zip: '64106',
        },
      },
    };

    const html = renderToStaticMarkup(
      createElement(ResolveVerificationModal, {
        entry,
        onClose: noop,
        onResolved: noop,
        mode: 'campaign',
        initialTab: 'nap',
      }),
    );

    expect(html).toContain('value="Baraka Market"');
    expect(html).toContain('value="(816) 666-4170"');
    expect(html).toContain('value="1447 Independence Ave"');
    expect(html).toContain('value="Kansas City"');
    expect(html).toContain('value="MO"');
    expect(html).toContain('value="64106"');
  });

  it('renders campaign mode reason field and save button', () => {
    const entry: VerificationEntryLike = {
      id: 'mcamp-123',
      business_name: 'Baraka Market',
      business_snapshot: {},
    };

    const html = renderToStaticMarkup(
      createElement(ResolveVerificationModal, {
        entry,
        onClose: noop,
        onResolved: noop,
        mode: 'campaign',
      }),
    );

    expect(html).toContain('Save record');
    expect(html).toContain('Reason');
    // Does NOT render queue nextAction selector in campaign mode
    expect(html).not.toContain('Next action');
  });

  it('renders queue mode nextAction selector and resolve button', () => {
    const entry: VerificationEntryLike = {
      id: 'queue-123',
      business_name: 'Queued Market',
      business_snapshot: {},
    };

    const html = renderToStaticMarkup(
      createElement(ResolveVerificationModal, {
        entry,
        onClose: noop,
        onResolved: noop,
        mode: 'queue',
      }),
    );

    expect(html).toContain('Resolve');
    expect(html).toContain('Next action');
    expect(html).toContain('Create campaign (graduate immediately)');
    expect(html).not.toContain('Save record');
  });

  it('renders every stored profile row, not just the first', () => {
    const entry: VerificationEntryLike = {
      id: 'mcamp-multi',
      business_name: 'Multi Profile Shop',
      business_snapshot: {
        social_profiles: [
          { platform: 'Facebook', url: 'https://facebook.com/shop' },
          { platform: 'Instagram', url: 'https://instagram.com/shop' },
        ],
        directory_profiles: [
          { platform: 'MapQuest', url: 'https://mapquest.com/shop', claim_status: 'unknown' },
          { platform: 'google', url: 'https://g.page/shop', claim_status: 'claimed' },
          { platform: 'yelp', url: 'https://yelp.com/biz/shop', claim_status: 'unclaimed' },
        ],
      },
    };

    const html = renderToStaticMarkup(
      createElement(ResolveVerificationModal, {
        entry,
        onClose: noop,
        onResolved: noop,
        mode: 'campaign',
        initialTab: 'enrichment',
      }),
    );

    // All rows render — a modal that only round-trips the first row would
    // still drop the rest on save.
    for (const expected of [
      'value="Facebook"',
      'value="Instagram"',
      'value="MapQuest"',
      'value="google"',
      'value="yelp"',
      'value="https://mapquest.com/shop"',
      'value="https://g.page/shop"',
      'value="https://yelp.com/biz/shop"',
    ]) {
      expect(html).toContain(expected);
    }
  });

  it('prefills captured hours from the snapshot and shows the captured indicator', () => {
    const entry: VerificationEntryLike = {
      id: 'mcamp-hours',
      business_name: 'Baraka Market',
      business_snapshot: {
        verified_nap: {
          name: 'Baraka Market',
          hours: {
            monday: { open: '10:00', close: '21:00', closed: false },
            timezone: 'America/Chicago',
          },
        },
      },
    };

    const html = renderToStaticMarkup(
      createElement(ResolveVerificationModal, {
        entry,
        onClose: noop,
        onResolved: noop,
        mode: 'campaign',
        initialTab: 'enrichment',
      }),
    );

    // Hours state non-null → the "Captured" indicator, not the empty-state hint.
    expect(html).toContain('Captured');
    expect(html).not.toContain('No hours captured');
    // Stored timezone wins over state inference.
    expect(html).toContain('America/Chicago');
  });

  it('shows the empty-hours hint when no hours were captured', () => {
    const entry: VerificationEntryLike = {
      id: 'mcamp-nohours',
      business_name: 'Baraka Market',
      business_snapshot: {},
    };

    const html = renderToStaticMarkup(
      createElement(ResolveVerificationModal, {
        entry,
        onClose: noop,
        onResolved: noop,
        mode: 'campaign',
        initialTab: 'enrichment',
      }),
    );

    expect(html).toContain('No hours captured');
  });

  it('renders the notes tab with owner receptivity options and call notes', () => {
    const entry: VerificationEntryLike = {
      id: 'mcamp-notes',
      business_name: 'Baraka Market',
      business_snapshot: {},
    };

    const html = renderToStaticMarkup(
      createElement(ResolveVerificationModal, {
        entry,
        onClose: noop,
        onResolved: noop,
        mode: 'campaign',
        initialTab: 'notes',
      }),
    );

    expect(html).toContain('Owner receptivity');
    expect(html).toContain('Interested');
    expect(html).toContain('Defensive');
    expect(html).toContain('Call notes');
    expect(html).toContain('<textarea');
  });

  it('shows the gate notice instead of fields when the outcome is non-operational', () => {
    const entry: VerificationEntryLike = {
      id: 'mcamp-closed',
      business_name: 'Closed Shop',
      business_snapshot: {
        verified_nap: { name: 'Closed Shop' },
        directory_profiles: [
          { platform: 'MapQuest', url: 'https://mapquest.com/shop', claim_status: 'unknown' },
        ],
      },
    };

    for (const tab of ['nap', 'enrichment'] as const) {
      const html = renderToStaticMarkup(
        createElement(ResolveVerificationModal, {
          entry,
          onClose: noop,
          onResolved: noop,
          mode: 'campaign',
          initialTab: tab,
          initialOutcome: 'closed',
        }),
      );

      // Both identity panels gate on napApplicable — no fields, no profiles.
      expect(html).toContain('Verified NAP and enrichment are captured only for operational or relocated businesses');
      expect(html).not.toContain('value="MapQuest"');
      expect(html).not.toContain('value="Closed Shop"');
    }
  });

  it('blocks the create-campaign next action for a non-operational queue outcome', () => {
    const entry: VerificationEntryLike = {
      id: 'queue-closed',
      business_name: 'Closed Shop',
      business_snapshot: {},
    };

    const html = renderToStaticMarkup(
      createElement(ResolveVerificationModal, {
        entry,
        onClose: noop,
        onResolved: noop,
        mode: 'queue',
        initialOutcome: 'closed',
      }),
    );

    expect(html).toContain('blocked: not operational');
    expect(html).toContain('This outcome cannot graduate to a campaign');
  });
});

describe('snapshotWebsite', () => {
  it('passes flat strings through', () => {
    expect(snapshotWebsite('https://baraka.example')).toBe('https://baraka.example');
  });

  it('unwraps the scan-shape { status, url } object', () => {
    expect(snapshotWebsite({ status: 'active', url: 'https://baraka.example' })).toBe(
      'https://baraka.example',
    );
  });

  it('returns empty for objects without url, null, and non-strings', () => {
    expect(snapshotWebsite({ status: 'missing' })).toBe('');
    expect(snapshotWebsite(null)).toBe('');
    expect(snapshotWebsite(42)).toBe('');
  });
});

describe('verificationClearsCampaign', () => {
  it('clears operational, relocated, and never-verified rows; blocks verified-bad outcomes', () => {
    expect(verificationClearsCampaign('operational')).toBe(true);
    expect(verificationClearsCampaign('relocated')).toBe(true);
    // Never-verified rows (no outcome) are unaffected — the gate only blocks
    // outcomes that were actually recorded.
    expect(verificationClearsCampaign(null)).toBe(true);
    expect(verificationClearsCampaign(undefined)).toBe(true);
    for (const outcome of ['closed', 'closed_temporarily', 'unreachable', 'wrong_business']) {
      expect(verificationClearsCampaign(outcome)).toBe(false);
    }
  });
});
