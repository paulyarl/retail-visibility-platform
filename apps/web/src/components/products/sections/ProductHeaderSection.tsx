'use client';

import Image from 'next/image';
import DirectoryActions from '@/components/directory/DirectoryActions';
import { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';

interface ProductHeaderSectionProps {
  product: any;
  tenantProfile: any;
  businessName: string;
  currentUrl: string;
  optFlags?: StorefrontOptionFlags | null;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function ProductHeaderSection({
  product,
  tenantProfile,
  businessName,
  currentUrl,
  optFlags,
  layoutVariant = 'classic',
}: ProductHeaderSectionProps) {
  return (
    <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Header Row */}
        <div className="flex items-center gap-4 py-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-4 flex-shrink-0 min-w-0">
            {/* Store Logo */}
            <div className="flex-shrink-0">
              {tenantProfile?.profileData?.logoUrl || tenantProfile?.profileData?.logo_url ? (
                <div className="relative w-14 h-14">
                  <Image
                    src={tenantProfile.profileData.logoUrl || tenantProfile.profileData.logo_url}
                    alt={tenantProfile.profileData.businessName || tenantProfile.profileData.business_name || businessName}
                    fill
                    className="object-contain rounded-lg shadow-sm"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center shadow-sm">
                  <svg className="w-7 h-7 text-primary-600 dark:text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              )}
            </div>

            {/* Store Name and Category */}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-neutral-900 dark:text-white truncate">
                  {tenantProfile?.profileData?.businessName || tenantProfile?.profileData?.business_name || businessName || 'Store'}
                </h1>
              </div>
              {product.category && (
                <a
                  title={`Browse to store's ${product.category.name} products`}
                  className={`group relative inline-flex items-center gap-1 px-2 py-1 rounded-full hover:opacity-100 transition-opacity cursor-pointer no-underline`}
                  href={`/tenant/${product.tenantId}?category=${product.category.slug}`}
                >
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {product.category.name}
                  </p>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="hidden sm:flex justify-end mt-3">
          {optFlags?.showStorefrontActions !== false && (
            <DirectoryActions
              listing={{
                business_name: tenantProfile?.profileData?.businessName || tenantProfile?.profileData?.business_name || '',
                slug: tenantProfile?.slug || '',
                tenantId: product.tenantId || '',
                id: product.id || ''
              }}
              currentUrl={currentUrl}
              entity_name={product.name}
              variant="product"
            />
          )}
        </div>

        {/* Mobile Navigation */}
        <div className="sm:hidden pb-3 flex items-center gap-2 overflow-x-auto">
          {optFlags?.showStorefrontActions !== false && (
            <DirectoryActions
              listing={{
                business_name: tenantProfile?.profileData?.businessName || tenantProfile?.profileData?.business_name || '',
                slug: tenantProfile?.slug || '',
                tenantId: product.tenantId || '',
                id: product.id || ''
              }}
              currentUrl={currentUrl}
              entity_name={product.name}
              variant="product"
            />
          )}
          <div className="hidden sm:flex justify-end mt-3">
            {tenantProfile?.slug && (
              <a
                href={`/tenant/${product.tenantId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>Store</span>
              </a>
            )}
            {tenantProfile?.slug && (
              <a
                href={`/directory/${tenantProfile.slug}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>Directory</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
