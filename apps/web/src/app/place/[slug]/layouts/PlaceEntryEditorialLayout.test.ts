/**
 * PlaceEntryEditorialLayout — store photo gallery gate
 *
 * The seed surface renders the store's own photos (directory_photos) above
 * Location. The gate is `showsGallery`, threaded from the page as
 * `dirEntryOpts?.galleryEnabled ?? true` — the platform-controlled pre-claim
 * default, which a claimed merchant's directory-entry tier config overrides.
 *
 * The real DirectoryPhotoGalleryDisplay returns null during SSR (it loads in a
 * useEffect and bails when it has no photos), so it cannot be observed in a
 * static render. It is replaced here with a sentinel purely so the gate itself
 * is observable — this test asserts the gate, not the gallery's internals.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { AuthProvider } from '@/contexts/AuthContext';
import { CustomerAuthProvider } from '@/contexts/CustomerAuthContext';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/directory/DirectoryPhotoGalleryDisplay', async () => {
  const React = await import('react');
  return {
    default: () => React.createElement('div', { 'data-testid': 'store-gallery' }),
  };
});

import PlaceEntryEditorialLayout, {
  type PlaceEntryEditorialLayoutProps,
} from './PlaceEntryEditorialLayout';

const baseProps = {
  tenantId: 'tid-test',
  slug: 'arsema-food-mart',
  listing: {
    businessName: 'Arsema Food Mart',
    listingOrigin: 'directory_seed',
    address: '6667 W Washington St',
  },
  businessHours: null,
  hoursStatus: null,
  tenantInfo: null,
  slugForRelated: 'arsema-food-mart',
  dirEntryOpts: null,
  showsHours: false,
  showsMap: false,
  showsLocation: false,
  showsContact: false,
  showsQr: false,
  currentUrl: 'https://example.test/place/arsema-food-mart',
  baseUrl: 'https://example.test',
  fullAddress: '6667 W Washington St, Indianapolis, IN 46241',
};

function renderWith(overrides: Partial<PlaceEntryEditorialLayoutProps>) {
  // Real providers, not mocks. The layout renders Mantine components and the
  // Market Intel / LastViewed children, which need the app's standard context
  // stack in the tree. See AGENTS.md render-test notes.
  return renderToStaticMarkup(
    createElement(
      MantineProvider,
      null,
      createElement(
        AuthProvider,
        null,
        createElement(
          CustomerAuthProvider,
          null,
          createElement(PlaceEntryEditorialLayout, {
            ...baseProps,
            showsGallery: false,
            ...overrides,
          })
        )
      )
    )
  );
}

function render(showsGallery: boolean) {
  return renderWith({ showsGallery });
}

describe('PlaceEntryEditorialLayout — store photo gallery gate', () => {
  it('renders the store gallery when the gate is on', () => {
    expect(render(true)).toContain('data-testid="store-gallery"');
  });

  it('omits the store gallery when the gate is off', () => {
    expect(render(false)).not.toContain('data-testid="store-gallery"');
  });
});

/**
 * Shelf-referrer context (?shelf=). A shopper who clicked a card on the
 * "Grocery Store" shelf sees that shelf name lead the page — the card showed
 * it — with a back link returning to the shelf; the primary category stays
 * reachable via its own browse link. Secondary categories surface as "Also
 * on" chips so every shelf the seed is filed on is visible.
 */
const seedListing = {
  businessName: 'Garaya African Market LLC',
  listingOrigin: 'directory_seed',
  primaryCategory: 'African Grocery Store',
  city: 'Indianapolis',
  state: 'IN',
};

const groceryShelfReferrer = {
  surface: 'place_category' as const,
  label: 'Grocery Store',
  href: '/place/category/grocery-store?city=Indianapolis&state=IN',
  categoryLabel: 'Grocery Store',
};

describe('PlaceEntryEditorialLayout — shelf referrer context', () => {
  it('leads with the referring shelf category and links back to the shelf', () => {
    const html = renderWith({ listing: seedListing, referrerShelf: groceryShelfReferrer });
    expect(html).toContain('Back to Grocery Store');
    expect(html).toContain('/place/category/grocery-store?city=Indianapolis&amp;state=IN');
    // The subtitle shows the shelf the shopper browsed from, not the primary.
    expect(html).toContain('Grocery Store');
    // The primary stays reachable as its own browse link.
    expect(html).toContain('Browse African Grocery Store stores');
  });

  it('falls back to the directory back link and primary subtitle without a referrer', () => {
    const html = renderWith({ listing: seedListing });
    expect(html).toContain('Back to Directory');
    expect(html).toContain('African Grocery Store');
  });

  it('keeps the primary subtitle for a non-category referrer', () => {
    const html = renderWith({
      listing: seedListing,
      referrerShelf: {
        surface: 'place_city',
        label: 'Indianapolis, IN',
        href: '/place/city/indianapolis-in',
        categoryLabel: null,
      },
    });
    expect(html).toContain('Back to Indianapolis, IN');
    expect(html).toContain('>African Grocery Store</p>');
  });

  it('renders secondary categories as "Also on" shelf chips', () => {
    const html = renderWith({
      listing: seedListing,
      secondaryShelves: [
        { label: 'Grocery Store', href: '/place/category/grocery-store?city=Indianapolis&state=IN' },
        { label: 'Halal Meat Market', href: null },
      ],
    });
    expect(html).toContain('Also on:');
    expect(html).toContain('/place/category/grocery-store?city=Indianapolis&amp;state=IN');
    // A label with no live shelf renders as plain text — awareness without a
    // dead-end link.
    expect(html).toContain('Halal Meat Market');
  });
});
