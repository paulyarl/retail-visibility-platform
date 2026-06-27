'use client';

import Link from 'next/link';
import { Globe, ArrowLeft, Star } from 'lucide-react';

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

export default function DirectoryEntryImmersiveLayout(props: DirectoryEntryLayoutProps) {
  const {
    tenantId, listing, tenantLogo, businessProfile, businessHours,
    storefrontCategories, featuredProducts, tenantInfo, slugForRelated,
    optFlags, showStatusPanel, hoursStatus, isRetailStore, showsHours,
    showsMap, showsLocation, currentUrl, baseUrl, faqFlags, crmFlags,
    paymentGatewayStatus, actualProductCount, fullAddress,
  } = props;

  const coverImage = listing.coverImageUrl || listing.bannerImageUrl || listing.logoUrl;

  return (
    <>
      <LocalBusinessStructuredData listing={listing} url={currentUrl} />
      <BreadcrumbStructuredData items={[
        { name: 'Home', url: baseUrl },
        { name: 'Directory', url: `${baseUrl}/directory` },
        { name: listing.businessName, url: currentUrl },
      ]} />
      <StoreViewTracker tenantId={tenantId} storeName={listing.businessName} categories={listing.categories} />

      <div className="min-h-screen bg-gray-950 text-white">
        {/* Immersive Full-Bleed Hero */}
        <div className="relative h-[60vh] min-h-[400px]">
          {coverImage ? (
            <img src={coverImage} alt={listing.businessName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
            <div className="max-w-7xl mx-auto">
              <Link href="/directory" className="inline-flex items-center text-sm text-white/70 hover:text-white mb-4 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
              </Link>
              {showStatusPanel && tenantInfo ? (
                <StorefrontStatusPanel tenantInfo={tenantInfo} />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end gap-6">
                    {listing.logoUrl && (
                      <img src={listing.logoUrl} alt="" className="w-24 h-24 rounded-2xl object-cover border-4 border-white/20 shadow-2xl hidden sm:block" />
                    )}
                    <div className="pb-2">
                      <h1 className="text-4xl sm:text-6xl font-bold">{listing.businessName}</h1>
                      {listing.categories && listing.categories.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {listing.categories.sort((a: any, b: any) => (a.isPrimary && !b.isPrimary ? -1 : 1)).map((c: any, i: number) => (
                            <span key={c.id || i} className={`px-3 py-1 rounded-full text-sm font-medium ${c.isPrimary ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'}`}>{c.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Link href={`/tenant/${slugForRelated || listing.tenantId}`}
                      className="inline-flex items-center gap-2 px-8 py-3 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-colors font-bold text-lg">
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
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-12">
          {listing.keywords && listing.keywords.length > 0 && (
            <div className="mb-8"><DirectoryKeywordTags keywords={listing.keywords} /></div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-10">
              {/* Description */}
              {(businessProfile?.business_description || businessProfile?.businessDescription) && (
                <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-800">
                  <h2 className="text-2xl font-bold mb-4">About</h2>
                  <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">{businessProfile.business_description || businessProfile.businessDescription}</p>
                </div>
              )}

              {/* Gallery */}
              {!showStatusPanel && <DirectoryPhotoGalleryDisplay listing={listing} {...businessProfile} isPublished={true} />}

              {/* Products */}
              {!showStatusPanel && featuredProducts.length > 0 && (
                <TenantPaymentProvider tenantId={listing.tenantId}>
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold">Featured Products</h2>
                      <Link href={`/tenant/${slugForRelated || listing.tenantId}`} className="text-blue-400 hover:text-blue-300 font-medium">View All →</Link>
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
                                      <SmartProductCard key={`immersive-${product.id}`} tenantId={listing.tenantId}
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
                                    <SmartProductCard key={`immersive-${product.id}`} tenantId={listing.tenantId}
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
                  </div>
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
                <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-800">
                  <FaqStorefrontDisplay tenantId={tenantId} enabled={faqFlags.faq_enabled && faqFlags.faq_display_storefront_accordion}
                    feedbackEnabled={faqFlags.faq_enabled && faqFlags.faq_display_feedback} defaultExpanded={false} />
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {!showStatusPanel && showsHours && optFlags?.showContact !== false && (
                <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
                  <h3 className="text-lg font-semibold mb-4">Contact</h3>
                  <ContactInformationCollapsible tenant={listing} fullAddress={showsLocation ? fullAddress : ''} initialExpanded={true} isRetailStore={isRetailStore} />
                </div>
              )}
              {!showStatusPanel && showsHours && optFlags?.showHoursStatus !== false && businessHours && isRetailStore && (
                <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
                  <h3 className="text-lg font-semibold mb-4">Hours</h3>
                  <BusinessHoursCollapsible businessHours={businessHours} isRetailStore={isRetailStore} />
                </div>
              )}
              {!showStatusPanel && showsMap && optFlags?.showInteractiveMaps !== false && listing.address && isRetailStore && (
                <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
                  <h3 className="text-lg font-semibold mb-4">Location</h3>
                  <GoogleMapEmbed address={listing.address} />
                </div>
              )}
              <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 flex flex-col items-center">
                <TenantQRCode url={currentUrl} tenantId={listing.tenantId} label="Share"
                  downloadName={listing.businessName?.toLowerCase().replace(/[^a-z0-9]/g, '-')} size={160} showDownload={true} pageType="directory" capabilityFlags={optFlags} />
              </div>
              {crmFlags?.crm_enabled && crmFlags?.crm_inquiry_directory_enabled && !showStatusPanel && tenantId && (
                <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
                  <h3 className="text-lg font-semibold mb-4">Inquiry</h3>
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
