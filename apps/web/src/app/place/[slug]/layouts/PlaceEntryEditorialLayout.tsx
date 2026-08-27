'use client';

import Link from 'next/link';
import { ArrowLeft, Info, ShieldCheck } from 'lucide-react';

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
import CouponSpotlight from '@/components/storefront/CouponSpotlight';
import PublicInquiryForm from '@/components/crm/PublicInquiryForm';

import { useQrScanTracking } from '@/hooks/useQrScanTracking';
import type { DirectoryEntryOptionsState } from '@/services/CapabilityResolutionService';

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
 *
 * Sidebar visibility is driven by DirectoryEntryOptionsState (tier capability
 * resolution: directory_entry_hours_on, directory_entry_map_on,
 * directory_entry_contact_on, directory_entry_qr_on) — NOT by storefront
 * merchant preferences, which don't apply to unclaimed seed listings.
 */
export interface PlaceEntryEditorialLayoutProps {
  tenantId: string;
  listing: any;
  businessHours: any;
  hoursStatus: any;
  tenantInfo: any;
  slugForRelated: string;
  dirEntryOpts: DirectoryEntryOptionsState | null;
  showsHours: boolean;
  showsMap: boolean;
  showsLocation: boolean;
  showsContact: boolean;
  showsQr: boolean;
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
  dirEntryOpts,
  showsHours,
  showsMap,
  showsLocation,
  showsContact,
  showsQr,
  currentUrl,
  baseUrl,
  fullAddress,
  claimToken,
  publicDisclaimer,
}: PlaceEntryEditorialLayoutProps) {
  useQrScanTracking(tenantId, 'directory');

  const primaryColor = tenantInfo?.metadata?.primaryColor || tenantInfo?.metadata?.primary_color || null;
  const hasClaimToken = !!claimToken;
  const claimHref = hasClaimToken ? `/place/claim/${claimToken}` : '#claim-inquiry';
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
                {listing.logoUrl && (dirEntryOpts?.canShowLogo ?? true) && (
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
                {hasClaimToken ? (
                  <Link
                    href={claimHref}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors font-semibold"
                  >
                    <ShieldCheck className="w-5 h-5" /> Claim this listing
                  </Link>
                ) : (
                  <a
                    href={claimHref}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors font-semibold"
                  >
                    <Info className="w-5 h-5" /> Are you the owner?
                  </a>
                )}
                {showsHours && hoursStatus && (
                  <HoursStatusBadge status={hoursStatus} size="lg" animate={true} />
                )}

              </div>
            </div>
          </div>
        </div>

        <section className="max-w-6xl mx-auto px-6 -mt-4 relative z-20 mb-4">
          <CouponSpotlight tenantId={tenantId} variant="banner" />
        </section>

        {/* Full-width provenance callout — the conversion pitch */}
        <div className="max-w-6xl mx-auto px-6 -mt-8 relative z-20">
          <section className="bg-white rounded-xl p-8 border border-neutral-200 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold text-neutral-900 mb-3">About this listing</h2>
                <p className="text-neutral-600 leading-relaxed text-lg">
                  {disclaimer}
                </p>
                <p className="text-neutral-500 leading-relaxed mt-3">
                  Claiming is free and lets the business owner verify details, update hours, add a photo,
                  and connect with customers on VisibleShelf.
                </p>
              </div>
              <div className="flex flex-col items-center lg:items-end gap-3">
                {hasClaimToken ? (
                  <Link
                    href={claimHref}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold w-full lg:w-auto justify-center"
                  >
                    <ShieldCheck className="w-5 h-5" /> Claim this listing
                  </Link>
                ) : (
                  <a
                    href={claimHref}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold w-full lg:w-auto justify-center"
                  >
                    <Info className="w-5 h-5" /> Are you the owner?
                  </a>
                )}
                {showsQr && (
                  <div className="flex flex-col items-center">
                    <TenantQRCode
                      url={currentUrl}
                      tenantId={listing.tenantId}
                      label="Scan to Share"
                      downloadName={listing.businessName?.toLowerCase().replace(/[^a-z0-9]/g, '-')}
                      size={120}
                      showDownload={true}
                      pageType="directory"
                      isPublic
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Balanced content grid — map on left (wider), NAP data on right */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left — Location + Contact stacked */}
            <div className="lg:col-span-7 space-y-8">
              {showsMap && listing.address && (
                <div className="bg-neutral-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Location</h3>
                  <GoogleMapEmbed address={listing.address} />
                </div>
              )}

              {showsContact && (
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
            </div>

            {/* Right — Hours standalone */}
            <div className="lg:col-span-5 space-y-8">
              {showsHours && businessHours && (
                <div className="bg-neutral-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Hours</h3>
                  <BusinessHoursCollapsible businessHours={businessHours} isRetailStore={true} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Claim inquiry form — shown when no claim token has been minted.
            Uses the same anonymous PublicInquiryForm pattern as storefront contact,
            routed to the platform tenant so the operator can mint a claim token. */}
        {!hasClaimToken && (
          <div id="claim-inquiry" className="max-w-3xl mx-auto px-6 py-12 scroll-mt-8">
            <div className="bg-white rounded-xl p-8 border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">Are you the business owner?</h2>
                  <p className="text-sm text-neutral-500">
                    Send us a message and we&apos;ll help you claim this listing for free.
                  </p>
                </div>
              </div>
              <PublicInquiryForm
                tenantId="platform"
                tenantName="VisibleShelf"
                sourceLabel="Place Claim Request"
                showFaqs={false}
              />
            </div>
          </div>
        )}

        <RelatedStores currentSlug={slugForRelated} limit={3} title="Similar Places" />
        <LastViewed />
        <PoweredByFooter />
      </div>
    </>
  );
}
