/**
 * Regression: directory-home store cards must always land on the entry page
 * (directory for claimed tenants, place for unclaimed seeds) — never the
 * store's external website, even when the external-link capability is enabled.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import StoreCardV2 from './StoreCardV2';
import type { DirectoryStore } from '@/services/DirectorySingletonService';

const baseStore: DirectoryStore = {
  id: 'listing-arsema',
  tenantId: 't-arsema',
  businessName: 'Arsema G Food Mart LLC',
  slug: 'arsema-g-food-mart-llc',
  city: 'Indianapolis',
  state: 'IN',
  ratingAvg: 4.6,
  ratingCount: 12,
  productCount: 3,
  primaryCategory: 'African Grocery Store',
  listingOrigin: 'directory_seed',
};

function render(store: DirectoryStore, shelfRef?: string) {
  return renderToStaticMarkup(
    createElement(
      MantineProvider,
      null,
      createElement(StoreCardV2, { store, shelfRef }),
    ),
  );
}

describe('StoreCardV2 destination', () => {
  it('links an unclaimed seed to its place page', () => {
    expect(render(baseStore)).toContain('href="/place/arsema-g-food-mart-llc"');
  });

  it('links a claimed tenant to its directory entry', () => {
    const html = render({
      ...baseStore,
      listingOrigin: 'claimed',
      subscriptionTier: 'starter',
    });
    expect(html).toContain('href="/directory/arsema-g-food-mart-llc"');
  });

  it('ignores the external website even when the capability is enabled', () => {
    const html = render({
      ...baseStore,
      listingOrigin: 'claimed',
      subscriptionTier: 'starter',
      website: 'https://arsema.example',
      canUseExternalLink: true,
    });
    expect(html).toContain('href="/directory/arsema-g-food-mart-llc"');
    expect(html).not.toContain('https://arsema.example');
    expect(html).not.toContain('target="_blank"');
  });

  it('still stamps the shelf ref onto the entry link', () => {
    expect(render(baseStore, 'directory/home')).toContain(
      'href="/place/arsema-g-food-mart-llc?shelf=directory%2Fhome"',
    );
  });
});
