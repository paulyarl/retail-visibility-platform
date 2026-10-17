/**
 * StorefrontDomainSummary — the one component both Google integration surfaces
 * render (Settings → Domain Configuration card, sync-status chip), so the two
 * can't drift. It shows the canonical ladder the API resolves: an active custom
 * domain wins over the platform subdomain, and a path-only tenant gets a "no
 * live domain" warning. Read-only — no domain changes happen here.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  StorefrontDomainSummary,
  storefrontDomainLabel,
  hasLiveStorefrontDomain,
  type StorefrontDomainStatus,
} from './StorefrontDomainSummary';

describe('storefrontDomainLabel', () => {
  it('labels the live custom domain', () => {
    expect(
      storefrontDomainLabel({ storefrontBaseUrl: 'https://mybrand.com', storefrontKind: 'custom' }),
    ).toBe('Custom domain: https://mybrand.com');
  });

  it('labels the platform subdomain when no custom domain is active', () => {
    expect(
      storefrontDomainLabel({
        storefrontBaseUrl: 'https://baraka.visibleshelf.store',
        storefrontKind: 'subdomain',
      }),
    ).toBe('Subdomain: https://baraka.visibleshelf.store');
  });

  it('flags a tenant with no merchant-controlled domain', () => {
    expect(storefrontDomainLabel({ storefrontBaseUrl: null, storefrontKind: 'path' })).toBe(
      'No Storefront Domain',
    );
    expect(storefrontDomainLabel(null)).toBe('No Storefront Domain');
  });
});

describe('hasLiveStorefrontDomain', () => {
  it('is true only when a merchant-controlled base URL exists', () => {
    expect(hasLiveStorefrontDomain({ storefrontBaseUrl: 'https://mybrand.com' })).toBe(true);
    expect(hasLiveStorefrontDomain({ storefrontBaseUrl: null })).toBe(false);
    expect(hasLiveStorefrontDomain(null)).toBe(false);
  });
});

describe('StorefrontDomainSummary', () => {
  const custom: StorefrontDomainStatus = {
    storefrontKind: 'custom',
    storefrontBaseUrl: 'https://mybrand.com',
    platformSubdomainUrl: 'https://baraka.visibleshelf.store',
    customDomain: 'mybrand.com',
  };

  it('inline variant (sync-status chip) renders the canonical label', () => {
    const html = renderToStaticMarkup(
      createElement(StorefrontDomainSummary, { variant: 'inline', status: custom }),
    );
    expect(html).toContain('Custom domain: https://mybrand.com');
  });

  it('card variant renders the rows and the live address, apex from config', () => {
    const html = renderToStaticMarkup(
      createElement(StorefrontDomainSummary, { variant: 'card', status: custom, tenantId: 'tid-1' }),
    );
    expect(html).toContain('Domain Configuration');
    expect(html).toContain('Product links use your custom domain');
    expect(html).toContain('https://mybrand.com');
    expect(html).toContain('https://baraka.visibleshelf.store');
    expect(html).not.toContain('baraka.visibleshelf.com');
  });

  it('card variant flags a path-only tenant and links to the domain settings', () => {
    const html = renderToStaticMarkup(
      createElement(StorefrontDomainSummary, {
        variant: 'card',
        tenantId: 'tid-1',
        status: {
          storefrontKind: 'path',
          storefrontBaseUrl: null,
          platformSubdomainUrl: null,
          customDomain: null,
        },
      }),
    );
    expect(html).toContain('No live storefront domain yet');
    expect(html).toContain('Not configured');
    expect(html).toContain('Not connected');
    expect(html).toContain('/t/tid-1/settings/subdomain');
  });
});
