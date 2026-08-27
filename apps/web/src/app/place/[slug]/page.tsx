'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, XCircle } from 'lucide-react';

import { directoryService } from '@/services/DirectorySingletonService';
import { publicDirectoryService } from '@/services/PublicDirectoryService';
import { publicUnifiedCapabilityService } from '@/services/PublicUnifiedCapabilityService';
import { tenantPublicService } from '@/services/TenantPublicService';
import { clientLogger } from '@/lib/client-logger';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import type { DirectoryEntryOptionsState } from '@/services/CapabilityResolutionService';

import PlaceEntryEditorialLayout from './layouts/PlaceEntryEditorialLayout';
import { GbpReviewsSection } from '@/components/gbp/GbpReviewsSection';
import { GbpPostsSection } from '@/components/gbp/GbpPostsSection';
import { GbpPhotoGallerySection } from '@/components/gbp/GbpPhotoGallerySection';

interface PlacePageProps {
  params: Promise<{ slug: string }>;
}

async function getBusinessHours(tenantId: string) {
  try {
    const data = await directoryService.getBusinessHours(tenantId);
    if (!data || !data.success || !data.data) return null;
    const hoursData = data.data;
    if (hoursData.periods && Array.isArray(hoursData.periods)) {
      const { periods, timezone } = hoursData;
      const hours: any = { timezone };
      periods.forEach((period: any) => {
        const dayName = period.day?.toUpperCase();
        if (dayName && !hours[dayName]) {
          hours[dayName] = { open: period.open, close: period.close };
        }
      });
      if (periods.length > 0) hours.periods = periods;
      return hours;
    }
    return hoursData;
  } catch (error) {
    clientLogger.error('Error fetching business hours:', { detail: error });
    return null;
  }
}

export default function PlacePage({ params }: PlacePageProps) {
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<any>(null);
  const [businessHours, setBusinessHours] = useState<any>(null);
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [dirEntryOpts, setDirEntryOpts] = useState<DirectoryEntryOptionsState | null>(null);
  const [slugForRelated, setSlugForRelated] = useState<string>('');
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { slug } = await params;
        const data = await directoryService.getDirectoryConsolidated(slug);

        if (!data?.listing) {
          setIsNotFound(true);
          setLoading(false);
          return;
        }

        // Non-seed listings are redirected server-side in layout.tsx, but guard
        // here too in case of a race or stale cache.
        if (data.listing.listingOrigin !== 'directory_seed') {
          window.location.assign(`/directory/${data.listing.slug || slug}`);
          return;
        }

        setListing(data.listing);

        // Fetch sidebar/skill data in parallel
        const [hours, info, dirOpts, resolvedSlug] = await Promise.all([
          getBusinessHours(data.listing.tenantId),
          tenantPublicService.getPublicTenantInfo(data.listing.tenantId),
          publicUnifiedCapabilityService.getDirectoryEntryOptionsState(data.listing.tenantId),
          publicDirectoryService.resolveBySlug(slug),
        ]);

        setBusinessHours(hours);
        setTenantInfo(info);
        if (dirOpts) setDirEntryOpts(dirOpts);
        setSlugForRelated(resolvedSlug || slug);
      } catch (error) {
        clientLogger.error('[Place] Error fetching place data:', { detail: error });
        setIsNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params]);

  // Hooks that depend on listing.tenantId
  const tenantId = listing?.tenantId || '';
  const { status: hoursStatus } = useStoreStatus(tenantId, true);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Place Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            We couldn&apos;t find this place. It may have been removed or the URL might be incorrect.
          </p>
          <Link
            href="/directory"
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Browse Directory
          </Link>
        </div>
      </div>
    );
  }

  if (!listing) {
    return null;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_WEB_URL ||
    (typeof window !== 'undefined' ? window.location.origin : process.env.WEB_URL) ||
    'http://localhost:3000';
  const { slug: identifier } = use(params);
  const currentUrl = `${baseUrl}/place/${identifier}`;

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
        <GbpReviewsSection slug={identifier} />
        <GbpPostsSection slug={identifier} />
        <GbpPhotoGallerySection slug={identifier} />
      </div>
    </>
  );
}
