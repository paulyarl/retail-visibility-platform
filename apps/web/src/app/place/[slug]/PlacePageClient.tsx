'use client';

import { useStoreStatus } from '@/hooks/useStoreStatus';
import type { DirectoryEntryOptionsState } from '@/services/CapabilityResolutionService';

import PlaceEntryEditorialLayout from './layouts/PlaceEntryEditorialLayout';
import { GbpReviewsSection } from '@/components/gbp/GbpReviewsSection';
import { GbpPostsSection } from '@/components/gbp/GbpPostsSection';
import { GbpPhotoGallerySection } from '@/components/gbp/GbpPhotoGallerySection';

interface PlacePageClientProps {
  slug: string;
  listing: any;
  businessHours: any;
  tenantInfo: any;
  dirEntryOpts: DirectoryEntryOptionsState | null;
  slugForRelated: string;
}

export default function PlacePageClient({
  slug,
  listing,
  businessHours,
  tenantInfo,
  dirEntryOpts,
  slugForRelated,
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
      />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <GbpReviewsSection slug={slug} />
        <GbpPostsSection slug={slug} />
        <GbpPhotoGallerySection slug={slug} />
      </div>
    </>
  );
}
