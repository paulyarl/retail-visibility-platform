'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, XCircle, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

import { directoryService } from '@/services/DirectorySingletonService';
import { publicDirectoryService } from '@/services/PublicDirectoryService';
import { publicUnifiedCapabilityService } from '@/services/PublicUnifiedCapabilityService';
import { tenantPublicService } from '@/services/TenantPublicService';
import directoryClaimPublicService, { type DirectoryClaimSummary } from '@/services/DirectoryClaimPublicService';
import { clientLogger } from '@/lib/client-logger';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { usePublicStorefrontCapability } from '@/hooks/tenant-access/usePublicCapabilityAccess';
import type { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';

import PlaceEntryEditorialLayout from '../../place/[slug]/layouts/PlaceEntryEditorialLayout';

interface RetailPreviewPageProps {
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

export default function RetailPreviewPage({ params }: RetailPreviewPageProps) {
  const searchParams = useSearchParams();
  const previewToken = searchParams.get('preview');

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(true);
  const [claimSummary, setClaimSummary] = useState<DirectoryClaimSummary | null>(null);
  const [listing, setListing] = useState<any>(null);
  const [businessHours, setBusinessHours] = useState<any>(null);
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [optFlags, setOptFlags] = useState<StorefrontOptionFlags | null>(null);
  const [slugForRelated, setSlugForRelated] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      // Gate: no token = no access
      if (!previewToken) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      try {
        // Validate the token via the claim endpoint
        const summary = await directoryClaimPublicService.getClaimSummary(previewToken);
        if (!summary) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        setClaimSummary(summary);
        setAccessDenied(false);

        const { slug } = await params;

        // Fetch the consolidated directory data for this slug
        const data = await directoryService.getDirectoryConsolidated(slug);
        if (!data?.listing) {
          setLoading(false);
          return;
        }

        setListing(data.listing);

        // Fetch sidebar data in parallel
        const [hours, info, flags, resolvedSlug] = await Promise.all([
          getBusinessHours(data.listing.tenantId),
          tenantPublicService.getPublicTenantInfo(data.listing.tenantId),
          publicUnifiedCapabilityService.getStorefrontOptionFlags(data.listing.tenantId),
          publicDirectoryService.resolveBySlug(slug),
        ]);

        setBusinessHours(hours);
        setTenantInfo(info);
        if (flags) setOptFlags(flags);
        setSlugForRelated(resolvedSlug || slug);
      } catch (error) {
        clientLogger.error('[Retail Preview] Error:', { detail: error });
        setAccessDenied(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params, previewToken]);

  // Hooks that depend on listing.tenantId
  const tenantId = listing?.tenantId || '';
  const { status: hoursStatus } = useStoreStatus(tenantId, true);
  const storefrontCap = usePublicStorefrontCapability(tenantId || null);
  const isRetailStore = storefrontCap.data?.type === 'retail' || storefrontCap.data?.type === 'flexible';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Access denied — no token, invalid token, or expired token
  if (accessDenied) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Preview Not Available
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            {!previewToken
              ? 'A valid preview token is required to view this page. Contact the VisibleShelf operator who shared this link with you.'
              : 'This preview link is invalid or has expired. Please request a new preview link from the VisibleShelf operator.'}
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
  const currentUrl = `${baseUrl}/retail/${identifier}`;

  const fullAddress = [
    listing.address,
    listing.city,
    listing.state,
    listing.zipCode,
  ].filter(Boolean).join(', ');

  const showsHours = optFlags?.showHoursDisplay ?? true;
  const showsMap = optFlags?.showMapDisplay ?? true;
  const showsLocation = optFlags?.showLocationDisplay ?? true;

  const claimHref = previewToken ? `/directory/claim/${previewToken}` : '/directory';

  return (
    <>
      {/* Operator preview banner — conversion framing for the business owner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">This is a private preview of your business profile</p>
              <p className="text-blue-100 text-xs mt-0.5">
                Shared by VisibleShelf. Claim your listing to make it live and unlock the full profile.
              </p>
            </div>
          </div>
          <Link
            href={claimHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-semibold text-sm whitespace-nowrap"
          >
            <ShieldCheck className="w-4 h-4" />
            Claim this listing
          </Link>
        </div>
      </div>

      {/* Conversion benefits strip */}
      <div className="bg-blue-50 border-b border-blue-100">
        <div className="max-w-5xl mx-auto px-6 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2 text-blue-900">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Verify your hours and phone</span>
            </div>
            <div className="flex items-center gap-2 text-blue-900">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Add photos and a business description</span>
            </div>
            <div className="flex items-center gap-2 text-blue-900">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Connect with shoppers on VisibleShelf</span>
            </div>
          </div>
        </div>
      </div>

      <PlaceEntryEditorialLayout
        tenantId={tenantId}
        listing={listing}
        businessHours={businessHours}
        hoursStatus={hoursStatus}
        tenantInfo={tenantInfo}
        slugForRelated={slugForRelated}
        optFlags={optFlags}
        showsHours={showsHours}
        showsMap={showsMap}
        showsLocation={showsLocation}
        isRetailStore={isRetailStore}
        currentUrl={currentUrl}
        baseUrl={baseUrl}
        fullAddress={fullAddress}
        claimToken={previewToken}
        publicDisclaimer={listing.publicDisclaimer}
      />
    </>
  );
}
