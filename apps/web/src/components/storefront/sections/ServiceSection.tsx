'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BookingCTA } from '@/components/storefront/BookingCTA';
import { SocialShareButtons } from '@/components/storefront/SocialShareButtons';
import { StorefrontLayoutKey } from '@/app/products/[id]/layouts/types';

interface ServiceSectionProps {
  tenantId: string;
  tenant: any;
  businessName: string;
  services: any[];
  layoutVariant: StorefrontLayoutKey;
  isServiceStore: boolean;
  hasActivePaymentGateway?: boolean;
  isSocialStore?: boolean;
  socialCommerceFlags?: { enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null;
  currentUrl?: string;
}

export function ServiceSection({
  tenantId,
  tenant,
  businessName,
  services,
  layoutVariant,
  isServiceStore,
  hasActivePaymentGateway,
  isSocialStore,
  socialCommerceFlags,
  currentUrl,
}: ServiceSectionProps) {
  if (services.length === 0) return null;

  if (layoutVariant === 'immersive') {
    return <ImmersiveServiceSection {...{ tenantId, tenant, businessName, services, isServiceStore, hasActivePaymentGateway, layoutVariant, isSocialStore, socialCommerceFlags, currentUrl }} />;
  }

  if (layoutVariant === 'editorial') {
    return <EditorialServiceSection {...{ tenantId, tenant, businessName, services, isServiceStore, hasActivePaymentGateway, layoutVariant, isSocialStore, socialCommerceFlags, currentUrl }} />;
  }

  return <ClassicServiceSection {...{ tenantId, tenant, businessName, services, isServiceStore, hasActivePaymentGateway, layoutVariant, isSocialStore, socialCommerceFlags, currentUrl }} />;
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function ServiceCard({
  service,
  tenantId,
  layoutVariant,
}: {
  service: any;
  tenantId: string;
  layoutVariant: StorefrontLayoutKey;
}) {
  const metadata = service.metadata || {};
  const durationMinutes = metadata.duration_minutes || service.durationMinutes;
  const serviceArea = metadata.service_area || service.serviceArea;
  const providerName = metadata.provider_name || service.providerName;
  const serviceCategory = metadata.service_category || service.serviceCategory;
  const imageUrl = service.imageUrl || service.image_url;
  const slug = service.slug || service.id;

  const cardClass =
    layoutVariant === 'immersive'
      ? 'bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden'
      : layoutVariant === 'editorial'
        ? 'bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm'
        : 'bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden';

  return (
    <div className={cardClass}>
      {imageUrl && (
        <div className={`relative ${layoutVariant === 'immersive' ? 'h-32' : 'h-40'} bg-neutral-100 dark:bg-neutral-800`}>
          <Image
            src={imageUrl}
            alt={service.name || 'Service'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      )}
      <div className="p-4">
        {serviceCategory && (
          <span className="inline-block text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
            {serviceCategory}
          </span>
        )}
        <h3 className="font-semibold text-neutral-900 dark:text-white mb-1 line-clamp-1">
          {service.name || service.title || 'Service'}
        </h3>
        {service.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
            {service.description}
          </p>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-neutral-500 dark:text-neutral-400 mb-3">
          {durationMinutes && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {durationMinutes} min
            </span>
          )}
          {serviceArea && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {serviceArea}
            </span>
          )}
          {providerName && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {providerName}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          {service.price != null && (
            <span className="text-lg font-bold text-neutral-900 dark:text-white">
              {typeof service.price === 'number' ? `$${service.price.toFixed(2)}` : service.price}
            </span>
          )}
          <BookingCTA service={service} tenantId={tenantId} layoutVariant={layoutVariant} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Classic variant
// ---------------------------------------------------------------------------

function ClassicServiceSection({
  tenantId,
  businessName,
  services,
  isServiceStore,
  isSocialStore,
  socialCommerceFlags,
  currentUrl,
}: ServiceSectionProps) {
  const showShareButtons = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons) && isSocialStore;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" aria-label="Service offerings">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
          {isServiceStore ? 'Our Services' : 'Services'}
        </h2>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          {isServiceStore
            ? `Book professional services from ${businessName}`
            : `Professional services available from ${businessName}`}
        </p>
        {showShareButtons && (
          <div className="mt-3">
            <SocialShareButtons url={currentUrl || ''} title={businessName} layoutVariant="classic" />
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service: any) => (
          <ServiceCard key={service.id} service={service} tenantId={tenantId} layoutVariant="classic" />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Editorial variant
// ---------------------------------------------------------------------------

function EditorialServiceSection({
  tenantId,
  businessName,
  services,
  isServiceStore,
  isSocialStore,
  socialCommerceFlags,
  currentUrl,
}: ServiceSectionProps) {
  const showShareButtons = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons) && isSocialStore;
  return (
    <section className="bg-neutral-50 dark:bg-neutral-950" aria-label="Service offerings">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
            {isServiceStore ? 'Our Services' : 'Services'}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            {isServiceStore
              ? `Book professional services from ${businessName}`
              : `Professional services available from ${businessName}`}
          </p>
          {showShareButtons && (
            <div className="mt-4">
              <SocialShareButtons url={currentUrl || ''} title={businessName} layoutVariant="editorial" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service: any) => (
            <ServiceCard key={service.id} service={service} tenantId={tenantId} layoutVariant="editorial" />
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Immersive variant
// ---------------------------------------------------------------------------

function ImmersiveServiceSection({
  tenantId,
  businessName,
  services,
  isServiceStore,
  isSocialStore,
  socialCommerceFlags,
  currentUrl,
}: ServiceSectionProps) {
  const showShareButtons = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons) && isSocialStore;
  return (
    <section className="bg-white dark:bg-neutral-950 py-8" aria-label="Service offerings">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wide">
              {isServiceStore ? 'Services' : 'Available Services'}
            </h2>
            {showShareButtons && (
              <SocialShareButtons url={currentUrl || ''} title={businessName} layoutVariant="immersive" />
            )}
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{services.length} service{services.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {services.map((service: any) => (
            <ServiceCard key={service.id} service={service} tenantId={tenantId} layoutVariant="immersive" />
          ))}
        </div>
      </div>
    </section>
  );
}
