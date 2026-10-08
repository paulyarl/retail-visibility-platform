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
 * EXCEPT when the listing came from an operator seed (`seedId`), where the
 * gallery is grandfathered past the gate. Without this, the operator's photos
 * vanish at the exact moment of conversion: DirectoryClaimService flips
 * `listing_origin` from 'directory_seed' to 'claimed' on claim, the tier gate
 * takes over, and a merchant who claims without upgrading sits on
 * `directory_presence` — the free tier, which has no gallery feature. The seed
 * row itself persists (status 'claimed') and `seedId` is resolved by a LEFT
 * JOIN on the listing, so the link survives the claim and the check still
 * holds afterwards.
 *
 * Kept in lib/ as a pure, dependency-light function rather than exported from
 * a page component: it is unit-testable directly in the node test environment,
 * and it stays importable from either a server or a client component (a named
 * export of a `'use client'` module becomes a client reference, which a server
 * component cannot call).
 */
export function showsSeedAuthoredSurface(
  listing: { listingOrigin?: string | null; seedId?: string | null } | null | undefined,
  tierGate: boolean | null | undefined
): boolean {
  if (listing?.listingOrigin === 'directory_seed') return true;

  // Grandfathered: operator-authored content survives the claim.
  if (listing?.seedId) return true;

  // Non-seed listings keep the sibling-flag convention used across the layout
  // props: absent capability state defaults the section on.
  return tierGate ?? true;
}

/**
 * Photo gallery — a thin wrapper over the rule above, reading the gallery's own
 * tier key. Kept as a named function so the gallery call sites state their
 * intent; the general form serves every other operator-authored seed surface
 * (the hero logo, for one), which reads a different tier flag.
 */
export function showsListingPhotoGallery(
  listing: { listingOrigin?: string | null; seedId?: string | null } | null | undefined,
  dirEntryOpts: Pick<DirectoryEntryOptionsState, 'galleryEnabled'> | null | undefined
): boolean {
  return showsSeedAuthoredSurface(listing, dirEntryOpts?.galleryEnabled);
}
