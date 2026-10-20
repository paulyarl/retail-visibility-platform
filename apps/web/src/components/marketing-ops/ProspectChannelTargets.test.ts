/**
 * ProspectChannelTargets — the shared reachable-channel block.
 *
 * Extracted from LogContactModal so the Log Contact modal and the Outreach
 * Prep worksheet tab cannot drift. These tests pin the row contract both
 * surfaces depend on.
 *
 * Node-environment vitest — no jsdom needed. Uses react-dom/server.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProspectChannelTargets, {
  buildChannelTargets,
  buildChannelTargetsFromChannels,
} from './ProspectChannelTargets';
import type { Campaign } from '@/services/MarketingOpsService';
import type { ProspectChannels } from '@/lib/prospect-channels';

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

const noChannels = (): Campaign =>
  campaign({ phone: null, phones: [], email: null, website_url: null, social_profiles: [] });

const render = (c: Campaign, props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(ProspectChannelTargets, { campaign: c, ...props }));

describe('buildChannelTargets', () => {
  it('lists primary phone, extra lines, email, website and socials in order', () => {
    const targets = buildChannelTargets(campaign());

    expect(targets.map((t) => t.label)).toEqual([
      'Phone',
      'Second line',
      'Email',
      'Website',
      'Facebook',
    ]);
    expect(targets[0].channel).toBe('phone');
    expect(targets[0].links.map((l) => l.href)).toEqual([
      'tel:(816) 666-4170',
      'sms:(816) 666-4170',
    ]);
  });

  it('returns nothing when the campaign has no reachable channels', () => {
    expect(buildChannelTargets(noChannels())).toEqual([]);
  });
});

const resolvedChannels: ProspectChannels = {
  phone: '(317) 555-0100',
  email: 'owner@example.com',
  website: 'https://marias.example',
  socials: [{ platform: 'Facebook', url: 'https://facebook.com/marias' }],
  source: 'snapshot',
};

describe('buildChannelTargetsFromChannels', () => {
  it('builds the same row contract from resolved queue/seed channels', () => {
    const targets = buildChannelTargetsFromChannels(resolvedChannels);

    expect(targets.map((t) => t.label)).toEqual(['Phone', 'Email', 'Website', 'Facebook']);
    expect(targets[0].links.map((l) => l.href)).toEqual([
      'tel:(317) 555-0100',
      'sms:(317) 555-0100',
    ]);
  });

  it('renders the shared block from channels for the Log touch modal', () => {
    const html = renderToStaticMarkup(
      createElement(ProspectChannelTargets, { channels: resolvedChannels }),
    );

    expect(html).toContain('(317) 555-0100');
    expect(html).toContain('owner@example.com');
    expect(html).toContain('https://marias.example');
    expect(html).toContain('https://facebook.com/marias');
  });
});

describe('ProspectChannelTargets', () => {
  it('renders each channel value with its direct action links', () => {
    const html = render(campaign());

    expect(html).toContain('(816) 666-4170');
    expect(html).toContain('(816) 555-0123');
    expect(html).toContain('href="tel:(816) 666-4170"');
    expect(html).toContain('href="sms:(816) 666-4170"');
    expect(html).toContain('href="mailto:info@barakamarket.example"');
    expect(html).toContain('https://facebook.com/barakamarketkc');
  });

  it('renders rows as buttons only when onSelect is provided', () => {
    // The modal passes onSelect (clicking a row selects that channel); the
    // worksheet tab omits it, so the rows are plain reference.
    const clickable = render(campaign(), { onSelect: () => {} });
    expect(clickable).toContain('title="Log a phone contact"');

    const plain = render(campaign());
    expect(plain).not.toContain('title="Log a ');
    expect(plain).toContain('(816) 666-4170');
  });

  it('highlights the active channel row', () => {
    const html = render(campaign(), { activeChannel: 'email' });
    expect(html).toContain('bg-blue-50');
  });

  it('renders nothing when there are no channels', () => {
    expect(render(noChannels())).toBe('');
  });
});
