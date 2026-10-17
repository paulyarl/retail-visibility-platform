/**
 * SettingsTab — the Domain Configuration card is custom-domain aware.
 *
 * Regression guard for the pre-custom-domain card, which hardcoded
 * `{subdomain}.visibleshelf.com` (wrong apex on staging, which serves
 * visibleshelf.store) and never surfaced an active custom domain — so a
 * merchant live on mybrand.com still saw only their platform subdomain, and a
 * custom-domain-only tenant read as "Not configured".
 *
 * The API now resolves the canonical ladder (see getGMCSyncStatus) and hands
 * the card absolute addresses; these assertions pin the render against them.
 * The card is a plain Tailwind component, so it renders in the node test
 * environment without a provider.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SettingsTab from './SettingsTab';

const render = (gmcStatus: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(SettingsTab, {
      tenantId: 'tid-1',
      gmcStatus,
      onSaveSettings: () => {},
      saving: false,
      saveResult: null,
    }),
  );

const base = { hasGMCConnection: true, hasMerchantLink: true };

describe('SettingsTab Domain Configuration', () => {
  it('shows the active custom domain as the live product-link address', () => {
    const html = render({
      ...base,
      hasSubdomain: true,
      subdomain: 'baraka',
      storefrontKind: 'custom',
      storefrontHost: 'mybrand.com',
      storefrontBaseUrl: 'https://mybrand.com',
      platformSubdomainUrl: 'https://baraka.visibleshelf.store',
      customDomain: 'mybrand.com',
    });

    expect(html).toContain('Custom domain');
    expect(html).toContain('https://mybrand.com');
    expect(html).toContain('Product links use your custom domain');
    // The platform address uses the config-derived apex, never a literal.
    expect(html).toContain('https://baraka.visibleshelf.store');
    expect(html).not.toContain('baraka.visibleshelf.com');
  });

  it('falls back to the platform subdomain when no custom domain is active', () => {
    const html = render({
      ...base,
      hasSubdomain: true,
      subdomain: 'baraka',
      storefrontKind: 'subdomain',
      storefrontHost: 'baraka',
      storefrontBaseUrl: 'https://baraka.visibleshelf.store',
      platformSubdomainUrl: 'https://baraka.visibleshelf.store',
      customDomain: null,
    });

    expect(html).toContain('https://baraka.visibleshelf.store');
    expect(html).toContain('Product links use your platform subdomain');
    expect(html).toContain('Not connected');
    // No custom domain yet → the card points at the domain settings page.
    expect(html).toContain('/t/tid-1/settings/subdomain');
  });

  it('flags a path-only tenant with no merchant-controlled domain', () => {
    const html = render({
      ...base,
      hasSubdomain: false,
      subdomain: null,
      storefrontKind: 'path',
      storefrontHost: null,
      storefrontBaseUrl: null,
      platformSubdomainUrl: null,
      customDomain: null,
    });

    expect(html).toContain('No live storefront domain yet');
    expect(html).toContain('Not configured');
    expect(html).toContain('Not connected');
  });
});
