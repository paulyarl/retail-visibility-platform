'use client';

/**
 * StoreCardV2 — modern card with banner/logo header, name, category chip,
 * rating, distance badge, open-now HoursStatusBadge, product count,
 * and "Visit Store" button.
 *
 * Reuses useStoreStatus + HoursStatusBadge from existing components.
 * appearance prop toggles card density/size across variants.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Package, Star, ExternalLink, Navigation } from 'lucide-react';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';
import DemoBadge from '@/components/shared/DemoBadge';
import type { DirectoryStore } from '@/services/DirectorySingletonService';
import type { DirectoryLayoutKey } from './types';

interface StoreCardV2Props {
  store: DirectoryStore;
  appearance?: DirectoryLayoutKey;
}

export default function StoreCardV2({
  store,
  appearance = 'discovery',
}: StoreCardV2Props) {
  const router = useRouter();
  const { status: hoursStatus } = useStoreStatus(store.tenantId, true);

  const isImmersive = appearance === 'immersive';
  const isEditorial = appearance === 'editorial';

  // Use external link only when capability flag is set and website exists
  const canUseExternal = store.canUseExternalLink && !!store.website;
  const destinationUrl = canUseExternal
    ? (store.website as string)
    : `/directory/${store.tenantId}`;
  const isExternalLink = canUseExternal;

  const formatRating = (rating: number) =>
    rating > 0 ? rating.toFixed(1) : 'New';

  const logoUrl = store.logoUrl || store.logo;
  const bannerUrl = store.bannerUrl || store.coverImage;

  const handleDirectoryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/directory/${store.tenantId}`);
  };

  // Compact layout for immersive — always links to directory entry page
  if (isImmersive) {
    return (
      <Link
        href={`/directory/${store.tenantId}`}
        className="block group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-950 rounded-xl"
      >
        <div className="flex items-start gap-3 p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:shadow-md transition-all duration-200">
          {/* Logo */}
          <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={store.businessName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <Package className="w-6 h-6 text-neutral-300 dark:text-neutral-600" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate flex items-center gap-1.5">
                {store.businessName}
                {store.isDemo && <DemoBadge isDemo={store.isDemo} demoExpiresAt={store.demoExpiresAt} size="sm" />}
              </h3>
              {store.distance != null && (
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium shrink-0">
                  {store.distance.toFixed(1)} mi
                </span>
              )}
            </div>
            {store.primaryCategory && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {store.primaryCategory}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {store.ratingAvg > 0 && (
                <span className="flex items-center gap-0.5 text-xs">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {formatRating(store.ratingAvg)}
                  </span>
                </span>
              )}
              <HoursStatusBadge status={hoursStatus} size="xs" />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Standard grid/editorial card
  const cardSize = isEditorial ? 'sm:col-span-1' : '';

  return (
    <Link
      href={destinationUrl}
      target={isExternalLink ? '_blank' : undefined}
      rel={isExternalLink ? 'noopener noreferrer' : undefined}
      className={`block group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-950 rounded-2xl ${cardSize}`}
    >
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        {/* Banner / Logo header */}
        <div
          className={`relative ${
            isEditorial ? 'aspect-[16/10]' : 'aspect-video'
          } bg-neutral-100 dark:bg-neutral-800 overflow-hidden`}
        >
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt={store.businessName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : logoUrl ? (
            <div className="w-full h-full flex items-center justify-center p-6">
              <img
                src={logoUrl}
                alt={store.businessName}
                className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-neutral-300 dark:text-neutral-600" />
            </div>
          )}

          {/* Promoted badge */}
          {store.isPromoted && (
            <span className={`absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-white shadow-sm ${
              store.promotionTier === 'featured' ? 'bg-gradient-to-r from-purple-500 to-purple-600' :
              store.promotionTier === 'premium' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
              'bg-gradient-to-r from-amber-500 to-amber-600'
            }`}>
              <Star className="w-3 h-3 fill-white" />
              {(store.promotionTier?.charAt(0) ?? '').toUpperCase() + (store.promotionTier?.slice(1) ?? '') || 'Promoted'}
            </span>
          )}

          {/* Featured badge */}
          {store.isFeatured && !store.isPromoted && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
              <Star className="w-3 h-3 fill-white" />
              Featured
            </span>
          )}

          {/* Distance badge */}
          {store.distance != null && (
            <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-white/90 dark:bg-neutral-900/90 text-blue-700 dark:text-blue-300 backdrop-blur-sm shadow-sm">
              <Navigation className="w-3 h-3" />
              {store.distance.toFixed(1)} mi
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          {/* Name + Rating */}
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2 flex-1 flex items-center gap-1.5 ${
                isEditorial ? 'text-lg tracking-tight' : 'text-base'
              }`}
            >
              {store.businessName}
              {store.isDemo && <DemoBadge isDemo={store.isDemo} demoExpiresAt={store.demoExpiresAt} size="sm" />}
            </h3>
            {store.ratingAvg > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {formatRating(store.ratingAvg)}
                </span>
                {(store.reviewCount || store.ratingCount) && (
                  <span className="text-xs text-neutral-400">
                    ({store.reviewCount || store.ratingCount})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Category chip */}
          {store.primaryCategory && (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
              {store.primaryCategory}
            </span>
          )}

          {/* Location + Hours */}
          <div className="flex items-center gap-2 flex-wrap">
            {(store.city || store.state) && (
              <span className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                <MapPin className="w-3.5 h-3.5" />
                {store.city}
                {store.city && store.state ? ', ' : ''}
                {store.state}
              </span>
            )}
            <HoursStatusBadge status={hoursStatus} size="xs" />
          </div>

          {/* Product count + CTA */}
          <div className="flex items-center justify-between pt-2">
            <span className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
              <Package className="w-3.5 h-3.5" />
              {typeof store.productCount === 'number'
                ? store.productCount
                : store.productCount}{' '}
              {Number(store.productCount) === 1 ? 'product' : 'products'}
            </span>
            <button
              onClick={handleDirectoryClick}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Visit Store
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
