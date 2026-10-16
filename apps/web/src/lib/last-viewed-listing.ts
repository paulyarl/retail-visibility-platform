import type { DirectoryListing } from '@/components/directory/UnifiedStoreCard';

/**
 * Store fields carried out of a last-viewed recommendation
 * (`GET /api/recommendations/last-viewed`, store entries).
 */
export interface LastViewedStoreSource {
  tenantId: string;
  businessName: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  logoUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
  productCount?: number;
  isFeatured?: boolean;
  reason?: string;
  primaryCategory?: string;
  gbpPrimaryCategoryName?: string;
  /** `directory_seed` for unclaimed directory-presence seeds. */
  listingOrigin?: string | null;
  subscriptionTier?: string | null;
}

/**
 * Bridge a last-viewed store into a UnifiedStoreCard listing.
 *
 * The card routes via `getDirectoryListingUrl`, which sends unclaimed
 * directory_presence seeds (`listingOrigin === 'directory_seed'` / tier
 * `directory_presence`) to `/place/{slug}` and claimed tenants to
 * `/directory/{slug}` — the same pattern `RelatedStores` relies on. Carrying
 * the seed signal through is what keeps a recently-viewed seed on its place
 * page instead of bouncing to the directory entry.
 */
export function buildLastViewedStoreListing(store: LastViewedStoreSource): DirectoryListing {
  return {
    id: store.tenantId,
    tenantId: store.tenantId,
    businessName: store.businessName,
    slug: store.slug,
    address: store.address,
    city: store.city,
    state: store.state,
    logoUrl: store.logoUrl,
    ratingAvg: store.ratingAvg,
    ratingCount: store.ratingCount,
    productCount: store.productCount,
    isFeatured: store.isFeatured,
    reason: store.reason,
    directoryPublished: true,
    primaryCategory: store.primaryCategory,
    gbpPrimaryCategoryName: store.gbpPrimaryCategoryName,
    listingOrigin: store.listingOrigin,
    subscriptionTier: store.subscriptionTier ?? undefined,
  };
}
