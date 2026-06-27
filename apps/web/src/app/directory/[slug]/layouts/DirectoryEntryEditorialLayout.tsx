'use client';

import Link from 'next/link';
import { Globe, ArrowLeft, MapPin, Clock, Phone, Mail, ExternalLink } from 'lucide-react';

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

export default function DirectoryEntryEditorialLayout(props: DirectoryEntryLayoutProps) {
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

      <div className="min-h-screen bg-white">
        {/* Editorial Hero */}
        <div className="relative bg-neutral-900 text-white overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            {listing.coverImageUrl ? (
              <img src={listing.coverImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900" />
            )}
          </div>
          <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-24">
            <Link href="/directory" className="inline-flex items-center text-sm text-neutral-300 hover:text-white mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
            </Link>
            {showStatusPanel && tenantInfo ? (
              <StorefrontStatusPanel tenantInfo={tenantInfo} />
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  {listing.logoUrl && (
                    <img src={listing.logoUrl} alt={listing.businessName} className="w-20 h-20 rounded-xl object-cover border-2 border-white/20" />
                  )}
                  <div>
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{listing.businessName}</h1>
                    {listing.categories && listing.categories.length > 0 && (
                      <p className="text-neutral-300 mt-2 text-lg">
                        {listing.categories.filter((c: any) => c.isPrimary).map((c: any) => c.name).join(', ') || listing.categories[0]?.name}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-neutral-300 text-lg max-w-2xl leading-relaxed">
                  Browse {actualProductCount > 0 ? actualProductCount : (listing.productCount ?? 0)} products and shop directly from their online storefront.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <Link href={`/tenant/${slugForRelated || listing.tenantId}`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors font-semibold">
                    <Globe className="w-5 h-5" /> Visit Storefront
                  </Link>
                  {!showStatusPanel && showsHours && optFlags?.showHoursStatus !== false && isRetailStore && (
                    <HoursStatusBadge status={hoursStatus} size="lg" animate={optFlags?.showAnimatedHours !== false} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Asymmetric Content Grid */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Main Column */}
            <div className="lg:col-span-8 space-y-10">
              {/* About */}
              {(businessProfile?.business_description || businessProfile?.businessDescription) && (
                <section>
                  <h2 className="text-2xl font-bold text-neutral-900 mb-4">About</h2>
                  <p className="text-neutral-600 leading-relaxed text-lg whitespace-pre-wrap">
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
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-neutral-900">Curated Selection</h2>
                      <Link href={`/tenant/${slugForRelated || listing.tenantId}`} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All →</Link>
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
                                  <h3 className="text-sm font-semibold text-neutral-700 mb-3">{productTypeLabels[pt]}</h3>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {group.map((product: any) => (
                                      <SmartProductCard key={`editorial-${product.id}`} tenantId={listing.tenantId}
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
                                <h3 className="text-sm font-semibold text-neutral-700 mb-3">Other Products</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                  {otherProducts.map((product: any) => (
                                    <SmartProductCard key={`editorial-${product.id}`} tenantId={listing.tenantId}
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
                  </section>
                </TenantPaymentProvider>
              )}

              {/* Categories */}
              {!showStatusPanel && storefrontCategories.categories.length > 0 && (
                <section>
                  <ProductCategoriesCollapsible categories={storefrontCategories.categories} tenantId={listing.tenantId} uncategorizedCount={storefrontCategories.uncategorizedCount} />
                </section>
              )}

              {/* Reviews */}
              {!showStatusPanel && <StoreRatingsSection tenantId={listing.tenantId} showWriteReview={true} />}

              {/* FAQ */}
              {faqFlags?.faq_enabled && faqFlags?.faq_display_storefront_accordion && tenantId && (
                <section className="bg-neutral-50 rounded-xl p-8">
                  <FaqStorefrontDisplay tenantId={tenantId} enabled={faqFlags.faq_enabled && faqFlags.faq_display_storefront_accordion}
                    feedbackEnabled={faqFlags.faq_enabled && faqFlags.faq_display_feedback} defaultExpanded={false} />
                </section>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-8">
              {/* Contact Card */}
              {!showStatusPanel && showsHours && optFlags?.showContact !== false && (
                <div className="bg-neutral-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Contact</h3>
                  <ContactInformationCollapsible tenant={listing} fullAddress={showsLocation ? fullAddress : ''} initialExpanded={true} isRetailStore={isRetailStore} />
                </div>
              )}

              {/* Hours */}
              {!showStatusPanel && showsHours && optFlags?.showHoursStatus !== false && businessHours && isRetailStore && (
                <div className="bg-neutral-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Hours</h3>
                  <BusinessHoursCollapsible businessHours={businessHours} isRetailStore={isRetailStore} />
                </div>
              )}

              {/* Map */}
              {!showStatusPanel && showsMap && optFlags?.showInteractiveMaps !== false && listing.address && isRetailStore && (
                <div className="bg-neutral-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Location</h3>
                  <GoogleMapEmbed address={listing.address} />
                </div>
              )}

              {/* QR */}
              <div className="bg-neutral-50 rounded-xl p-6 flex flex-col items-center">
                <TenantQRCode url={currentUrl} tenantId={listing.tenantId} label="Scan to Share"
                  downloadName={listing.businessName?.toLowerCase().replace(/[^a-z0-9]/g, '-')} size={160} showDownload={true} pageType="directory" capabilityFlags={optFlags} />
              </div>

              {/* Inquiry */}
              {crmFlags?.crm_enabled && crmFlags?.crm_inquiry_directory_enabled && !showStatusPanel && tenantId && (
                <div className="bg-neutral-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Inquiry</h3>
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
