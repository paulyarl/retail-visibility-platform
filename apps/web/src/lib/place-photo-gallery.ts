import type { DirectoryEntryOptionsState } from '@/services/CapabilityResolutionService';

/**
 * Whether the store photo gallery renders for a directory listing.
 *
 * Operator-captured photos on an unclaimed seed are operator-authored content,
 * not a tenant entitlement — the same reasoning the seed banner QR style uses
 * ("Tier gates don't apply: this is operator-authored platform styling for the
 * report banner, not a tenant entitlement", DirectoryPresenceSeedService).
 *
 * The tenant gate has to be bypassed for seeds because it resolves FALSE for
 * every one of them: seeds are provisioned with
 * `subscription_tier = 'directory_presence'`, the free gateway tier, which does
 * not include the `directory_entry_gallery_on` feature. Reading the gate
 * naively therefore hides the gallery on exactly the surface it exists for.
 *
 * A claimed listing is not a seed, so it falls through to the merchant's own
 * directory-entry tier config — which keeps the paid `presence` tier as the
 * upgrade that controls the gallery after the claim.
 *
 * Kept in lib/ as a pure, dependency-light function rather than exported from
 * a page component: it is unit-testable directly in the node test environment,
 * and it stays importable from either a server or a client component (a named
 * export of a `'use client'` module becomes a client reference, which a server
 * component cannot call).
 */
export function showsListingPhotoGallery(
  listing: { listingOrigin?: string | null } | null | undefined,
  dirEntryOpts: Pick<DirectoryEntryOptionsState, 'galleryEnabled'> | null | undefined
): boolean {
  if (listing?.listingOrigin === 'directory_seed') return true;

  // Non-seed listings keep the sibling-flag convention used across the layout
  // props: absent capability state defaults the section on.
  return dirEntryOpts?.galleryEnabled ?? true;
}
