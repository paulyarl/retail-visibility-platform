'use client';

import Link from 'next/link';
import { Globe, ArrowLeft } from 'lucide-react';

import { LocalBusinessStructuredData, BreadcrumbStructuredData } from '@/components/directory/StructuredData';
import RelatedStores from '@/components/directory/RelatedStores';
import DirectoryActions from '@/components/directory/DirectoryActions';
import StoreRatingsSection from '@/components/directory/StoreRatingsSection';
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import StoreViewTracker from '@/components/tracking/StoreViewTracker';
import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';
import ContactInformationCollapsible from '@/components/directory/ContactInformationCollapsible';
import DirectoryPhotoGalleryDisplay from '@/components/directory/DirectoryPhotoGalleryDisplay';
import DirectoryMagazineGallery from '@/components/directory/DirectoryMagazineGallery';
import ProductCategoriesCollapsible from '@/components/directory/ProductCategoriesCollapsible';
import SmartProductCard from '@/components/products/SmartProductCard';
import EnhancedProductDisplay from '@/components/storefront/EnhancedProductDisplay';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import DirectoryKeywordTags from '@/components/directory/DirectoryKeywordTags';
import { StorefrontStatusPanel } from '@/components/storefront/StorefrontStatusPanel';
import { TenantQRCode } from '@/components/public/TenantQRCode';
import FaqStorefrontDisplay from '@/components/faq/FaqStorefrontDisplay';
import PublicInquiryForm from '@/components/crm/PublicInquiryForm';
import LastViewed from '@/components/directory/LastViewed';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';
import DemoBadge from '@/components/shared/DemoBadge';
import CouponSpotlight from '@/components/storefront/CouponSpotlight';

import type { DirectoryEntryLayoutProps } from './types';
import { useQrScanTracking } from '@/hooks/useQrScanTracking';

export default function DirectoryEntryClassicLayout(props: DirectoryEntryLayoutProps) {
  const {
    tenantId,
    listing,
    tenantLogo,
    businessProfile,
    businessHours,
    storefrontCategories,
    featuredProducts,
    activeFeatured,
    tenantInfo,
    slugForRelated,
    optFlags,
    showStatusPanel,
    hoursStatus,
    isRetailStore,
    showsHours,
    showsMap,
    showsLocation,
    currentUrl,
    baseUrl,
    faqFlags,
    crmFlags,
    paymentGatewayStatus,
    actualProductCount,
    fullAddress,
    isDemo,
    demoExpiresAt,
  } = props;

  // Track QR code scans when visitor arrives via QR code
  useQrScanTracking(tenantId, 'directory');

  const primaryColor = tenantInfo?.metadata?.primaryColor || tenantInfo?.metadata?.primary_color || null;

  return (
    <>
      <LocalBusinessStructuredData listing={listing} url={currentUrl} />
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: baseUrl },
          { name: 'Directory', url: `${baseUrl}/directory` },
          { name: listing.businessName, url: currentUrl },
        ]}
      />
      <StoreViewTracker tenantId={tenantId} storeName={listing.businessName} categories={listing.categories} />

      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link href="/directory" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Directory
            </Link>
            {showStatusPanel && tenantInfo ? (
              <div className="mt-4"><StorefrontStatusPanel tenantInfo={tenantInfo} /></div>
            ) : (
              <div
                className={`mt-4 border-2 rounded-xl shadow-sm overflow-hidden ${primaryColor ? '' : 'bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100 border-blue-200'}`}
                style={primaryColor ? { background: `linear-gradient(135deg, ${primaryColor}22 0%, ${primaryColor}11 50%, ${primaryColor}08 100%)`, borderColor: `${primaryColor}44` } : undefined}
              >
                <div className="px-6 py-8 sm:px-8 sm:py-10 text-center">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Shop {listing.businessName}</h2>
                  <p className="text-gray-700 mb-6 text-sm sm:text-base max-w-2xl mx-auto">
                    Browse {actualProductCount > 0 ? actualProductCount : (listing.productCount ?? 0)} products and shop directly from their online storefront
                  </p>
                  <Link href={`${slugForRelated ? `/tenant/${slugForRelated}` : `/tenant/${listing.tenantId}`}`}
                    className="inline-flex items-center gap-2 px-8 py-3 text-white rounded-lg transition-colors font-semibold text-lg shadow-md"
                    style={primaryColor ? { backgroundColor: primaryColor } : { backgroundColor: '#2563eb' }}
                  >
                    <Globe className="w-5 h-5" /> Visit Storefront
                  </Link>
                  {storefrontCategories.categories.length > 0 && (
                    <div className="mt-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                        <svg className="w-4 h-4 mr-1.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        {actualProductCount > 0 ? actualProductCount : (listing.productCount || 0)} products available
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-4 py-4 lg:px-4 lg:py-4 text-center">
                  {!showStatusPanel && showsHours && optFlags?.showHoursStatus !== false && isRetailStore && (
                    <HoursStatusBadge status={hoursStatus} size="lg" animate={optFlags?.showAnimatedHours !== false} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Coupon Spotlight Card */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 relative z-20 mb-4">
          <CouponSpotlight tenantId={listing.tenantId} coupon={null} variant="card" />
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="space-y-6">
              {/* Store Header */}
              {tenantLogo && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-start gap-6">
                    {listing.logoUrl && (
                      <img src={listing.logoUrl} alt={listing.businessName} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                        {listing.businessName}
                        <DemoBadge isDemo={isDemo} demoExpiresAt={demoExpiresAt} size="md" />
                      </h1>
                      {tenantInfo && listing.categories && listing.categories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {listing.categories.sort((a: any, b: any) => {
                            if (a.isPrimary && !b.isPrimary) return -1;
                            if (!a.isPrimary && b.isPrimary) return 1;
                            return a.name.localeCompare(b.name);
                          }).map((category: any, index: number) => (
                            <Link key={category.id || index} href={`/directory/categories/${category.slug}`}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${category.isPrimary ? 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200' : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'}`}
                              title={`Browse all ${category.name} stores`}>
                              <span>{category.name}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      <div id="gallery-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
                      {listing.keywords && listing.keywords.length > 0 && (
                        <div className="mt-3"><DirectoryKeywordTags keywords={listing.keywords} /></div>
                      )}
                    </div>
                  </div>
                  {!showStatusPanel && showsHours && isRetailStore && (
                    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                      <a href={`/tenant/${slugForRelated || listing.tenantId}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 transition-colors whitespace-nowrap"
                        title="View Store Products">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                        <span className="hidden lg:inline">Products</span>
                      </a>
                      <a href={`/shops/${slugForRelated || listing.tenantId}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 transition-colors whitespace-nowrap"
                        title="View Store in Shops">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 000 4zm0 0v10a2 2 0 002 2h2a1 1 0 011 1v5m-4 0h4z" /></svg>
                        <span className="hidden lg:inline">Shop</span>
                      </a>
                      <a onClick={() => { const el = document.getElementById('hours-section'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200 transition-colors whitespace-nowrap"
                        title="View Store Hours">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="hidden lg:inline">Hours</span>
                      </a>
                      {!showStatusPanel && optFlags?.showStorefrontActions !== false && (
                        <DirectoryActions listing={{ business_name: listing.businessName, slug: listing.slug, tenantId: listing.tenantId, id: listing.id }} currentUrl={currentUrl} />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Active Featured Products (from ActiveFeaturedResolver) */}
              {!showStatusPanel && activeFeatured?.hasActive && activeFeatured.products.length > 0 && (
                <TenantPaymentProvider tenantId={listing.tenantId}>
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-3">Featured</h2>
                    <EnhancedProductDisplay
                      products={activeFeatured.products as any}
                      tenantId={listing.tenantId}
                      displayMode="carousel"
                      carouselItemsVisible={4}
                      variant="grid"
                    />
                  </div>
                </TenantPaymentProvider>
              )}

              {/* Featured Products */}
              {!showStatusPanel && featuredProducts.length > 0 && (
                <TenantPaymentProvider tenantId={listing.tenantId}>
                  <div id="products-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-green-500 to-transparent" />
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-gray-900">Store Selections</h2>
                      <Link href={`/tenant/${slugForRelated || listing.tenantId}`} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All Products →</Link>
                    </div>
                    <div className="space-y-6">
                      {(() => {
                        const productTypeOrder = ['physical', 'digital', 'service', 'hybrid'] as const;
                        const productTypeLabels: Record<string, string> = {
                          physical: 'Physical Products',
                          digital: 'Digital Products',
                          service: 'Service Products',
                          hybrid: 'Hybrid Products',
                        };
                        const grouped = productTypeOrder.reduce((acc, pt) => {
                          acc[pt] = featuredProducts.filter((p: any) => (p.productType || 'physical') === pt);
                          return acc;
                        }, {} as Record<string, any[]>);
                        const otherProducts = featuredProducts.filter((p: any) => {
                          const pt = p.productType || 'physical';
                          return !productTypeOrder.includes(pt as any);
                        });

                        return (
                          <>
                            {productTypeOrder.map(pt => {
                              const group = grouped[pt];
                              if (!group || group.length === 0) return null;
                              return (
                                <div key={pt}>
                                  <h3 className="text-sm font-semibold text-gray-700 mb-3">{productTypeLabels[pt]}</h3>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {group.map((product: any) => (
                                      <SmartProductCard
                                        key={`directory-featured-${product.id}`}
                                        tenantId={listing.tenantId}
                                        product={{
                                          id: product.id, sku: product.sku || product.id,
                                          name: product.name || product.title, title: product.title || product.name,
                                          brand: product.brand, description: product.description,
                                          priceCents: product.priceCents || Math.round((product.price || 0) * 100),
                                          salePriceCents: product.salePriceCents, stock: product.stock || 999,
                                          imageUrl: product.imageUrl || product.image_url, tenantId: listing.tenantId,
                                          availability: product.availability || 'in_stock',
                                          tenantCategory: product.tenantCategory, productCategory: product.category_name,
                                          has_variants: product.has_variants,
                                          payment_gateway_type: paymentGatewayStatus.defaultGatewayType,
                                          featuredType: product.featuredType,
                                          featuredTypes: product.featuredTypes || (product.featuredType ? [product.featuredType] : []),
                                          productType: product.productType || 'physical',
                                        }}
                                        tenantName={listing.businessName}
                                        tenantLogo={tenantLogo?.toString() || listing.logoUrl}
                                        defaultGatewayType={paymentGatewayStatus.defaultGatewayType || undefined}
                                        variant="featured" showCategory={true} showDescription={true}
                                      />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}

                            {otherProducts.length > 0 && (
                              <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">Other Products</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                  {otherProducts.map((product: any) => (
                                    <SmartProductCard
                                      key={`directory-featured-${product.id}`}
                                      tenantId={listing.tenantId}
                                      product={{
                                        id: product.id, sku: product.sku || product.id,
                                        name: product.name || product.title, title: product.title || product.name,
                                        brand: product.brand, description: product.description,
                                        priceCents: product.priceCents || Math.round((product.price || 0) * 100),
                                        salePriceCents: product.salePriceCents, stock: product.stock || 999,
                                        imageUrl: product.imageUrl || product.image_url, tenantId: listing.tenantId,
                                        availability: product.availability || 'in_stock',
                                        tenantCategory: product.tenantCategory, productCategory: product.category_name,
                                        has_variants: product.has_variants,
                                        payment_gateway_type: paymentGatewayStatus.defaultGatewayType,
                                        featuredType: product.featuredType,
                                        featuredTypes: product.featuredTypes || (product.featuredType ? [product.featuredType] : []),
                                        productType: product.productType || 'physical',
                                      }}
                                      tenantName={listing.businessName}
                                      tenantLogo={tenantLogo?.toString() || listing.logoUrl}
                                      defaultGatewayType={paymentGatewayStatus.defaultGatewayType || undefined}
                                      variant="featured" showCategory={true} showDescription={true}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </TenantPaymentProvider>
              )}

              {/* Business Description */}
              {(!showStatusPanel && (businessProfile?.business_description || businessProfile?.businessDescription)) && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">About {listing.businessName}</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-700 leading-relaxed text-base whitespace-pre-wrap">
                      {((businessProfile.business_description || businessProfile.businessDescription)?.length || 0) > 200
                        ? `${(businessProfile.business_description || businessProfile.businessDescription)?.substring(0, 200)}...`
                        : (businessProfile.business_description || businessProfile.businessDescription)}
                    </p>
                  </div>
                </div>
              )}

              {/* Photo Gallery */}
              {!showStatusPanel && (
                optFlags?.canUseMagazineGallery && optFlags?.galleryDisplayMode === 'magazine' ? (
                  <DirectoryMagazineGallery listing={listing} {...businessProfile} isPublished={true} />
                ) : (
                  <DirectoryPhotoGalleryDisplay listing={listing} {...businessProfile} isPublished={true} />
                )
              )}

              {/* Product Categories */}
              {!showStatusPanel && storefrontCategories.categories.length > 0 && (
                <div className="space-y-4">
                  <ProductCategoriesCollapsible categories={storefrontCategories.categories} tenantId={listing.tenantId} uncategorizedCount={storefrontCategories.uncategorizedCount} />
                  <TenantQRCode url={currentUrl} tenantId={listing.tenantId} label="Scan to Share"
                    downloadName={listing.businessName?.toLowerCase().replace(/[^a-z0-9]/g, '-')}
                    size={200} showDownload={true} className="mt-4" pageType="directory" capabilityFlags={optFlags} />
                </div>
              )}

              {/* FAQ */}
              {faqFlags?.faq_enabled && faqFlags?.faq_display_storefront_accordion && tenantId && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <FaqStorefrontDisplay tenantId={tenantId}
                    enabled={faqFlags.faq_enabled && faqFlags.faq_display_storefront_accordion}
                    feedbackEnabled={faqFlags.faq_enabled && faqFlags.faq_display_feedback}
                    defaultExpanded={false} />
                </div>
              )}

              {/* Reviews */}
              {!showStatusPanel && <div id="reviews-section" className="flex w-full"><StoreRatingsSection tenantId={listing.tenantId} showWriteReview={true} /></div>}
            </div>

            {/* Right Column */}
            {!showStatusPanel && showsHours && optFlags?.showContact !== false && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact</h2>
                  <ContactInformationCollapsible tenant={listing} fullAddress={showsLocation ? fullAddress : ''} initialExpanded={true} isRetailStore={isRetailStore} />
                  <div id="contact-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
                  {/* Social Links */}
                  {optFlags?.showSocialMedia !== false && (businessProfile?.social_links || businessProfile?.socialLinks) && Object.keys(businessProfile.social_links || businessProfile.socialLinks).length > 0 && (
                    <div className="pt-3 border-t border-neutral-200 mt-3">
                      <h2 className="text-lg font-semibold text-neutral-500 mb-3">Follow Us</h2>
                      <div className="flex flex-wrap gap-4">
                        {(businessProfile.social_links?.facebook || businessProfile.socialLinks?.facebook) && (
                          <a href={businessProfile.social_links?.facebook || businessProfile.socialLinks?.facebook} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700" title="Facebook">Facebook</a>
                        )}
                        {(businessProfile.social_links?.instagram || businessProfile.socialLinks?.instagram) && (
                          <a href={businessProfile.social_links?.instagram || businessProfile.socialLinks?.instagram} target="_blank" rel="noopener noreferrer"
                            className="text-pink-600 hover:text-pink-700" title="Instagram">Instagram</a>
                        )}
                        {(businessProfile.social_links?.twitter || businessProfile.socialLinks?.twitter) && (
                          <a href={businessProfile.social_links?.twitter || businessProfile.socialLinks?.twitter} target="_blank" rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-500" title="Twitter/X">Twitter/X</a>
                        )}
                        {(businessProfile.social_links?.linkedin || businessProfile.socialLinks?.linkedin) && (
                          <a href={businessProfile.social_links?.linkedin || businessProfile.socialLinks?.linkedin} target="_blank" rel="noopener noreferrer"
                            className="text-blue-700 hover:text-blue-800" title="LinkedIn">LinkedIn</a>
                        )}
                        {(businessProfile.social_links?.youtube || businessProfile.socialLinks?.youtube) && (
                          <a href={businessProfile.social_links?.youtube || businessProfile.socialLinks?.youtube} target="_blank" rel="noopener noreferrer"
                            className="text-red-600 hover:text-red-700" title="YouTube">YouTube</a>
                        )}
                        {(businessProfile.social_links?.tiktok || businessProfile.socialLinks?.tiktok) && (
                          <a href={businessProfile.social_links?.tiktok || businessProfile.socialLinks?.tiktok} target="_blank" rel="noopener noreferrer"
                            className="text-gray-700 hover:text-gray-800" title="TikTok">TikTok</a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Business Hours */}
            {!showStatusPanel && showsHours && optFlags?.showHoursStatus !== false && businessHours && isRetailStore && (
              <>
                <BusinessHoursCollapsible businessHours={businessHours} isRetailStore={isRetailStore} />
                <div id="hours-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
              </>
            )}

            {/* Map */}
            {!showStatusPanel && showsMap && optFlags?.showInteractiveMaps !== false && listing.address && isRetailStore && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div id="map-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Our Location</h2>
                <GoogleMapEmbed address={listing.address} />
              </div>
            )}

            {/* Inquiry Form */}
            {crmFlags?.crm_enabled && crmFlags?.crm_inquiry_directory_enabled && !showStatusPanel && tenantId && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Send an Inquiry</h3>
                    <p className="text-xs text-neutral-500">Ask {listing.businessName || listing.name || 'this store'} a question</p>
                  </div>
                </div>
                <PublicInquiryForm tenantId={tenantId} tenantName={listing.businessName || listing.name} sourceLabel="Directory" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related Stores */}
      {!showStatusPanel && <RelatedStores currentSlug={slugForRelated} limit={3} title="Similar Stores" />}

      {/* Recently Viewed */}
      {optFlags?.showRecentlyViewed !== false && <LastViewed />}

      {/* Footer */}
      <PoweredByFooter />
    </>
  );
}
