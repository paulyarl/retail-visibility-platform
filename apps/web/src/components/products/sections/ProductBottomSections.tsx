'use client';

import React from 'react';
import Link from 'next/link';
import { ProductDetailTabs } from '@/app/products/[id]/layouts/shared/ProductDetailTabs';
import ProductActions from '@/components/products/ProductActions';
import { StorefrontStatusPanel } from '@/components/storefront/StorefrontStatusPanel';
import TenantMapSection from '@/components/tenant/TenantMapSection';
import { ChevronDown, MapPin, Phone, Clock } from 'lucide-react';

type LayoutVariant = 'classic' | 'showcase' | 'quick-commerce';

interface ProductBottomSectionsProps {
  product: any;
  tenant: any;
  layoutVariant?: LayoutVariant;
  safeFeatures: any;
  resolvedCurrentUrl: string;
  showsLocation: boolean;
  showsMap: boolean;
  showsHours: boolean;
  isRetailStore: boolean;
  isOnlineStore: boolean;
  showStatusPanel: boolean;
  hoursStatus: any;
}

export function ProductBottomSections({
  product,
  tenant,
  layoutVariant = 'showcase',
  safeFeatures,
  resolvedCurrentUrl,
  showsLocation,
  showsMap,
  showsHours,
  isRetailStore,
  isOnlineStore,
  showStatusPanel,
  hoursStatus,
}: ProductBottomSectionsProps) {
  const isQuickCommerce = layoutVariant === 'quick-commerce';
  const sectionClass = isQuickCommerce
    ? 'bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden'
    : 'bg-white dark:bg-neutral-900 rounded-xl shadow-sm overflow-hidden';
  const mbClass = isQuickCommerce ? 'mb-6' : 'mb-8';

  return (
    <>
      {/* Product Detail Tabs */}
      <section className={`${sectionClass} ${mbClass}`}>
        <ProductDetailTabs
          product={product}
          showMarketingDescription={safeFeatures.customMarketingDescription}
          displayMode={isQuickCommerce ? 'accordion' : 'tabs'}
        />
      </section>

      {/* Product Actions */}
      <section className={mbClass}>
        <ProductActions
          product={product}
          tenant={tenant}
          productUrl={resolvedCurrentUrl}
          variant="product"
          showHours={showsHours}
          showLocation={showsLocation}
          showMap={showsMap}
          isRetailStore={isRetailStore}
        />
      </section>

      {/* Store Info Accordion (quick-commerce only) */}
      {isQuickCommerce && showsLocation && !isOnlineStore && tenant && !showStatusPanel && (
        <section className="mb-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <details className="group">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">Store Information</span>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-500 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="px-4 pb-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-400 border-t border-neutral-100 dark:border-neutral-800 pt-3">
              {(tenant.metadata?.businessName || tenant.name) && (
                <p className="font-medium text-neutral-800 dark:text-neutral-200">{tenant.metadata?.businessName || tenant.name}</p>
              )}
              {tenant.metadata?.address && (
                <p className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-neutral-400" />
                  <span>{tenant.metadata?.address}</span>
                </p>
              )}
              {tenant.metadata?.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 flex-shrink-0 text-neutral-400" />
                  <span>{tenant.metadata?.phone}</span>
                </p>
              )}
              {showsHours && hoursStatus && (
                <p className="flex items-center gap-2">
                  <Clock className="w-4 h-4 flex-shrink-0 text-neutral-400" />
                  <span className={hoursStatus.status === 'open' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {hoursStatus.status === 'open' ? 'Open now' : 'Closed'}
                  </span>
                </p>
              )}
              <Link
                href={`/tenant/${product.tenantId}`}
                className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium"
              >
                Visit store page →
              </Link>
            </div>
          </details>
        </section>
      )}

      {/* Status Panel */}
      {showStatusPanel && (
        <section className={mbClass}>
          <StorefrontStatusPanel tenantId={product.tenantId} tenantInfo={tenant as any} />
        </section>
      )}

      {/* Map Section (quick-commerce only) */}
      {isQuickCommerce && showsMap && tenant?.metadata?.location && (
        <section className="mb-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <TenantMapSection location={tenant.metadata.location} className="h-48" />
        </section>
      )}
    </>
  );
}
