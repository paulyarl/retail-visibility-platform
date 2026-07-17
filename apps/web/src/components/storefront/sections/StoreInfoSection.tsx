'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';
import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';
import TenantMapSection from '@/components/tenant/TenantMapSection';
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import StorefrontMap from '@/components/storefront/StorefrontMap';
import FulfillmentOptionsPane from '@/components/storefront/FulfillmentOptionsPane';
import { StoreRatingDisplay } from '@/components/reviews/StoreRatingDisplay';
import { StorefrontLayoutKey } from '@/app/products/[id]/layouts/types';

interface StoreInfoSectionProps {
  tenantId: string;
  tenant: any;
  businessName: string;
  logoUrl: string | null;
  layoutVariant: StorefrontLayoutKey;
  storefrontStatus: { shouldShowPanel: boolean };
  isRetailStore: boolean;
  isProductsOnly?: boolean;
  businessHours?: any;
  mapLocation?: any;
  contactInfo: { phone: string | null; email: string | null; address: string | null; website: string | null };
  hoursStatus: any;
  primaryGBPCategory?: any;
  totalItems?: number;
  showsHours: boolean;
  showsHoursStatus: boolean;
  showsAnimatedHours: boolean;
  showsMap: boolean;
  showsLocation: boolean;
  showsContact: boolean;
  showsSocialMedia: boolean;
  showsFulfillment: boolean;
  showsInteractiveMaps: boolean;
  showsReviews: boolean;
  primaryColor?: string;
}

export function StoreInfoSection(props: StoreInfoSectionProps) {
  if (props.layoutVariant === 'immersive') {
    return <ImmersiveStoreInfo {...props} />;
  }
  if (props.layoutVariant === 'editorial') {
    return <EditorialStoreInfo {...props} />;
  }
  return <ClassicStoreInfo {...props} />;
}

export function StoreAboutSection(props: StoreInfoSectionProps) {
  if (props.layoutVariant === 'classic') {
    return <ClassicStoreAbout {...props} />;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shared: social links derivation
// ---------------------------------------------------------------------------

function useSocialLinks(tenant: any) {
  return useMemo(() => {
    const links: { platform: string; url: string; icon: string }[] = [];
    const meta = tenant?.metadata || {};
    const profileSocial = tenant?.profileData?.social_links;
    if (profileSocial?.facebook || meta.facebook) links.push({ platform: 'Facebook', url: profileSocial?.facebook || meta.facebook, icon: 'facebook' });
    if (profileSocial?.instagram || meta.instagram) links.push({ platform: 'Instagram', url: profileSocial?.instagram || meta.instagram, icon: 'instagram' });
    if (profileSocial?.twitter || meta.twitter || meta.x) links.push({ platform: 'X', url: profileSocial?.twitter || meta.twitter || meta.x, icon: 'x' });
    if (profileSocial?.linkedin || meta.linkedin) links.push({ platform: 'LinkedIn', url: profileSocial?.linkedin || meta.linkedin, icon: 'linkedin' });
    if (profileSocial?.tiktok || meta.tiktok) links.push({ platform: 'TikTok', url: profileSocial?.tiktok || meta.tiktok, icon: 'tiktok' });
    if (profileSocial?.youtube || meta.youtube) links.push({ platform: 'YouTube', url: profileSocial?.youtube || meta.youtube, icon: 'youtube' });
    return links;
  }, [tenant]);
}

function useBusinessDescription(tenant: any) {
  return useMemo(
    () =>
      tenant?.profileData?.business_description ||
      tenant?.profileData?.businessDescription ||
      tenant?.metadata?.businessDescription ||
      tenant?.metadata?.business_description ||
      tenant?.metadata?.description ||
      tenant?.description ||
      '',
    [tenant],
  );
}

// ---------------------------------------------------------------------------
// Shared: map rendering
// ---------------------------------------------------------------------------

function renderMap({
  showsMap,
  showsInteractiveMaps,
  mapLocation,
  contactInfo,
  tenant,
  tenantId,
  businessName,
  primaryGBPCategory,
  totalItems,
}: any) {
  if (!showsMap || !showsInteractiveMaps) return null;
  if (mapLocation) return <TenantMapSection location={mapLocation} />;
  if (contactInfo.address) return <GoogleMapEmbed address={contactInfo.address} height="h-80" showDirections={true} />;
  if (tenant) return (
    <StorefrontMap
      tenant={{
        id: tenantId,
        businessName,
        metadata: {
          address: tenant.address_line1,
          city: tenant.city,
          state: tenant.state,
          zip_code: tenant.postal_code,
          latitude: tenant.metadata?.latitude,
          longitude: tenant.metadata?.longitude,
          logo_url: tenant.metadata?.logo_url,
          phone: tenant.metadata?.phone,
        },
      }}
      primaryCategory={primaryGBPCategory?.name}
      productCount={totalItems}
    />
  );
  return null;
}

// ---------------------------------------------------------------------------
// Classic variant — About section (rendered BEFORE products)
// ---------------------------------------------------------------------------

function ClassicStoreAbout({
  tenant,
  businessName,
  storefrontStatus,
  showsSocialMedia,
}: StoreInfoSectionProps) {
  const socialLinks = useSocialLinks(tenant);
  const businessDescription = useBusinessDescription(tenant);

  if (storefrontStatus.shouldShowPanel || (!businessDescription && (!showsSocialMedia || socialLinks.length === 0))) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {businessDescription && (
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">About {businessName}</h2>
                  <div className="prose prose-neutral dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{businessDescription}</p>
                  </div>
                </div>
              )}
              {showsSocialMedia && socialLinks.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {socialLinks.map((link) => (
                    <a key={link.platform} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      {link.platform}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            {(tenant?.metadata?.logo_url || tenant?.metadata?.logoUrl) && (
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden">
                {tenant.metadata?.logo_url ? (
                  <div className="relative aspect-square">
                    <Image src={tenant.metadata.logo_url} alt={`${businessName} logo`} fill className="object-contain p-8" sizes="(max-width: 768px) 100vw, 50vw" />
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-16 h-16 text-primary-600 dark:text-primary-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <p className="text-primary-600 dark:text-primary-300 font-medium">{businessName}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Classic variant — Store Info Card (rendered AFTER products)
// ---------------------------------------------------------------------------

function ClassicStoreInfo({
  tenantId,
  tenant,
  businessName,
  storefrontStatus,
  isRetailStore,
  businessHours,
  mapLocation,
  contactInfo,
  hoursStatus,
  primaryGBPCategory,
  totalItems,
  showsHours,
  showsHoursStatus,
  showsAnimatedHours,
  showsMap,
  showsLocation,
  showsContact,
  showsFulfillment,
  showsInteractiveMaps,
}: StoreInfoSectionProps) {

  
  // DEBUG
  console.log(`StoreInfoSection: hoursStatus ${JSON.stringify(hoursStatus)}`);
  console.log(`StoreInfoSection: businessHours ${JSON.stringify(businessHours)}`);
  console.log(`StoreInfoSection: mapLocation ${JSON.stringify(mapLocation)}`);
  console.log(`StoreInfoSection: storefrontStatus ${JSON.stringify(storefrontStatus)}`);
  console.log(`StoreInfoSection: isRetailStore ${JSON.stringify(isRetailStore)}`);
  console.log(`StoreInfoSection: showsHoursStatus ${JSON.stringify(showsHoursStatus)}`);
  console.log(`StoreInfoSection: showsAnimatedHours ${JSON.stringify(showsAnimatedHours)}`);
  console.log(`StoreInfoSection: showsHours ${JSON.stringify(showsHours)}`);
  console.log(`StoreInfoSection: showsLocation ${JSON.stringify(showsLocation)}`);
  console.log(`StoreInfoSection: showsMap ${JSON.stringify(showsMap)}`);
  console.log(`StoreInfoSection: showsHoursStatus ${JSON.stringify(showsHoursStatus)}`);

  return (
    <>
      {/* Gradient divider */}
      <div id="hours-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

      {/* Store Information Card */}
      <div className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {!storefrontStatus.shouldShowPanel && showsHours && showsHoursStatus && businessHours && isRetailStore && (
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Our Store Hours
                  </h3>
                  <BusinessHoursCollapsible businessHours={businessHours} />
                </div>
              </div>
            )}

            <div className="space-y-6">
              {!storefrontStatus.shouldShowPanel && showsLocation && showsContact && contactInfo.address && (
                <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Contact
                  </h3>
                  <div className="space-y-3 text-sm">
                    {contactInfo.phone && <a href={`tel:${contactInfo.phone}`} className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400"><span>📞</span> {contactInfo.phone}</a>}
                    {contactInfo.email && <a href={`mailto:${contactInfo.email}`} className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400"><span>✉️</span> {contactInfo.email}</a>}
                    {contactInfo.website && <a href={contactInfo.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400"><span>🌐</span> Website</a>}
                    {!contactInfo.phone && !contactInfo.email && !contactInfo.website && <p className="text-neutral-500 dark:text-neutral-400 italic">Contact information not available</p>}
                  </div>
                </div>
              )}

              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden">
                  {!storefrontStatus.shouldShowPanel && showsLocation && showsContact && contactInfo.address && isRetailStore && (
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Visit Our Store</h3>
                      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{contactInfo.address}</p>
                      <div className="flex items-center gap-2">
                        <HoursStatusBadge status={hoursStatus} size="lg" animate={showsAnimatedHours} />
                      </div>
                      <div className="flex items-center gap-2">{hoursStatus?.label}</div>
                    </div>
                  )}
                  {renderMap({ showsMap, showsInteractiveMaps, mapLocation, contactInfo, tenant, tenantId, businessName, primaryGBPCategory, totalItems })}
                </div>
              </div>
            </div>
          </div>
          {!storefrontStatus.shouldShowPanel && showsFulfillment && (
            <FulfillmentOptionsPane tenantId={tenantId} compact={true} />
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Editorial variant
// ---------------------------------------------------------------------------

function EditorialStoreInfo({
  tenantId,
  tenant,
  businessName,
  logoUrl,
  storefrontStatus,
  isRetailStore,
  isProductsOnly,
  businessHours,
  mapLocation,
  contactInfo,
  hoursStatus,
  primaryGBPCategory,
  totalItems,
  showsHours,
  showsHoursStatus,
  showsAnimatedHours,
  showsMap,
  showsLocation,
  showsContact,
  showsSocialMedia,
  showsFulfillment,
  showsInteractiveMaps,
  primaryColor = '#6366f1',
}: StoreInfoSectionProps) {
  const socialLinks = useSocialLinks(tenant);
  const businessDescription = useBusinessDescription(tenant);

  const socialIconMap: Record<string, React.ReactNode> = {
    instagram: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>,
    facebook: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
    x: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
    tiktok: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.1 1.03-1.35 1.74-.25.69-.23 1.44-.07 2.15.34 1.44 1.75 2.59 3.27 2.63 1.12.04 2.2-.54 2.84-1.43.22-.29.39-.62.49-.97.14-.58.1-1.19.11-1.78.01-3.54 0-7.08.01-10.62-.01-1.59.06-3.2-.26-4.77z" /></svg>,
    linkedin: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>,
    youtube: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>,
  };

  return (
    <>
      {/* Editorial Story Section */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && (businessDescription || (showsSocialMedia && socialLinks.length > 0)) && (
        <section className="bg-white dark:bg-neutral-900" aria-label="About the store">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                {logoUrl ? (
                  <Image src={logoUrl} alt={`${businessName} logo`} fill className="object-contain p-8" sizes="(max-width: 768px) 100vw, 50vw" />
                ) : tenant?.metadata?.banner_url ? (
                  <Image src={tenant.metadata.banner_url} alt={businessName} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}22 0%, ${primaryColor}11 100%)` }}>
                    <span className="text-6xl sm:text-8xl font-bold text-neutral-200 dark:text-neutral-700 select-none">{businessName?.charAt(0)?.toUpperCase() || '?'}</span>
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-4">About {businessName}</h2>
                {businessDescription && <p className="text-neutral-600 dark:text-neutral-400 text-lg leading-relaxed mb-6">{businessDescription}</p>}
                {showsSocialMedia && socialLinks.length > 0 && (
                  <div className="flex items-center gap-3">
                    {socialLinks.map((link) => (
                      <a key={link.platform} href={link.url} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors" aria-label={`Visit our ${link.platform} page`}>
                        {socialIconMap[link.icon] || <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
                      </a>
                    ))}
                  </div>
                )}
                {showsContact && (contactInfo.phone || contactInfo.email || contactInfo.website) && (
                  <div className="mt-6 space-y-2 text-sm">
                    {contactInfo.phone && <a href={`tel:${contactInfo.phone}`} className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>{contactInfo.phone}</a>}
                    {contactInfo.email && <a href={`mailto:${contactInfo.email}`} className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>{contactInfo.email}</a>}
                    {contactInfo.website && <a href={contactInfo.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>Visit website</a>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Store Information (3-col) */}
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && (showsLocation || showsHours || showsContact) && isRetailStore && (
        <section id="hours-section" className="bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800" aria-label="Store information">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Visit Us */}
              {showsLocation && showsContact && contactInfo.address && (
                <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Visit Us</h3>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-3">{contactInfo.address}</p>
                    {showsHoursStatus && (
                      <div className="flex items-center gap-2 mb-3">
                        <HoursStatusBadge status={hoursStatus} size="sm" animate={showsAnimatedHours} />
                        {hoursStatus?.label && <span className="text-xs text-neutral-500 dark:text-neutral-400">{hoursStatus.label}</span>}
                      </div>
                    )}
                  </div>
                  {showsMap && showsInteractiveMaps && (
                    <div className="h-48">
                      {renderMap({ showsMap, showsInteractiveMaps, mapLocation, contactInfo, tenant, tenantId, businessName, primaryGBPCategory, totalItems })}
                    </div>
                  )}
                </div>
              )}

              {/* Hours */}
              {showsHours && (
                <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Hours</h3>
                  </div>
                  <BusinessHoursCollapsible businessHours={businessHours} isRetailStore={isRetailStore} />
                </div>
              )}

              {/* Get in Touch */}
              {showsContact && (
                <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Get in Touch</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    {contactInfo.phone && <a href={`tel:${contactInfo.phone}`} className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"><span className="text-base">📞</span> {contactInfo.phone}</a>}
                    {contactInfo.email && <a href={`mailto:${contactInfo.email}`} className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"><span className="text-base">✉️</span> {contactInfo.email}</a>}
                    {contactInfo.website && <a href={contactInfo.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"><span className="text-base">🌐</span> Website</a>}
                    {!contactInfo.phone && !contactInfo.email && !contactInfo.website && <p className="text-neutral-500 dark:text-neutral-400 italic">Contact information not available</p>}
                  </div>
                  {showsFulfillment && (
                    <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700">
                      <FulfillmentOptionsPane tenantId={tenantId} compact={true} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Immersive variant
// ---------------------------------------------------------------------------

function ImmersiveStoreInfo({
  tenantId,
  tenant,
  businessName,
  logoUrl,
  storefrontStatus,
  isRetailStore,
  isProductsOnly,
  businessHours,
  contactInfo,
  hoursStatus,
  showsHours,
  showsHoursStatus,
  showsAnimatedHours,
  showsContact,
  showsSocialMedia,
  showsReviews,
}: StoreInfoSectionProps) {
  const socialLinks = useSocialLinks(tenant);
  const businessDescription = useBusinessDescription(tenant);
  const [infoExpanded, setInfoExpanded] = useState(false);

  return (
    <>
      {!isProductsOnly && !storefrontStatus.shouldShowPanel && (businessDescription || showsContact || showsHours) && (
        <section className="bg-white dark:bg-neutral-950 py-8">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
            <div
              onClick={() => setInfoExpanded(!infoExpanded)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInfoExpanded(!infoExpanded); } }}
              role="button"
              tabIndex={0}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4 text-left">
                {logoUrl && (
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <Image src={logoUrl} alt={businessName} fill className="object-contain rounded" sizes="40px" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-sm text-neutral-900 dark:text-white">{businessName}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    {showsReviews && <StoreRatingDisplay tenantId={tenantId} variant="inline" />}
                    {showsHoursStatus && <HoursStatusBadge status={hoursStatus} size="sm" animate={showsAnimatedHours} />}
                    {contactInfo.address && <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[200px]">{contactInfo.address}</span>}
                  </div>
                </div>
              </div>
              <svg className={`w-5 h-5 text-neutral-400 transition-transform ${infoExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {infoExpanded && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                {businessDescription && (
                  <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900">
                    <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-2">About</h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{businessDescription}</p>
                  </div>
                )}
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 space-y-3">
                  {showsHours && businessHours && (
                    <div>
                      <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-2">Hours</h4>
                      <BusinessHoursCollapsible businessHours={businessHours} isRetailStore={isRetailStore} />
                    </div>
                  )}
                  {showsContact && (contactInfo.phone || contactInfo.email) && (
                    <div>
                      <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-2">Contact</h4>
                      <div className="space-y-1 text-sm">
                        {contactInfo.phone && <a href={`tel:${contactInfo.phone}`} className="block text-primary-600 dark:text-primary-400 hover:underline">{contactInfo.phone}</a>}
                        {contactInfo.email && <a href={`mailto:${contactInfo.email}`} className="block text-primary-600 dark:text-primary-400 hover:underline">{contactInfo.email}</a>}
                      </div>
                    </div>
                  )}
                  {showsSocialMedia && socialLinks.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-2">Social</h4>
                      <div className="flex flex-wrap gap-2">
                        {socialLinks.map((link) => (
                          <a key={link.platform} href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors">
                            {link.platform}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
