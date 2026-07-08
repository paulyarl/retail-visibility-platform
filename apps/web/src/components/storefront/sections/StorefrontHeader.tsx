'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';
import DirectoryActions from '@/components/directory/DirectoryActions';
import GBPCategoryBadges from '@/components/shared/GBPCategoryBadges';
import StickySearchBar from '@/app/tenant/[id]/layouts/shared/StickySearchBar';
import TrustSignalsBar from '@/app/tenant/[id]/layouts/shared/TrustSignalsBar';
import { StorefrontLayoutKey } from '@/app/products/[id]/layouts/types';
import DemoBadge from '@/components/shared/DemoBadge';

interface StorefrontHeaderProps {
  tenantId: string;
  tenant: any;
  businessName: string;
  logoUrl: string | null;
  layoutVariant: StorefrontLayoutKey;
  storefrontStatus: { shouldShowPanel: boolean; tenant?: any };
  isRetailStore: boolean;
  directoryPublished: boolean;
  tenantSlug: string;
  primaryGBPCategory: any;
  secondaryGBPCategories: any[];
  hoursStatus: any;
  showsHours: boolean;
  showsHoursStatus: boolean;
  showsAnimatedHours: boolean;
  showsCategoryStore: boolean;
  showsStorefrontActions: boolean;
  showsSocialMedia: boolean;
  cartTotalItems: number;
  handleViewCart: () => void;
  currentUrl: string;
  primaryColor?: string;
  shippingText?: string;
}

export function StorefrontHeader({
  tenantId,
  tenant,
  businessName,
  logoUrl,
  layoutVariant,
  storefrontStatus,
  isRetailStore,
  directoryPublished,
  tenantSlug,
  primaryGBPCategory,
  secondaryGBPCategories,
  hoursStatus,
  showsHours,
  showsHoursStatus,
  showsAnimatedHours,
  showsCategoryStore,
  showsStorefrontActions,
  showsSocialMedia,
  cartTotalItems,
  handleViewCart,
  currentUrl,
  primaryColor = '#6366f1',
  shippingText,
}: StorefrontHeaderProps) {
  if (layoutVariant === 'immersive') {
    return (
      <ImmersiveHeader
        tenantId={tenantId}
        tenant={tenant}
        businessName={businessName}
        logoUrl={logoUrl}
        storefrontStatus={storefrontStatus}
        cartTotalItems={cartTotalItems}
        handleViewCart={handleViewCart}
        showsHoursStatus={showsHoursStatus}
        hoursStatus={hoursStatus}
        showsAnimatedHours={showsAnimatedHours}
        primaryColor={primaryColor}
        shippingText={shippingText}
      />
    );
  }

  if (layoutVariant === 'editorial') {
    return (
      <EditorialHeader
        tenantId={tenantId}
        tenant={tenant}
        businessName={businessName}
        logoUrl={logoUrl}
        storefrontStatus={storefrontStatus}
        isRetailStore={isRetailStore}
        tenantSlug={tenantSlug}
        primaryGBPCategory={primaryGBPCategory}
        showsCategoryStore={showsCategoryStore}
        showsHours={showsHours}
        showsHoursStatus={showsHoursStatus}
        showsAnimatedHours={showsAnimatedHours}
        showsStorefrontActions={showsStorefrontActions}
        hoursStatus={hoursStatus}
        cartTotalItems={cartTotalItems}
        handleViewCart={handleViewCart}
        currentUrl={currentUrl}
      />
    );
  }

  return (
    <ClassicHeader
      tenantId={tenantId}
      tenant={tenant}
      businessName={businessName}
      logoUrl={logoUrl}
      storefrontStatus={storefrontStatus}
      isRetailStore={isRetailStore}
      directoryPublished={directoryPublished}
      tenantSlug={tenantSlug}
      primaryGBPCategory={primaryGBPCategory}
      secondaryGBPCategories={secondaryGBPCategories}
      showsCategoryStore={showsCategoryStore}
      showsHours={showsHours}
      showsHoursStatus={showsHoursStatus}
      showsAnimatedHours={showsAnimatedHours}
      showsStorefrontActions={showsStorefrontActions}
      hoursStatus={hoursStatus}
      cartTotalItems={cartTotalItems}
      handleViewCart={handleViewCart}
      currentUrl={currentUrl}
      showsSocialMedia={showsSocialMedia}
    />
  );
}

// ---------------------------------------------------------------------------
// Classic variant
// ---------------------------------------------------------------------------

function ClassicHeader({
  tenantId,
  tenant,
  businessName,
  logoUrl,
  storefrontStatus,
  isRetailStore,
  directoryPublished,
  tenantSlug,
  primaryGBPCategory,
  secondaryGBPCategories,
  showsCategoryStore,
  showsHours,
  showsHoursStatus,
  showsAnimatedHours,
  showsStorefrontActions,
  hoursStatus,
  cartTotalItems,
  handleViewCart,
  currentUrl,
}: Omit<StorefrontHeaderProps, 'layoutVariant' | 'primaryColor' | 'shippingText'>) {
  return (
    <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Header Row */}
        <div className="flex items-center gap-4 py-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-4 flex-shrink-0 min-w-0">
            <div className="flex-shrink-0">
              {logoUrl ? (
                <div className="relative w-14 h-14">
                  <Image src={logoUrl} alt={businessName} fill className="object-contain rounded-lg shadow-sm" sizes="56px" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center shadow-sm">
                  <svg className="w-7 h-7 text-primary-600 dark:text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-neutral-900 dark:text-white truncate">
                  {businessName || 'Store Name Not Available'}
                </h1>
              </div>
              {primaryGBPCategory && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {primaryGBPCategory.name}
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
              {!storefrontStatus.shouldShowPanel && directoryPublished && tenantSlug && isRetailStore && (
                <a href={`/directory/${tenantSlug}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap" title="View Store in Directory">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4z" /></svg>
                  <span className="hidden lg:inline">Directory</span>
                </a>
              )}
              {!storefrontStatus.shouldShowPanel && directoryPublished && tenantSlug && isRetailStore && (
                <a href={`/shops/${tenantSlug}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap" title="View Store in Shops">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 000 4zm0 0v10a2 2 0 002 2h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4z" /></svg>
                  <span className="hidden lg:inline">Shop</span>
                </a>
              )}
              {!storefrontStatus.shouldShowPanel && directoryPublished && tenantSlug && isRetailStore && (
                <a onClick={() => { const el = document.getElementById('hours-section'); el?.scrollIntoView({ behavior: 'smooth' }); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap" title="View Store Hours">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="hidden lg:inline">Hours</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Category Badges */}
        {primaryGBPCategory && isRetailStore && showsCategoryStore && (
          <div className="flex-1">
            <GBPCategoryBadges categories={[primaryGBPCategory, ...secondaryGBPCategories]} showCount={true} size="sm" />
          </div>
        )}

        {/* Action Buttons */}
        {!storefrontStatus.shouldShowPanel && tenantSlug && (
          <div className="hidden sm:flex justify-end mt-3">
            {showsHours && showsHoursStatus && isRetailStore && (
              <HoursStatusBadge status={hoursStatus} size="lg" animate={showsAnimatedHours} />
            )}
            {showsStorefrontActions && (
              <DirectoryActions listing={{ business_name: tenant.name, slug: tenant.slug, tenantId: tenant.id, id: tenant.id }} currentUrl={currentUrl} />
            )}
          </div>
        )}

        {/* Mobile Navigation */}
        <div className="sm:hidden pb-3 flex items-center gap-2 overflow-x-auto">
          {!storefrontStatus.shouldShowPanel && directoryPublished && tenantSlug && isRetailStore && (
            <a href={`/directory/${tenantSlug}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              <span>Directory</span>
            </a>
          )}
          {!storefrontStatus.shouldShowPanel && directoryPublished && tenantSlug && isRetailStore && (
            <a href={`/shops/${tenantSlug}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 000 4zm0 0v10a2 2 0 002 2h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4z" /></svg>
              <span>Shop</span>
            </a>
          )}
          {!storefrontStatus.shouldShowPanel && (
            <a onClick={() => { const el = document.getElementById('reviews-section'); el?.scrollIntoView({ behavior: 'smooth' }); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap" title="View Store Reviews">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              <span className="hidden lg:inline">Reviews</span>
            </a>
          )}
          {!storefrontStatus.shouldShowPanel && showsHours && isRetailStore && (
            <a onClick={() => { const el = document.getElementById('hours-section'); el?.scrollIntoView({ behavior: 'smooth' }); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap" title="View Store Hours">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="hidden lg:inline">Hours</span>
            </a>
          )}
          {!storefrontStatus.shouldShowPanel && (
            <a onClick={handleViewCart} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap" title="View Shopping Cart">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 014 4z" /></svg>
              {cartTotalItems > 0 && (
                <span className="flex -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full items-center justify-center border-2 border-white">
                  {cartTotalItems > 99 ? '99+' : cartTotalItems}
                </span>
              )}
              <span className="hidden lg:inline">Cart</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Editorial variant
// ---------------------------------------------------------------------------

function EditorialHeader({
  tenantId,
  tenant,
  businessName,
  logoUrl,
  storefrontStatus,
  isRetailStore,
  tenantSlug,
  primaryGBPCategory,
  showsCategoryStore,
  showsHours,
  showsHoursStatus,
  showsAnimatedHours,
  showsStorefrontActions,
  hoursStatus,
  cartTotalItems,
  handleViewCart,
  currentUrl,
}: Omit<StorefrontHeaderProps, 'layoutVariant' | 'primaryColor' | 'shippingText' | 'directoryPublished' | 'secondaryGBPCategories' | 'showsSocialMedia'>) {
  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200/60 dark:border-neutral-700/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          {/* Logo (left) */}
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <div className="relative w-9 h-9 flex-shrink-0">
                <Image src={logoUrl} alt={businessName} fill className="object-contain rounded" sizes="36px" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center flex-shrink-0">
                <span className="text-primary-600 dark:text-primary-300 font-bold text-sm">
                  {businessName?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <span className="font-semibold text-neutral-900 dark:text-white truncate text-sm sm:text-base">
              {businessName}
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {cartTotalItems > 0 && (
              <button onClick={handleViewCart} className="relative p-2 rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" aria-label={`View cart with ${cartTotalItems} items`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 bg-primary-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {cartTotalItems > 99 ? '99+' : cartTotalItems}
                </span>
              </button>
            )}

            {showsStorefrontActions && tenantSlug && (
              <DirectoryActions
                listing={{ business_name: tenant.name, slug: tenant.slug, tenantId: tenant.id, id: tenant.id }}
                currentUrl={currentUrl}
              />
            )}
          </div>
        </div>

        {/* Thin trust bar */}
        <div className="flex items-center gap-3 pb-2 text-xs text-neutral-500 dark:text-neutral-400">
          {showsHours && showsHoursStatus && isRetailStore && (
            <HoursStatusBadge status={hoursStatus} size="sm" animate={showsAnimatedHours} />
          )}
          {hoursStatus?.label && (
            <span className="hidden sm:inline">· {hoursStatus.label}</span>
          )}
          {primaryGBPCategory && isRetailStore && showsCategoryStore && (
            <span className="hidden sm:inline">· {primaryGBPCategory.name}</span>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Immersive variant
// ---------------------------------------------------------------------------

function ImmersiveHeader({
  tenantId,
  tenant,
  businessName,
  logoUrl,
  storefrontStatus,
  cartTotalItems,
  handleViewCart,
  showsHoursStatus,
  hoursStatus,
  showsAnimatedHours,
  primaryColor,
  shippingText,
}: Pick<StorefrontHeaderProps, 'tenantId' | 'tenant' | 'businessName' | 'logoUrl' | 'storefrontStatus' | 'cartTotalItems' | 'handleViewCart' | 'showsHoursStatus' | 'hoursStatus' | 'showsAnimatedHours' | 'primaryColor' | 'shippingText'>) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  React.useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 transition-all duration-200 ${
      isScrolled
        ? 'bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-sm border-b border-neutral-200 dark:border-neutral-800'
        : 'bg-white dark:bg-neutral-950 border-b border-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 gap-3">
          <Link href={`/tenant/${tenantId}`} className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
            {logoUrl ? (
              <div className="relative w-8 h-8 flex-shrink-0">
                <Image src={logoUrl} alt={businessName} fill className="object-contain rounded" sizes="32px" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                <span className="text-white font-bold text-sm">{businessName?.charAt(0)?.toUpperCase() || '?'}</span>
              </div>
            )}
            <span className="font-semibold text-sm text-neutral-900 dark:text-white truncate hidden sm:block">{businessName}</span>
            <DemoBadge isDemo={tenant?.isDemo} demoExpiresAt={tenant?.demoExpiresAt} size="sm" />
          </Link>

          <div className="hidden md:block flex-1 max-w-md mx-4">
            <StickySearchBar tenantId={tenantId} placeholder="Search products..." />
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button onClick={handleViewCart} className="relative p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" aria-label="View cart">
              <svg className="w-5 h-5 text-neutral-700 dark:text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              {cartTotalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartTotalItems > 99 ? '99+' : cartTotalItems}
                </span>
              )}
            </button>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" aria-label="Toggle menu">
              <svg className="w-5 h-5 text-neutral-700 dark:text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden pb-3 border-t border-neutral-100 dark:border-neutral-800 pt-3 space-y-3">
            <StickySearchBar tenantId={tenantId} placeholder="Search products..." />
            <TrustSignalsBar tenantId={tenantId} shippingText={shippingText} showHours={showsHoursStatus} showRating showShipping={!!shippingText} className="px-1" />
          </div>
        )}
      </div>

      <div className="hidden md:block border-t border-neutral-100 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-1.5">
          <TrustSignalsBar tenantId={tenantId} shippingText={shippingText} showHours={showsHoursStatus} showRating showShipping={!!shippingText} />
        </div>
      </div>
    </header>
  );
}
