'use client';

import Link from 'next/link';
import { Globe, ArrowLeft, Crown } from 'lucide-react';

import { LocalBusinessStructuredData, BreadcrumbStructuredData } from '@/components/directory/StructuredData';
import RelatedStores from '@/components/directory/RelatedStores';
import StoreRatingsSection from '@/components/directory/StoreRatingsSection';
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import StoreViewTracker from '@/components/tracking/StoreViewTracker';
import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';
import ContactInformationCollapsible from '@/components/directory/ContactInformationCollapsible';
import DirectoryPhotoGalleryDisplay from '@/components/directory/DirectoryPhotoGalleryDisplay';
import ProductCategoriesCollapsible from '@/components/directory/ProductCategoriesCollapsible';
import SmartProductCard from '@/components/products/SmartProductCard';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import DirectoryKeywordTags from '@/components/directory/DirectoryKeywordTags';
import { StorefrontStatusPanel } from '@/components/storefront/StorefrontStatusPanel';
import { TenantQRCode } from '@/components/public/TenantQRCode';
import FaqStorefrontDisplay from '@/components/faq/FaqStorefrontDisplay';
import PublicInquiryForm from '@/components/crm/PublicInquiryForm';
import LastViewed from '@/components/directory/LastViewed';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';

import type { DirectoryEntryLayoutProps } from './types';

export default function DirectoryEntryPremiumLayout(props: DirectoryEntryLayoutProps) {
  const {
    tenantId, listing, tenantLogo, businessProfile, businessHours,
    storefrontCategories, featuredProducts, tenantInfo, slugForRelated,
    optFlags, showStatusPanel, hoursStatus, isRetailStore, showsHours,
    showsMap, showsLocation, currentUrl, baseUrl, faqFlags, crmFlags,
    paymentGatewayStatus, actualProductCount, fullAddress,
  } = props;

  return (
    <>
      <LocalBusinessStructuredData listing={listing} url={currentUrl} />
      <BreadcrumbStructuredData items={[
        { name: 'Home', url: baseUrl },
        { name: 'Directory', url: `${baseUrl}/directory` },
        { name: listing.businessName, url: currentUrl },
      ]} />
      <StoreViewTracker tenantId={tenantId} storeName={listing.businessName} categories={listing.categories} />

      <div className="min-h-screen bg-stone-50">
        {/* Premium Header Band */}
        <div className="bg-stone-900 text-stone-100">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <Link href="/directory" className="inline-flex items-center text-sm text-stone-400 hover:text-white transition-colors mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" /> Directory
            </Link>
            {showStatusPanel && tenantInfo ? (
              <StorefrontStatusPanel tenantInfo={tenantInfo} />
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex items-center gap-5">
                  {listing.logoUrl && (
                    <img src={listing.logoUrl} alt={listing.businessName} className="w-20 h-20 rounded-full object-cover ring-2 ring-amber-500/50" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-amber-400" />
                      <h1 className="text-3xl font-light tracking-wide">{listing.businessName}</h1>
                    </div>
                    {listing.categories && listing.categories.length > 0 && (
                      <p className="text-stone-400 mt-1">
                        {listing.categories.filter((c: any) => c.isPrimary).map((c: any) => c.name).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/tenant/${slugForRelated || listing.tenantId}`}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-stone-900 rounded-lg hover:bg-amber-400 transition-colors font-semibold text-sm">
                    <Globe className="w-4 h-4" /> Storefront
                  </Link>
                  {!showStatusPanel && showsHours && optFlags?.showHoursStatus !== false && isRetailStore && (
                    <HoursStatusBadge status={hoursStatus} size="lg" animate={optFlags?.showAnimatedHours !== false} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hero Image Band */}
        {listing.coverImageUrl && (
          <div className="w-full h-64 sm:h-80">
            <img src={listing.coverImageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Content */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          {listing.keywords && listing.keywords.length > 0 && (
            <div className="mb-8"><DirectoryKeywordTags keywords={listing.keywords} /></div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12">
              {/* About */}
              {(businessProfile?.business_description || businessProfile?.businessDescription) && (
                <section className="border-l-2 border-amber-500 pl-6">
                  <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">About</h2>
                  <p className="text-stone-800 leading-relaxed text-lg whitespace-pre-wrap">
                    {businessProfile.business_description || businessProfile.businessDescription}
                  </p>
                </section>
              )}

              {/* Gallery */}
              {!showStatusPanel && <DirectoryPhotoGalleryDisplay listing={listing} {...businessProfile} isPublished={true} />}

              {/* Featured Products */}
              {!showStatusPanel && featuredProducts.length > 0 && (
                <TenantPaymentProvider tenantId={listing.tenantId}>
                  <section>
                    <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-6">Featured Products</h2>
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
                                  <h3 className="text-sm font-semibold text-stone-600 mb-3">{productTypeLabels[pt]}</h3>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {group.map((product: any) => (
                                      <SmartProductCard key={`premium-${product.id}`} tenantId={listing.tenantId}
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
                                        tenantName={listing.businessName} tenantLogo={tenantLogo?.toString() || listing.logoUrl}
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
                                <h3 className="text-sm font-semibold text-stone-600 mb-3">Other Products</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                  {otherProducts.map((product: any) => (
                                    <SmartProductCard key={`premium-${product.id}`} tenantId={listing.tenantId}
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
                                      tenantName={listing.businessName} tenantLogo={tenantLogo?.toString() || listing.logoUrl}
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
                    <div className="mt-6 text-right">
                      <Link href={`/tenant/${slugForRelated || listing.tenantId}`} className="text-sm text-amber-700 hover:text-amber-800 font-medium">View All Products →</Link>
                    </div>
                  </section>
                </TenantPaymentProvider>
              )}

              {/* Categories */}
              {!showStatusPanel && storefrontCategories.categories.length > 0 && (
                <ProductCategoriesCollapsible categories={storefrontCategories.categories} tenantId={listing.tenantId} uncategorizedCount={storefrontCategories.uncategorizedCount} />
              )}

              {/* Reviews */}
              {!showStatusPanel && <StoreRatingsSection tenantId={listing.tenantId} showWriteReview={true} />}

              {/* FAQ */}
              {faqFlags?.faq_enabled && faqFlags?.faq_display_storefront_accordion && tenantId && (
                <section className="bg-white rounded-xl p-8 border border-stone-200">
                  <FaqStorefrontDisplay tenantId={tenantId} enabled={faqFlags.faq_enabled && faqFlags.faq_display_storefront_accordion}
                    feedbackEnabled={faqFlags.faq_enabled && faqFlags.faq_display_feedback} defaultExpanded={false} />
                </section>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {!showStatusPanel && showsHours && optFlags?.showContact !== false && (
                <div className="bg-white rounded-xl p-6 border border-stone-200">
                  <h3 className="text-lg font-semibold text-stone-900 mb-4">Contact</h3>
                  <ContactInformationCollapsible tenant={listing} fullAddress={showsLocation ? fullAddress : ''} initialExpanded={true} isRetailStore={isRetailStore} />
                </div>
              )}
              {!showStatusPanel && showsHours && optFlags?.showHoursStatus !== false && businessHours && isRetailStore && (
                <div className="bg-white rounded-xl p-6 border border-stone-200">
                  <h3 className="text-lg font-semibold text-stone-900 mb-4">Hours</h3>
                  <BusinessHoursCollapsible businessHours={businessHours} isRetailStore={isRetailStore} />
                </div>
              )}
              {!showStatusPanel && showsMap && optFlags?.showInteractiveMaps !== false && listing.address && isRetailStore && (
                <div className="bg-white rounded-xl p-6 border border-stone-200">
                  <h3 className="text-lg font-semibold text-stone-900 mb-4">Location</h3>
                  <GoogleMapEmbed address={listing.address} />
                </div>
              )}
              <div className="bg-white rounded-xl p-6 border border-stone-200 flex flex-col items-center">
                <TenantQRCode url={currentUrl} tenantId={listing.tenantId} label="Scan to Share"
                  downloadName={listing.businessName?.toLowerCase().replace(/[^a-z0-9]/g, '-')} size={160} showDownload={true} pageType="directory" capabilityFlags={optFlags} />
              </div>
              {crmFlags?.crm_enabled && crmFlags?.crm_inquiry_directory_enabled && !showStatusPanel && tenantId && (
                <div className="bg-white rounded-xl p-6 border border-stone-200">
                  <h3 className="text-lg font-semibold text-stone-900 mb-4">Inquiry</h3>
                  <PublicInquiryForm tenantId={tenantId} tenantName={listing.businessName || listing.name} sourceLabel="Directory" />
                </div>
              )}
            </div>
          </div>
        </div>

        {!showStatusPanel && <RelatedStores currentSlug={slugForRelated} limit={3} title="Similar Stores" />}
        {optFlags?.showRecentlyViewed !== false && <LastViewed />}
        <PoweredByFooter />
      </div>
    </>
  );
}
