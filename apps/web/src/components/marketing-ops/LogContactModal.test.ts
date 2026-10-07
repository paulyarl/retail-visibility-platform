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
import type { Campaign } from '@/services/MarketingOpsService';

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
