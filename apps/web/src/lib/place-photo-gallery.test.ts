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
import { showsListingPhotoGallery, showsSeedAuthoredSurface } from './place-photo-gallery';

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

describe('showsListingPhotoGallery — operator-seeded photos survive the claim', () => {
  it('grandfathers the gallery on a claimed listing that came from a seed', () => {
    // DirectoryClaimService flips listing_origin 'directory_seed' → 'claimed',
    // so the seed branch stops matching and the tier gate takes over. The seed
    // row persists (status 'claimed') and seedId still resolves, so the
    // operator's photos must keep rendering. Without this they vanish at the
    // exact moment of conversion, on a merchant who claimed without upgrading.
    expect(
      showsListingPhotoGallery(
        { listingOrigin: 'claimed', seedId: 'seed-1' },
        { galleryEnabled: false }
      )
    ).toBe(true);
  });

  it('still honours a closed gate on a claimed listing with no seed behind it', () => {
    expect(
      showsListingPhotoGallery(
        { listingOrigin: 'claimed', seedId: null },
        { galleryEnabled: false }
      )
    ).toBe(false);
  });

  it('does not treat an absent seedId as a seed', () => {
    expect(showsListingPhotoGallery({ seedId: undefined }, { galleryEnabled: false })).toBe(false);
  });
});

describe('showsSeedAuthoredSurface — the general rule, as used by the hero logo', () => {
  it('renders on a seed even when the logo tier gate resolves false', () => {
    // directory_entry_logo_on is absent from the directory_presence tier, same
    // as the gallery key — an operator-uploaded logo would otherwise be stored
    // and used by the QR banner + OG image but missing from the hero.
    expect(showsSeedAuthoredSurface(SEED, false)).toBe(true);
  });

  it('grandfathers a claimed listing that came from a seed', () => {
    expect(
      showsSeedAuthoredSurface({ listingOrigin: 'claimed', seedId: 'seed-1' }, false)
    ).toBe(true);
  });

  it('honours a closed gate on a listing with no seed behind it', () => {
    expect(showsSeedAuthoredSurface(NOT_SEED, false)).toBe(false);
  });

  it('defaults on when the gate is absent, matching the sibling layout flags', () => {
    expect(showsSeedAuthoredSurface(NOT_SEED, null)).toBe(true);
    expect(showsSeedAuthoredSurface(NOT_SEED, undefined)).toBe(true);
  });

  it('is what the photo wrapper delegates to', () => {
    expect(showsListingPhotoGallery(SEED, { galleryEnabled: false })).toBe(
      showsSeedAuthoredSurface(SEED, false)
    );
    expect(showsListingPhotoGallery(NOT_SEED, { galleryEnabled: false })).toBe(
      showsSeedAuthoredSurface(NOT_SEED, false)
    );
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
