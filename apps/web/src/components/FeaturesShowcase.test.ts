import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FeaturesShowcase, { type ShowcaseMode } from './FeaturesShowcase';
import { TIER_PRICING } from '@/lib/tiers/tier-features';

const render = (mode: ShowcaseMode) =>
  renderToStaticMarkup(createElement(FeaturesShowcase, { mode }));

const MODES: ShowcaseMode[] = ['hybrid', 'tabs', 'grid', 'slider'];

// The Entry Presence triad, in claim-upgrade order (presence → discovery →
// storefront), with the surface labels DirectoryPresenceUpgradeOptionsService
// returns in ENTRY_PRESENCE_MODES.
const TRIAD = [
  { id: 'presence', surface: 'Platform storefront + checkout' },
  { id: 'discovery', surface: 'Third-party (Google)' },
  { id: 'storefront', surface: 'Platform in-house marketplace' },
];

describe('FeaturesShowcase', () => {
  it.each(MODES)('leads with the free directory gateway in %s mode', (mode) => {
    const html = render(mode);
    expect(html).toContain('Claim your free listing');
    expect(html).toContain('First step — Free');
    expect(html).toContain('/directory/add-business');
  });

  it.each(MODES)('never starts the ladder at a paid rung in %s mode', (mode) => {
    const html = render(mode);
    const gateway = html.indexOf('Claim your free listing');
    const firstPaid = html.indexOf(`$${TIER_PRICING.presence}/mo`);
    expect(gateway).toBeGreaterThan(-1);
    expect(firstPaid).toBeGreaterThan(gateway);
  });

  it.each(['hybrid', 'grid'] as ShowcaseMode[])('renders the triad as a mode picker in %s mode', (mode) => {
    const html = render(mode);
    expect(html).toContain('Pick the surface that fits');
    expect(html).toContain('Recommended');
    expect(html).toContain('Clover POS');
    expect(html).toContain('Google Shopping feed');
    expect(html).toContain('Add-ons that run on what you already have');
    for (const { id, surface } of TRIAD) {
      expect(html).toContain(surface);
      expect(html).toContain(`$${TIER_PRICING[id]}/mo`);
    }
  });

  it('renders one card per growth tier and no triad members among them', () => {
    const html = render('grid');
    // GridFeatureCard emits a "Mindset Shift" block per growth tier; the
    // triad renders as TriadCard ("Retailer Growth Mindset") instead.
    expect(html.match(/Mindset Shift/g)).toHaveLength(4);
    expect(html.match(/Retailer Growth Mindset/g)).toHaveLength(3);
  });

  it('reads prices from TIER_PRICING rather than hardcoded strings', () => {
    const html = render('grid');
    for (const id of [
      'presence',
      'discovery',
      'storefront',
      'commitment',
      'ecommerce',
      'omnichannel',
      'enterprise',
    ]) {
      expect(html).toContain(`$${TIER_PRICING[id]}/mo`);
    }
  });

  it('uses the canonical tier names, not the retired marketing labels', () => {
    const html = render('hybrid');
    expect(html).toContain('Storefront+');
    expect(html).toContain('SWIS');
    expect(html).not.toContain('DISCOVERY');
  });

  it('drops the unkeepable claims', () => {
    const html = render('hybrid');
    expect(html).not.toContain('guarantee');
    expect(html).not.toContain('instantly');
  });
});
