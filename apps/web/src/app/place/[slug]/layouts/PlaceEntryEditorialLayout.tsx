'use client';

import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';

import { LocalBusinessStructuredData, BreadcrumbStructuredData } from '@/components/directory/StructuredData';
import RelatedStores from '@/components/directory/RelatedStores';
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import StoreViewTracker from '@/components/tracking/StoreViewTracker';
import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';
import ContactInformationCollapsible from '@/components/directory/ContactInformationCollapsible';
import { TenantQRCode } from '@/components/public/TenantQRCode';
import LastViewed from '@/components/directory/LastViewed';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';

import { useQrScanTracking } from '@/hooks/useQrScanTracking';

/**
 * PlaceEntryEditorialLayout — editorial-style layout adapted for directory
 * presence seeds (unclaimed listings from public information).
 *
 * Adapts the Editorial directory entry aesthetic with seed-appropriate content:
 * - Hero: dark gradient with business name + category, provenance disclaimer,
 *   and a "Claim this listing" CTA (instead of "Visit Storefront")
 * - Sidebar: Contact, Hours, Map, QR (the NAP+ data seeds actually have)
 * - Commerce sections (Featured Products, Categories, Coupons, Reviews, FAQ,
 *   Inquiry) are omitted — seeds have max_skus: 0 and no storefront
 * - Related Stores kept for shopper discovery
 * - Unclaimed banner at top
 */
export interface PlaceEntryEditorialLayoutProps {
  tenantId: string;
  listing: any;
  businessHours: any;
  hoursStatus: any;
  tenantInfo: any;
  slugForRelated: string;
  optFlags: any;
  showsHours: boolean;
  showsMap: boolean;
  showsLocation: boolean;
  isRetailStore: boolean;
  currentUrl: string;
  baseUrl: string;
  fullAddress: string;
  claimToken?: string | null;
  publicDisclaimer?: string | null;
}

export default function PlaceEntryEditorialLayout({
  tenantId,
  listing,
  businessHours,
  hoursStatus,
  tenantInfo,
  slugForRelated,
  optFlags,
  showsHours,
  showsMap,
  showsLocation,
  isRetailStore,
  currentUrl,
  baseUrl,
  fullAddress,
  claimToken,
  publicDisclaimer,
}: PlaceEntryEditorialLayoutProps) {
  useQrScanTracking(tenantId, 'directory');

  // ── Verbose debug logging for sidebar conditional variables ──
  console.log('[PlaceEntryEditorialLayout] DEBUG', {
    tenantId,
    listingSlug: listing?.slug,
    hasListing: !!listing,
    hasBusinessHours: !!businessHours,
    businessHoursValue: businessHours,
    hoursStatus,
    hasTenantInfo: !!tenantInfo,
    optFlags,
    showsHours,
    showsMap,
    showsLocation,
    isRetailStore,
    fullAddress,
    listingAddress: listing?.address,
    listingPhone: listing?.phone,
    listingEmail: listing?.email,
    // Evaluate each sidebar gate condition
    contactGate: optFlags?.showContact !== false,
    contactGateReason: optFlags ? `optFlags.showContact=${optFlags.showContact}` : 'optFlags is null',
    hoursGate: showsHours && optFlags?.showHoursStatus !== false && !!businessHours,
    hoursGateReason: `showsHours=${showsHours}, optFlags?.showHoursStatus=${optFlags?.showHoursStatus}, hasBusinessHours=${!!businessHours}`,
    mapGate: showsMap && optFlags?.showInteractiveMaps !== false && !!listing?.address,
    mapGateReason: `showsMap=${showsMap}, optFlags?.showInteractiveMaps=${optFlags?.showInteractiveMaps}, hasAddress=${!!listing?.address}`,
    heroBadgeGate: showsHours && optFlags?.showHoursStatus !== false,
  });

  const primaryColor = tenantInfo?.metadata?.primaryColor || tenantInfo?.metadata?.primary_color || null;
  const claimHref = claimToken ? `/directory/claim/${claimToken}` : '/directory';
  const disclaimer = publicDisclaimer ||
    `${listing.businessName} is listed from public information (address and phone). This is not a claimed profile and may be incomplete.`;

  return (
    <>
      <LocalBusinessStructuredData listing={listing} url={currentUrl} />
      <BreadcrumbStructuredData items={[
        { name: 'Home', url: baseUrl },
        { name: 'Directory', url: `${baseUrl}/directory` },
        { name: listing.businessName, url: currentUrl },
      ]} />
      <StoreViewTracker tenantId={tenantId} storeName={listing.businessName} categories={listing.categories} />

      <div className="min-h-screen bg-white">
        {/* Editorial Hero — seed-adapted */}
        <div
          className="relative text-white overflow-hidden"
          style={primaryColor ? { background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}88 50%, ${primaryColor}33 100%)` } : { backgroundColor: '#171717' }}
        >
          <div className="absolute inset-0 opacity-20">
            <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900" />
          </div>
          <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-24">
            <Link href="/directory" className="inline-flex items-center text-sm text-neutral-300 hover:text-white mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
            </Link>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                {listing.logoUrl && (
                  <img src={listing.logoUrl} alt={listing.businessName} className="w-20 h-20 rounded-xl object-cover border-2 border-white/20" />
                )}
                <div>
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{listing.businessName}</h1>
                  {listing.primaryCategory && (
                    <p className="text-neutral-300 mt-2 text-lg">{listing.primaryCategory}</p>
                  )}
                </div>
              </div>
              <p className="text-neutral-300 text-lg max-w-2xl leading-relaxed">
                {disclaimer}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href={claimHref}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors font-semibold"
                >
                  <Info className="w-5 h-5" /> Claim this listing
                </Link>
                {showsHours && optFlags?.showHoursStatus !== false && (
                  <HoursStatusBadge status={hoursStatus} size="lg" animate={optFlags?.showAnimatedHours !== false} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Asymmetric Content Grid */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Main Column — seed has no commerce content, so this is intentionally sparse */}
            <div className="lg:col-span-8 space-y-10">
              {/* Provenance callout */}
              <section className="bg-neutral-50 rounded-xl p-8 border border-neutral-200">
                <h2 className="text-2xl font-bold text-neutral-900 mb-4">About this listing</h2>
                <p className="text-neutral-600 leading-relaxed text-lg">
                  {disclaimer}
                </p>
                <p className="text-neutral-500 leading-relaxed mt-4">
                  Claiming is free and lets the business owner verify details, update hours, add a photo,
                  and connect with customers on VisibleShelf.
                </p>
                <Link
                  href={claimHref}
                  className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
                >
                  <Info className="w-5 h-5" /> Claim this listing
                </Link>
              </section>
            </div>

            {/* Sidebar — NAP+ data (always shown for seeds; NAP+hours are public information) */}
            <div className="lg:col-span-4 space-y-8">
              {/* Contact Card */}
              {optFlags?.showContact !== false && (
                <div className="bg-neutral-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Contact</h3>
                  <ContactInformationCollapsible
                    tenant={listing}
                    fullAddress={showsLocation ? fullAddress : ''}
                    initialExpanded={true}
                    isRetailStore={true}
                  />
                </div>
              )}

              {/* Hours */}
              {showsHours && optFlags?.showHoursStatus !== false && businessHours && (
                <div className="bg-neutral-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Hours</h3>
                  <BusinessHoursCollapsible businessHours={businessHours} isRetailStore={true} />
                </div>
              )}

              {/* Map */}
              {showsMap && optFlags?.showInteractiveMaps !== false && listing.address && (
                <div className="bg-neutral-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Location</h3>
                  <GoogleMapEmbed address={listing.address} />
                </div>
              )}

              {/* QR */}
              <div className="bg-neutral-50 rounded-xl p-6 flex flex-col items-center">
                <TenantQRCode
                  url={currentUrl}
                  tenantId={listing.tenantId}
                  label="Scan to Share"
                  downloadName={listing.businessName?.toLowerCase().replace(/[^a-z0-9]/g, '-')}
                  size={160}
                  showDownload={true}
                  pageType="directory"
                  capabilityFlags={optFlags}
                />
              </div>
            </div>
          </div>
        </div>

        <RelatedStores currentSlug={slugForRelated} limit={3} title="Similar Places" />
        {optFlags?.showRecentlyViewed !== false && <LastViewed />}
        <PoweredByFooter />
      </div>
    </>
  );
}
