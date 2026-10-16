/**
 * Regression: a recently-viewed store card must keep unclaimed
 * directory-presence seeds on their /place/{slug} page instead of linking to
 * /directory/{slug}. The seed signal (listing_origin / subscription_tier) is
 * carried by buildLastViewedStoreListing and consumed by getDirectoryListingUrl
 * inside UnifiedStoreCard.
 */

import { describe, it, expect } from 'vitest';
import { buildLastViewedStoreListing } from './last-viewed-listing';
import { getDirectoryListingUrl } from '@/utils/slug';

const seed = {
  tenantId: 't-arsema',
  businessName: 'Arsema G Food Mart LLC',
  slug: 'arsema-g-food-mart-llc',
  address: '6667 W Washington St, Unit A',
  city: 'Indianapolis',
  state: 'IN',
  logoUrl: 'https://cdn.example.com/arsema.png',
  ratingAvg: 4.6,
  ratingCount: 12,
  productCount: 3,
  isFeatured: false,
  reason: 'Viewed 10/16/2026',
  primaryCategory: 'african-grocery-store',
  gbpPrimaryCategoryName: 'African Grocery Store',
  listingOrigin: 'directory_seed',
  subscriptionTier: 'directory_presence',
};

describe('buildLastViewedStoreListing', () => {
  it('carries the seed signal so the card links to the place page', () => {
    const listing = buildLastViewedStoreListing(seed);
    expect(listing.listingOrigin).toBe('directory_seed');
    expect(listing.subscriptionTier).toBe('directory_presence');
    expect(getDirectoryListingUrl(listing)).toBe('/place/arsema-g-food-mart-llc');
  });

  it('routes a seed identified only by tier to the place page', () => {
    const listing = buildLastViewedStoreListing({ ...seed, listingOrigin: null });
    expect(getDirectoryListingUrl(listing)).toBe('/place/arsema-g-food-mart-llc');
  });

  it('routes a claimed tenant to the directory entry', () => {
    const listing = buildLastViewedStoreListing({
      ...seed,
      listingOrigin: 'claimed',
      subscriptionTier: 'starter',
    });
    expect(getDirectoryListingUrl(listing)).toBe('/directory/arsema-g-food-mart-llc');
  });

  it('defaults to the directory entry when no seed signal is present', () => {
    const listing = buildLastViewedStoreListing({
      tenantId: 't-x',
      businessName: 'X',
      slug: 'x',
    });
    expect(getDirectoryListingUrl(listing)).toBe('/directory/x');
  });

  it('preserves the display fields the card renders', () => {
    const listing = buildLastViewedStoreListing(seed);
    expect(listing).toMatchObject({
      id: 't-arsema',
      tenantId: 't-arsema',
      businessName: 'Arsema G Food Mart LLC',
      slug: 'arsema-g-food-mart-llc',
      address: '6667 W Washington St, Unit A',
      city: 'Indianapolis',
      state: 'IN',
      logoUrl: 'https://cdn.example.com/arsema.png',
      ratingAvg: 4.6,
      ratingCount: 12,
      productCount: 3,
      reason: 'Viewed 10/16/2026',
      primaryCategory: 'african-grocery-store',
      gbpPrimaryCategoryName: 'African Grocery Store',
      directoryPublished: true,
    });
  });
});
