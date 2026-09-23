'use client';

import { useStoreStatus } from '@/hooks/useStoreStatus';
import type { DirectoryEntryOptionsState } from '@/services/CapabilityResolutionService';
import type { MarketIntelTeaserSummary } from '@/services/MarketIntelPublicService';

import PlaceEntryEditorialLayout from './layouts/PlaceEntryEditorialLayout';
import { GbpReviewsSection } from '@/components/gbp/GbpReviewsSection';
import { GbpPostsSection } from '@/components/gbp/GbpPostsSection';
import { GbpPhotoGallerySection } from '@/components/gbp/GbpPhotoGallerySection';
import { MarketIntelSidebar } from '@/components/place/MarketIntelSidebar';
import { MarketIntelBanner } from '@/components/place/MarketIntelBanner';

interface PlacePageClientProps {
  slug: string;
  listing: any;
  businessHours: any;
  tenantInfo: any;
  dirEntryOpts: DirectoryEntryOptionsState | null;
  slugForRelated: string;
  /** Server-rendered teaser (§11.5 — crawlable DOM content). */
  marketIntelTeaser?: MarketIntelTeaserSummary | null;
}

export default function PlacePageClient({
  slug,
  listing,
  businessHours,
  tenantInfo,
  dirEntryOpts,
  slugForRelated,
  marketIntelTeaser,
}: PlacePageClientProps) {
  const tenantId = listing?.tenantId || '';
  const { status: hoursStatus } = useStoreStatus(tenantId, true);

  const baseUrl =
    process.env.NEXT_PUBLIC_WEB_URL ||
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    (typeof window !== 'undefined' ? window.location.origin : process.env.WEB_URL) ||
    'http://localhost:3000';
  const currentUrl = `${baseUrl}/place/${slug}`;

  const fullAddress = [
    listing.address,
    listing.city,
    listing.state,
    listing.zipCode,
  ].filter(Boolean).join(', ');

  const showsHours = dirEntryOpts?.hoursEnabled ?? true;
  const showsMap = dirEntryOpts?.mapEnabled ?? true;
  const showsLocation = dirEntryOpts?.mapEnabled ?? true;
  const showsContact = dirEntryOpts?.contactEnabled ?? true;
  const showsQr = dirEntryOpts?.qrEnabled ?? true;

  return (
    <>
      <PlaceEntryEditorialLayout
        tenantId={tenantId}
        slug={slug}
        listing={listing}
        businessHours={businessHours}
        hoursStatus={hoursStatus}
        tenantInfo={tenantInfo}
        slugForRelated={slugForRelated}
        dirEntryOpts={dirEntryOpts}
        showsHours={showsHours}
        showsMap={showsMap}
        showsLocation={showsLocation}
        showsContact={showsContact}
        showsQr={showsQr}
        currentUrl={currentUrl}
        baseUrl={baseUrl}
        fullAddress={fullAddress}
        claimToken={listing.activeClaimToken}
        publicDisclaimer={listing.publicDisclaimer}
        publicNarrative={marketIntelTeaser?.publicNarrative ?? null}
      />
      {/* Market Intel sidebar — seed pages only (§2.1). The page already
          redirects non-seeds server-side; this gate is defensive. */}
      {listing.listingOrigin === 'directory_seed' && (
        <>
          {/* Square banner slot (300x250) — in-flow seed banner. The tall slot
              lives inside the panel below, so the two never collide. */}
          <div className="max-w-5xl mx-auto px-4 pt-6 flex justify-center">
            <MarketIntelBanner
              variant="square"
              surfaceType="seed"
              teaser={marketIntelTeaser}
              seedId={listing.seedId}
            />
          </div>
          <div className="max-w-5xl mx-auto px-4 pt-4">
            <MarketIntelSidebar
              slug={slug}
              initialTeaser={marketIntelTeaser}
              activeClaimToken={listing.activeClaimToken}
              seedId={listing.seedId}
            />
          </div>
        </>
      )}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <GbpReviewsSection slug={slug} />
        <GbpPostsSection slug={slug} />
        <GbpPhotoGallerySection slug={slug} />
      </div>
    </>
  );
}
