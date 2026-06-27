'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { StorefrontLayoutKey } from '@/app/products/[id]/layouts/types';

interface HybridSectionProps {
  tenantId: string;
  tenant: any;
  businessName: string;
  hybridProducts: any[];
  layoutVariant: StorefrontLayoutKey;
  hasActivePaymentGateway?: boolean;
  isSocialStore?: boolean;
  socialCommerceFlags?: { enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null;
  currentUrl?: string;
}

export function HybridSection({
  tenantId,
  tenant,
  businessName,
  hybridProducts,
  layoutVariant,
  hasActivePaymentGateway,
  isSocialStore,
  socialCommerceFlags,
  currentUrl,
}: HybridSectionProps) {
  if (hybridProducts.length === 0) return null;

  if (layoutVariant === 'immersive') {
    return <ImmersiveHybridSection {...{ tenantId, tenant, businessName, hybridProducts, hasActivePaymentGateway, layoutVariant, isSocialStore, socialCommerceFlags, currentUrl }} />;
  }

  if (layoutVariant === 'editorial') {
    return <EditorialHybridSection {...{ tenantId, tenant, businessName, hybridProducts, hasActivePaymentGateway, layoutVariant, isSocialStore, socialCommerceFlags, currentUrl }} />;
  }

  return <ClassicHybridSection {...{ tenantId, tenant, businessName, hybridProducts, hasActivePaymentGateway, layoutVariant, isSocialStore, socialCommerceFlags, currentUrl }} />;
}

function HybridCard({
  product,
  tenantId,
  layoutVariant,
}: {
  product: any;
  tenantId: string;
  layoutVariant: StorefrontLayoutKey;
}) {
  const metadata = product.metadata || {};
  const digitalComponent = metadata.digitalComponent || metadata.digital_component || product.digitalComponent;
  const physicalComponent = metadata.physicalComponent || metadata.physical_component || product.physicalComponent;
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
            alt={product.name || 'Hybrid Product'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute top-2 right-2 bg-purple-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
            Hybrid
          </div>
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold text-neutral-900 dark:text-white mb-1 line-clamp-1">
          {product.name || product.title || 'Hybrid Product'}
        </h3>
        {product.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
            {product.description}
          </p>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-neutral-500 dark:text-neutral-400 mb-3">
          {physicalComponent && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              {physicalComponent}
            </span>
          )}
          {digitalComponent && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              {digitalComponent}
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
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}

function ClassicHybridSection({
  tenantId,
  businessName,
  hybridProducts,
}: HybridSectionProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" aria-label="Hybrid products">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
          Physical + Digital Bundles
        </h2>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Products with both tangible and digital components from {businessName}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {hybridProducts.map((product: any) => (
          <HybridCard key={product.id} product={product} tenantId={tenantId} layoutVariant="classic" />
        ))}
      </div>
    </section>
  );
}

function EditorialHybridSection({
  tenantId,
  businessName,
  hybridProducts,
}: HybridSectionProps) {
  return (
    <section className="bg-neutral-50 dark:bg-neutral-950" aria-label="Hybrid products">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
            Physical + Digital Bundles
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            Products with both tangible and digital components from {businessName}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {hybridProducts.map((product: any) => (
            <HybridCard key={product.id} product={product} tenantId={tenantId} layoutVariant="editorial" />
          ))}
        </div>
      </div>
    </section>
  );
}

function ImmersiveHybridSection({
  tenantId,
  businessName,
  hybridProducts,
}: HybridSectionProps) {
  return (
    <section className="bg-white dark:bg-neutral-950 py-8" aria-label="Hybrid products">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wide">
            Physical + Digital
          </h2>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{hybridProducts.length} item{hybridProducts.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {hybridProducts.map((product: any) => (
            <HybridCard key={product.id} product={product} tenantId={tenantId} layoutVariant="immersive" />
          ))}
        </div>
      </div>
    </section>
  );
}
