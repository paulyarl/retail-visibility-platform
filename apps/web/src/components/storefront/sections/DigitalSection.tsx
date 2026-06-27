'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { StorefrontLayoutKey } from '@/app/products/[id]/layouts/types';

interface DigitalSectionProps {
  tenantId: string;
  tenant: any;
  businessName: string;
  digitalProducts: any[];
  layoutVariant: StorefrontLayoutKey;
  hasActivePaymentGateway?: boolean;
  isSocialStore?: boolean;
  socialCommerceFlags?: { enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null;
  currentUrl?: string;
}

export function DigitalSection({
  tenantId,
  tenant,
  businessName,
  digitalProducts,
  layoutVariant,
  hasActivePaymentGateway,
  isSocialStore,
  socialCommerceFlags,
  currentUrl,
}: DigitalSectionProps) {
  if (digitalProducts.length === 0) return null;

  if (layoutVariant === 'immersive') {
    return <ImmersiveDigitalSection {...{ tenantId, tenant, businessName, digitalProducts, hasActivePaymentGateway, layoutVariant, isSocialStore, socialCommerceFlags, currentUrl }} />;
  }

  if (layoutVariant === 'editorial') {
    return <EditorialDigitalSection {...{ tenantId, tenant, businessName, digitalProducts, hasActivePaymentGateway, layoutVariant, isSocialStore, socialCommerceFlags, currentUrl }} />;
  }

  return <ClassicDigitalSection {...{ tenantId, tenant, businessName, digitalProducts, hasActivePaymentGateway, layoutVariant, isSocialStore, socialCommerceFlags, currentUrl }} />;
}

function DigitalCard({
  product,
  tenantId,
  layoutVariant,
}: {
  product: any;
  tenantId: string;
  layoutVariant: StorefrontLayoutKey;
}) {
  const metadata = product.metadata || {};
  const fileType = metadata.fileType || metadata.file_type || product.fileType;
  const fileSize = metadata.fileSize || metadata.file_size || product.fileSize;
  const downloadLimit = metadata.downloadLimit || metadata.download_limit || product.downloadLimit;
  const licenseType = metadata.licenseType || metadata.license_type || product.licenseType;
  const imageUrl = product.imageUrl || product.image_url;
  const slug = product.slug || product.id;

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
            alt={product.name || 'Digital Product'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
            Digital
          </div>
        </div>
      )}
      <div className="p-4">
        {fileType && (
          <span className="inline-block text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase">
            {fileType}
          </span>
        )}
        <h3 className="font-semibold text-neutral-900 dark:text-white mb-1 line-clamp-1">
          {product.name || product.title || 'Digital Product'}
        </h3>
        {product.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
            {product.description}
          </p>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-neutral-500 dark:text-neutral-400 mb-3">
          {fileSize && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              {fileSize}
            </span>
          )}
          {licenseType && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {licenseType}
            </span>
          )}
          {downloadLimit && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {downloadLimit} downloads
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          {product.price != null && (
            <span className="text-lg font-bold text-neutral-900 dark:text-white">
              {typeof product.price === 'number' ? `$${product.price.toFixed(2)}` : product.price}
            </span>
          )}
          <Link
            href={`/products/${slug}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Get
          </Link>
        </div>
      </div>
    </div>
  );
}

function ClassicDigitalSection({
  tenantId,
  businessName,
  digitalProducts,
}: DigitalSectionProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" aria-label="Digital products">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
          Digital Downloads
        </h2>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Instant access to digital products from {businessName}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {digitalProducts.map((product: any) => (
          <DigitalCard key={product.id} product={product} tenantId={tenantId} layoutVariant="classic" />
        ))}
      </div>
    </section>
  );
}

function EditorialDigitalSection({
  tenantId,
  businessName,
  digitalProducts,
}: DigitalSectionProps) {
  return (
    <section className="bg-neutral-50 dark:bg-neutral-950" aria-label="Digital products">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
            Digital Downloads
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            Instant access to digital products from {businessName}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {digitalProducts.map((product: any) => (
            <DigitalCard key={product.id} product={product} tenantId={tenantId} layoutVariant="editorial" />
          ))}
        </div>
      </div>
    </section>
  );
}

function ImmersiveDigitalSection({
  tenantId,
  businessName,
  digitalProducts,
}: DigitalSectionProps) {
  return (
    <section className="bg-white dark:bg-neutral-950 py-8" aria-label="Digital products">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wide">
            Digital Downloads
          </h2>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{digitalProducts.length} item{digitalProducts.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {digitalProducts.map((product: any) => (
            <DigitalCard key={product.id} product={product} tenantId={tenantId} layoutVariant="immersive" />
          ))}
        </div>
      </div>
    </section>
  );
}
