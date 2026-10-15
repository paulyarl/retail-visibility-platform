/**
 * Render tests for LogContactModal's contact-channel target block.
 *
 * The modal used to offer only channel NAMES in the select — the operator
 * could not see the actual phone/email/social/website they were logging
 * against. The target block renders each reachable channel's value with a
 * direct action link (Call/Text/Email/Open), and clicking the row selects
 * that channel for the log entry.
 *
 * Node-environment vitest — no jsdom needed. Uses react-dom/server.
 * (useEffect never runs under SSR; the channel targets render
 * synchronously so the block is fully assertable.)
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LogContactModal from './LogContactModal';
import type { Campaign, OutreachIntelligenceResult } from '@/services/MarketingOpsService';

const campaign = (overrides: Partial<Campaign> = {}): Campaign =>
  ({
    id: 'mcamp-test1',
    business_name: 'Baraka Market',
    phone: '(816) 666-4170',
    phones: [{ number: '(816) 555-0123', label: 'Second line' }],
    email: 'info@barakamarket.example',
    website_url: 'https://barakamarket.example',
    social_profiles: [
      { platform: 'Facebook', url: 'https://facebook.com/barakamarketkc' },
    ],
    ...overrides,
  } as unknown as Campaign);

const render = (c: Campaign) =>
  renderToStaticMarkup(
    createElement(LogContactModal, { campaign: c, onClose: () => {}, onLogged: () => {} }),
  );

describe('LogContactModal channel targets', () => {
  it('renders the actual value behind every available channel', () => {
    const html = render(campaign());

    // Primary phone + secondary lines
    expect(html).toContain('(816) 666-4170');
    expect(html).toContain('(816) 555-0123');
    expect(html).toContain('Second line');
    // Email / website / social URLs visible in the markup
    expect(html).toContain('info@barakamarket.example');
    expect(html).toContain('https://barakamarket.example');
    expect(html).toContain('https://facebook.com/barakamarketkc');
    expect(html).toContain('Facebook');
  });

  it('renders direct action links for each channel', () => {
    const html = render(campaign());

    expect(html).toContain('href="tel:(816) 666-4170"');
    expect(html).toContain('href="sms:(816) 666-4170"');
    expect(html).toContain('href="mailto:info@barakamarket.example"');
    expect(html).toContain('href="https://barakamarket.example"');
  });

  it('omits the target block when the campaign has no contact channels', () => {
    const html = render(
      campaign({
        phone: null,
        phones: [],
        email: null,
        website_url: null,
        social_profiles: [],
      }),
    );

    expect(html).not.toContain('href="tel:');
    expect(html).not.toContain('href="mailto:');
    // The channel select still renders with the always-available options.
    expect(html).toContain('In Person');
  });
});

// ─── Worksheet parity ────────────────────────────────────────────────────
//
// The modal loads the campaign's contact channels when it opens; the
// confirmed-fields trio (owner name / team signal / preferred channel) comes
// from the Outreach Prep worksheet and used to open blank. Now it prefills.
//
// `initialTab: 'writeback'` is required to assert it: Radix TabsContent
// unmounts inactive panels, so the write-back block is absent from a static
// render unless it is the active tab.

const worksheet = (overrides: Partial<OutreachIntelligenceResult> = {}) =>
  ({
    id: 'moi-test1',
    campaign_id: 'mcamp-test1',
    owner_name: 'Maria',
    owner_name_confidence: 'confirmed',
    business_email: null,
    business_email_confidence: 'unavailable',
    team_signal: 'family_team',
    preferred_contact_channel: 'facebook_dm',
    recommended_salutation: 'Hi Maria',
    research_date: null,
    prepared_by: null,
    payload: {},
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  } as unknown as OutreachIntelligenceResult);

const renderWriteBack = (
  c: Campaign,
  sheet: OutreachIntelligenceResult | null = worksheet(),
) =>
  renderToStaticMarkup(
    createElement(LogContactModal, {
      campaign: c,
      onClose: () => {},
      onLogged: () => {},
      initialTab: 'writeback',
      initialWorksheet: sheet,
    }),
  );

describe('LogContactModal worksheet parity', () => {
  it('prefills the confirmed-fields trio from the worksheet', () => {
    const html = renderWriteBack(campaign());

    expect(html).toContain('value="Maria"');
    expect(html).toContain('value="facebook_dm"');
    // The select marks the worksheet's team signal as the current option.
    expect(html).toMatch(/value="family_team"[^>]*selected/);
  });

  it('treats a worksheet team_signal of "unknown" as no signal', () => {
    const html = renderWriteBack(
      campaign(),
      worksheet({
        team_signal: 'unknown',
        owner_name: null,
        preferred_contact_channel: null,
      }),
    );

    expect(html).not.toContain('value="Maria"');
    expect(html).not.toContain('value="facebook_dm"');
    expect(html).not.toMatch(/value="family_team"[^>]*selected/);
  });

  it('renders the confirmed-fields panel even with no worksheet on file', () => {
    const html = renderWriteBack(campaign(), null);

    // The fields are present (blank) — the operator can still fill them.
    expect(html).toContain('Owner name confirmed');
    expect(html).toContain('Team signal');
    expect(html).not.toContain('value="Maria"');
  });
});
