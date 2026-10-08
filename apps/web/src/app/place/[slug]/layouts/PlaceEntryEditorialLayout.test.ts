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

import PlaceEntryEditorialLayout from './PlaceEntryEditorialLayout';

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

function render(showsGallery: boolean) {
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
          createElement(PlaceEntryEditorialLayout, { ...baseProps, showsGallery })
        )
      )
    )
  );
}

describe('PlaceEntryEditorialLayout — store photo gallery gate', () => {
  it('renders the store gallery when the gate is on', () => {
    expect(render(true)).toContain('data-testid="store-gallery"');
  });

  it('omits the store gallery when the gate is off', () => {
    expect(render(false)).not.toContain('data-testid="store-gallery"');
  });
});
