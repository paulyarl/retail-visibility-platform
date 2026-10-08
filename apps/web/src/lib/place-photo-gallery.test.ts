/**
 * showsListingPhotoGallery — the seed bypass
 *
 * The regression this pins: reading the tenant gate naively
 * (`dirEntryOpts?.galleryEnabled ?? true`) hides the gallery on the seed
 * surface, because seeds are provisioned with
 * `subscription_tier = 'directory_presence'` — the free gateway tier, which
 * does not include `directory_entry_gallery_on`. So `galleryEnabled` resolves
 * false for every seed and the gallery never mounts on the one surface it
 * exists for.
 *
 * Operator-captured photos on an unclaimed seed are operator-authored content,
 * not a tenant entitlement, so the gate is bypassed for seeds and left intact
 * for claimed listings (which keeps the paid `presence` tier as the post-claim
 * upgrade).
 */
import { describe, it, expect } from 'vitest';
import { showsListingPhotoGallery } from './place-photo-gallery';

const SEED = { listingOrigin: 'directory_seed' };
const NOT_SEED = { listingOrigin: null };

describe('showsListingPhotoGallery — seed listings bypass the tenant gate', () => {
  it('renders on a seed even when the tier gate resolves false', () => {
    // The exact case that shipped broken: directory_presence has no gallery.
    expect(showsListingPhotoGallery(SEED, { galleryEnabled: false })).toBe(true);
  });

  it('renders on a seed when the tier gate resolves true', () => {
    expect(showsListingPhotoGallery(SEED, { galleryEnabled: true })).toBe(true);
  });

  it('renders on a seed when capability state is absent', () => {
    expect(showsListingPhotoGallery(SEED, null)).toBe(true);
    expect(showsListingPhotoGallery(SEED, undefined)).toBe(true);
  });
});

describe('showsListingPhotoGallery — claimed listings keep the tenant gate', () => {
  it('honours a closed gate', () => {
    expect(showsListingPhotoGallery(NOT_SEED, { galleryEnabled: false })).toBe(false);
  });

  it('honours an open gate', () => {
    expect(showsListingPhotoGallery(NOT_SEED, { galleryEnabled: true })).toBe(true);
  });

  it('defaults on when capability state is absent, matching the sibling layout flags', () => {
    expect(showsListingPhotoGallery(NOT_SEED, null)).toBe(true);
  });

  it('treats a missing listing as not-a-seed', () => {
    expect(showsListingPhotoGallery(null, { galleryEnabled: false })).toBe(false);
    expect(showsListingPhotoGallery(undefined, { galleryEnabled: true })).toBe(true);
  });
});
