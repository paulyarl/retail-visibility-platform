import { notFound } from 'next/navigation';
import { Metadata } from 'next';
// import Link from 'next/link';
import Image from 'next/image';
import ProductGallery from '@/components/products/ProductGallery';

// Tier Based Landing Page
import { TierBasedLandingPage } from '@/components/landing-page/TierBasedLandingPage';

// Product Components
// import { ProductNavigation } from '@/components/products/ProductNavigation';
import { ProductRecommendations } from '@/components/products/ProductRecommendations';
import { FeaturedTypeProducts } from '@/components/products/FeaturedTypeProducts';
import LastViewed from '@/components/directory/LastViewed';
// import { computeStoreStatus } from '@/lib/hours-utils';
import { ProductViewTracker } from '@/components/tracking/ProductViewTracker';
import { ProductLikeProvider } from '@/components/likes/ProductLikeProvider';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import ProductBusinessInfoWrapper from '@/components/products/ProductBusinessInfoWrapper';
import ProductReviewsSection from '@/components/products/ProductReviewsSection';
import FulfillmentOptionsPane from '@/components/storefront/FulfillmentOptionsPane';
// import StorefrontActionsWrapper from '@/components/storefront/StorefrontActionsWrapper';
import DirectoryActions from '@/components/directory/DirectoryActions';
// import { Badge, Group } from '@mantine/core';
// import { Sparkles, TrendingUp, Star, Tag, Clock, Award, Zap, Flame } from 'lucide-react';
import { productDataService } from '@/services/ProductDataService';
import { storefrontSingletonService } from '@/services/StorefrontSingletonService';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';
import { directoryService } from '@/services/DirectorySingletonService';
import ProductCategorySidebar from '@/components/storefront/ProductCategorySidebar';
import CategoryMobileDropdown from '@/components/storefront/CategoryMobileDropdown';
import { AvailableNearby } from '@/components/products/AvailableNearby';
import { TenantQRCode } from '@/components/public/TenantQRCode';

import { tenantPublicService, SubscriptionStatusInfo, LocationStatusInfo, PublicTenantInfo, TenantProfile } from '@/services/TenantPublicService';
import { ProductPageStatusWrapper } from '@/components/storefront/ProductPageStatusWrapper';

// Define the product interface based on the API response
interface ProductImage {
  id: string;
  url: string;
  position: number;
  isPrimary: boolean;
}

interface ProductVariant {
  id: string;
  sku: string;
  variant_name: string;
  price_cents: number;
  sale_price_cents?: number;
  stock: number;
  image_url?: string;
  attributes: Record<string, any>;
  sort_order: number;
  is_active: boolean;
  is_on_sale: boolean;
  discount_percentage: number;
}

interface ProductData {
  id: string;
  name: string;
  title: string;
  description: string;
  marketingDescription?: string; // Add marketing description field
  price: number;
  priceCents: number;
  listPriceCents: number;
  salePriceCents: number;
  isOnSale: boolean;
  discountPercentage: string;
  sku: string;
  availability: string;
  stock: number;
  quantity: number;
  images: ProductImage[];
  tenant: {
    id: string;
    name: string;
    slug: string;
    subscriptionTier?: string;
    city?: string;
    state?: string;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
    googleCategoryId?: string;
  };
  brand?: string;
  condition?: string;
  manufacturer?: string;
  createdAt: string;
  updatedAt: string;
  features?: string[];
  specifications?: Record<string, any>;
  enhanced_description?: string;
  metadata?: Record<string, any>;
  tenantId: string;
  // NEW: Slug registry fields for cross-tenant matching
  productSlug?: string;
  brandNormalized?: string;
  categoryNormalized?: string;
  slugType?: 'upc' | 'lpc';
  platformTenantCount?: number;
  platformPurchaseCount?: number;
  platformTotalStock?: number;
  otherTenantsCount?: number;
  itemStatus: string;
  visibility: string;
  imageUrl?: string;
  currency: string;
  variants?: ProductVariant[];
  productType?: 'physical' | 'digital' | 'hybrid';
  digitalDeliveryMethod?: string;
  digitalAssets?: any[];
  licenseType?: string;
  accessDurationDays?: number;
  downloadLimit?: number;
  featuredTypes?: string[];
}

// Force dynamic rendering for product pages
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

async function getProduct(id: string): Promise<ProductData | null> {
  try {
    const product = await productDataService.fetchProduct(id);
    return product;
  } catch (error) {
    console.error('[ProductPage] Error fetching product:', error);
    return null;
  }
}

async function getShopData(tenantId: string) {
  try {
    // For now, return null since we don't have shop data in the API response
    return null;
  } catch (error) {
    console.error('Error fetching shop data:', error);
    return null;
  }
}

async function getTenantProfile(tenantId: string) {
  try {
    const profile = await publicTenantInfoService.getTenantProfile(tenantId);
    // console.log(`[ProductPage] Tenant profile for ${tenantId}:`, profile);
    return profile || null;
  } catch (error) {
    console.error('Error fetching tenant profile:', error);
    return null;
  }
}

async function getBucketCounts(tenantId: string): Promise<Record<string, number> | undefined> {
  try {
    const featuredData = await storefrontSingletonService.getFeaturedProductsByType(tenantId, undefined, 1);
    // Extract bucket counts from the response
    // The API returns products grouped by type, we just need counts
    const counts: Record<string, number> = {};
    for (const [type, products] of Object.entries(featuredData || {})) {
      counts[type] = Array.isArray(products) ? products.length : 0;
    }
    return counts;
  } catch (error) {
    console.error('Error fetching bucket counts:', error);
    return undefined;
  }
}

async function getStorefrontCategories(tenantId: string) {
  try {
    const data = await directoryService.getStorefrontCategories(tenantId);
    return data;
  } catch (error) {
    console.error('Error fetching storefront categories:', error);
    return { categories: [], uncategorizedCount: 0 };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  // console.log(`generateMetadata product 1: `, product);

  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }

  const tenantProfile = await getTenantProfile(product.tenantId);

  // console.log(`tenantProfile: `, tenantProfile);
  const businessName = tenantProfile?.business_name || product.tenant?.name || 'Unknown Store';
  const businessDescription = tenantProfile?.business_description;
  const seoTags = tenantProfile?.seo_tags || [];

  // Create enhanced description with business info
  const baseDescription = product.description || `Buy ${product.title} from ${businessName}. ${product.brand} - ${product.currency} ${product.price}`;
  const enhancedDescription = businessDescription
    ? `${baseDescription}. ${businessDescription}`
    : baseDescription;

  // Create SEO schema
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.title,
    "description": enhancedDescription,
    "brand": {
      "@type": "Brand",
      "name": product.brand || businessName
    },
    "offers": {
      "@type": "Offer",
      "price": product.price,
      "priceCurrency": product.currency,
      "availability": product.itemStatus === 'active' ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    },
    "seller": {
      "@type": "Organization",
      "name": businessName,
      "description": businessDescription,
      "address": tenantProfile ? {
        "@type": "PostalAddress",
        "streetAddress": tenantProfile.address_line1,
        "addressLocality": tenantProfile.city,
        "addressRegion": tenantProfile.state,
        "postalCode": tenantProfile.postal_code,
        "addressCountry": tenantProfile.country_code
      } : undefined,
      "telephone": tenantProfile?.phone_number,
      "email": tenantProfile?.email,
      "website": tenantProfile?.website
    },
    "keywords": seoTags.join(", "),
    "image": product.images?.map(img => img.url) || []
  };

  return {
    title: `${product.title} - ${businessName}`,
    description: enhancedDescription,
    keywords: seoTags.join(", "),
    openGraph: {
      title: product.title,
      description: enhancedDescription,
      images: product.images?.map(img => img.url) || [],
      type: 'website',
    },
    other: {
      "application/ld+json": JSON.stringify(schema),
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  // console.log(`ProductPage product 2: `, product);
  if (!product) {
    notFound();
  }

  const shopData = await getShopData(product.tenantId);
  const bucketCounts = await getBucketCounts(product.tenantId);
  // const tenantProfile2 = await getTenantProfile(product.tenantId);
  const tenantProfile = await tenantPublicService.getPublicTenantInfo(product.tenantId);
  const tenant = await tenantPublicService.getPublicTenantInfo(product.tenantId);
  const storefrontCategories = await getStorefrontCategories(product.tenantId);
  const totalProducts = await directoryService.getStorefrontProductCount(product.tenantId);
  // console.log(`[ProductPage] Tenant profile for ${product.tenantId}:`, tenantProfile);
  // console.log(`[ProductPage] Tenant profile2 for ${product.tenantId}:`, tenantProfile2);
  // console.log(`[ProductPage] Tenant for ${product.tenantId}:`, tenant);
  const businessName = product.tenant?.name || 'Unknown Store';


  // console.log(`tenant: `, tenant);

  // Convert images to gallery format for ProductGallery component
  // console.log(`Product 1 JSON: ${JSON.stringify(product)}`);
  const gallery = product.images?.map(img => ({
    url: img.url,
    alt: product.title,
    caption: null,
    position: img.position,
  })) || [];
  // console.log(`Convert images: ${gallery}`);



  const tenantInfoForStatus = {
    id: product.tenant?.id || tenant?.id,
    name: product.tenant?.name || tenant?.name,
    slug: product.tenant?.slug || tenant?.slug,
    subscriptionStatus: tenant?.statusInfo?.status || 'unknown',
    subscriptionTier: tenant?.subscriptionTier,
    locationStatus: tenant?.locationStatus,
    statusInfo: tenant?.statusInfo,
    showSubscriptionPanel: tenant?.showSubscriptionPanel,
    hasDirectory: tenant?.directoryData?.is_published || tenant?.hasDirectory || tenant?.statusInfo?.showInDirectory,
    createdAt: tenant?.createdAt,
    updatedAt: tenant?.updatedAt,
  } as any;

  // Set imageGallery on product for TierBasedLandingPage
  const productWithGallery = {
    ...product,
    imageGallery: gallery
      .map(img => ({
        url: img.url,
        alt: img.alt || product.title,
        caption: img.caption,
        position: img.position,
      }))
      .slice(0, 10) // Will be further limited by tier features in TierBasedLandingPage
  };
  // console.log(`productWithGallery: ${JSON.stringify(productWithGallery)}`)

  // Check if product is publicly accessible
  const isPubliclyAccessible = product.itemStatus === 'active' && product.visibility === 'public';
  const statusLabel = product.itemStatus === 'draft' ? 'Draft' : product.itemStatus === 'archived' ? 'Archived' : product.itemStatus;
  const visibilityLabel = product.visibility === 'private' ? 'Private' : 'Public';
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || (typeof window !== 'undefined' ? window.location.origin : '') || 'http://localhost:3000';
  const currentUrl = `${baseUrl}/products/${product.id}`;

  // Enhanced structured data with business profile and SEO tags
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: tenantProfile?.profileData?.business_description
      ? `${product.description}. ${tenantProfile?.profileData?.business_description}`
      : product.description,
    brand: {
      '@type': 'Brand',
      name: product.brand || tenantProfile?.name || businessName,
    },
    sku: product.sku,
    image: gallery.map(p => p.url),
    // keywords: tenantProfile?.seo_tags?.join(", ") || "",
    offers: {
      '@type': 'Offer',
      url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://rvp.vercel.app'}/products/${product.id}`,
      priceCurrency: product.currency,
      price: product.price,
      availability: `https://schema.org/${product.availability === 'in_stock' ? 'InStock' : 'OutOfStock'}`,
      itemCondition: `https://schema.org/${product.condition === 'used' ? 'UsedCondition' : product.condition === 'refurbished' ? 'RefurbishedCondition' : 'NewCondition'}`,
      seller: {
        '@type': 'Organization',
        name: tenantProfile?.profileData?.business_name || businessName,
        description: tenantProfile?.profileData?.business_description,
        address: tenantProfile ? {
          '@type': 'PostalAddress',
          streetAddress: tenantProfile.profileData?.address_line1,
          addressLocality: tenantProfile.profileData?.city,
          addressRegion: tenantProfile.profileData?.state,
          postalCode: tenantProfile.profileData?.postal_code,
          addressCountry: tenantProfile.profileData?.country_code
        } : undefined,
        telephone: tenantProfile?.profileData?.phone_number,
        email: tenantProfile?.profileData?.email,
        website: tenantProfile?.profileData?.website,
      },
    },
  };

  return (
    <>
      <ProductLikeProvider>
        {/* SEO Meta Tags */}
        {tenantProfile?.directoryData.seo_keywords && tenantProfile.directoryData.seo_keywords.length > 0 && (
          <>
            {tenantProfile.directoryData.seo_keywords.map((tag: string, index: number) => (
              <meta key={index} name="keywords" content={tag} />
            ))}
          </>
        )}

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />

        {/* Product View Tracking */}
        <ProductViewTracker
          productId={product.id}
          tenantId={product.tenantId}
          productName={product.name}
          categoryId={product.category?.id}
        />

        {/* Hero Header - Store Brand Identity, Navigation, Actions */}
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
              {/* Directory Actions */}
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
            </div>
            {/* Navigation Pills */}


            {/* Mobile Navigation */}
            <div className="sm:hidden pb-3 flex items-center gap-2 overflow-x-auto">
              {/* Directory Actions */}
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

        {/* Alert for non-public products (only shown to authenticated users) */}
        {!isPubliclyAccessible && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                    This Product is Not Publicly Accessible
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                    <strong>Status:</strong> {statusLabel} | <strong>Visibility:</strong> {visibilityLabel}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {product.itemStatus === 'draft' && 'This product is in draft mode. Activate it to make it publicly accessible.'}
                    {product.itemStatus === 'archived' && 'This product is archived. Restore it to active status to make it publicly accessible.'}
                    {product.itemStatus === 'inactive' && 'This product is inactive. Activate it to make it publicly accessible.'}
                    {product.visibility === 'private' && product.itemStatus === 'active' && 'This product is set to private. Change visibility to public to make it accessible.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Two-Column Layout: Categories + Product Description only */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Desktop Category Sidebar */}
            <div className="hidden lg:block lg:w-64 flex-shrink-0">
              <ProductCategorySidebar
                tenantId={product.tenantId}
                categories={storefrontCategories.categories.map((cat: any) => ({
                  id: cat.id,
                  name: cat.name,
                  slug: cat.slug,
                  count: parseInt(cat.productCount) || 0,
                }))}
                totalProducts={totalProducts || 0}
              />
              {/* QR Code - under categories */}
              <TenantQRCode
                url={currentUrl}
                tenantId={product.tenantId}
                label="Scan to Share"
              />
            </div>

            {/* Mobile Category Dropdown */}
            <div className="lg:hidden w-full">
              <CategoryMobileDropdown
                tenantId={product.tenantId}
                categories={storefrontCategories.categories.map((cat: any) => ({
                  id: cat.id,
                  name: cat.name,
                  slug: cat.slug,
                  count: parseInt(cat.productCount) || 0,
                }))}
                totalProducts={totalProducts || 0}
              />
              {/* QR Code - under categories */}
              <TenantQRCode
                url={currentUrl}
                tenantId={product.tenantId}
                label="Scan to Share"
              />
            </div>

            {/* Product Description Section */}

            <div className="flex-1 lg:flex-1 min-w-0 w-full lg:w-auto">
              <TenantPaymentProvider tenantId={product.tenantId}>
                <TierBasedLandingPage
                  disableQRCode
                  product={{
                    id: product.id,
                    tenantId: product.tenantId,
                    name: product.name,
                    title: product.title,
                    description: product.description,
                    marketingDescription: product.marketingDescription || product.enhanced_description, // Use new field with fallback
                    price: product.price,
                    priceCents: product.priceCents,
                    listPriceCents: product.listPriceCents,
                    salePriceCents: product.salePriceCents,
                    currency: product.currency,
                    imageUrl: product.imageUrl,
                    imageGallery: productWithGallery.imageGallery,
                    brand: product.brand,
                    sku: product.sku,
                    stock: product.stock,
                    availability: product.availability,
                    condition: product.condition,
                    tenantCategoryId: product.category?.id,
                    tenantCategory: product.category ? {
                      id: product.category.id,
                      name: product.category.name,
                      slug: product.category.slug,
                    } : undefined,
                    featuredTypes: product.featuredTypes,
                    bucketCounts,
                    gtin: undefined, // Not available in new API
                    mpn: undefined, // Not available in new API
                    defaultGatewayType: undefined, // Will be determined by tenant
                    // Pass features from direct field as array, qrCodes will be handled by disableQRCode prop
                    features: product.features || [],
                    specifications: product.specifications, // Now available from direct field
                    slug: product.tenant?.slug || '',
                    variants: product.variants,
                    productType: product.productType,
                    digitalDeliveryMethod: product.digitalDeliveryMethod,
                    digitalAssets: product.digitalAssets,
                    licenseType: product.licenseType,
                    accessDurationDays: product.accessDurationDays,
                    downloadLimit: product.downloadLimit,
                    productSlug: product.productSlug,
                    slugType: product.slugType,
                  } as any}
                  tenant={{
                    id: product.tenantId,
                    name: product.tenant?.name,
                    slug: product.tenant?.slug || '',
                    subscriptionTier: product.tenant?.subscriptionTier,
                    hasActivePaymentGateway: false, // Will be determined by service
                    defaultGatewayType: undefined,
                    trialEndsAt: tenantProfile?.trialEndsAt,
                    locationStatus: tenantProfile?.locationStatus,
                    statusInfo: tenantProfile?.statusInfo,
                    organizationId: tenantProfile?.organizationId,
                    subscriptionStatusInfo: tenantProfile?.subscriptionStatusInfo,
                    showSubscriptionPanel: tenantProfile?.showSubscriptionPanel,
                    hasDirectory: tenantProfile?.hasDirectory,
                    directoryData: tenantProfile?.directoryData,
                    profileData: tenantProfile?.profileData,
                    businessName: product.tenant?.name || tenantProfile?.profileData?.businessName || tenantProfile?.profileData?.business_name,
                    phone: tenantProfile?.profileData?.phone_number,
                    email: tenantProfile?.profileData?.email,
                    website: tenantProfile?.profileData?.website,
                    address: tenantProfile?.profileData?.address_line1,
                    logo_url: tenantProfile?.profileData?.logo_url,
                    social_links: tenantProfile?.profileData?.social_links,

                    metadata: tenantProfile?.metadata,
                  } as any}
                  storeStatus={null}
                  gallery={gallery.length > 0 ? <ProductGallery gallery={gallery} productTitle={product.title} /> : undefined}
                  fulfillmentPane={<FulfillmentOptionsPane tenantId={product.tenantId} />}
                  currentUrl={currentUrl}
                />
              </TenantPaymentProvider>
            </div>

          </div>
        </div>
        {/* Business Description - Merchant Branding - Full Width */}
        <ProductPageStatusWrapper tenantInfo={tenantInfoForStatus}>
                  
          {/* Business Information - Contact Us - Full Width */}

          {product.productType != 'digital' ? (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <ProductBusinessInfoWrapper
                product={product as any}
                tenant={{
                  id: product.tenantId || tenantProfile?.id || '',
                  name: tenantProfile?.profileData?.businessName || tenantProfile?.profileData?.business_name || product.tenant?.name || '',
                  metadata: {
                    businessName: tenantProfile?.profileData?.businessName || tenantProfile?.profileData?.business_name,
                    businessDescription: tenantProfile?.profileData?.business_description || tenantProfile?.profileData?.businessDescription,
                    phone: tenantProfile?.profileData?.phone_number,
                    email: tenantProfile?.profileData?.email,
                    website: tenantProfile?.profileData?.website,
                    address: tenantProfile?.profileData?.state == null ? '' : `${tenantProfile?.profileData?.address_line1}, ${tenantProfile?.profileData?.city}, ${tenantProfile?.profileData?.state} ${tenantProfile?.profileData?.postal_code}`,

                    logoUrl: tenantProfile?.profileData?.logo_url,
                    socialLinks: tenantProfile?.profileData?.social_links || undefined,
                  }
                }}
              />
            </div>
          ) : (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                Digital Product
              </h2>
              <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                Download link will be available after successful checkout.
              </p>
            </div>
          )}

          {/* Featured Type Products - Full Width */}

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FeaturedTypeProducts
              currentProductId={product.id}
              tenantId={product.tenantId}
              featuredTypes={product.featuredTypes || []}
            />
          </div>

          {/* Available Nearby - Cross-Tenant Product Discovery */}
          {product.productSlug && product.otherTenantsCount && product.otherTenantsCount > 0 && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
              <AvailableNearby
                productSlug={product.productSlug}
                currentTenantId={product.tenantId}
                className="w-full max-w-md mx-auto"
              />
            </div>
          )}

          {/* Product Recommendations - Full Width */}
          {/* You Might Also Like */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ProductRecommendations productId={product.id} tenantId={product.tenantId} tenantSlug={product.tenant?.slug || ''} />
          </div>

          {/* Product Reviews - Full Width */}
          <div id="reviews-section" className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
          <div className="bg-neutral-50 dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <ProductReviewsSection productId={product.id} tenantId={product.tenantId} />
            </div>
          </div>

        </ProductPageStatusWrapper>

        {/* Recently Viewed Products */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LastViewed
            title="Recently Viewed Products"
            entityType="product"
            limit={4}
            showEmptyState={false}
            currentProductId={product.id}
          />
        </div>

        {/* Platform Branding Footer */}
        <PoweredByFooter />
      </ProductLikeProvider>
    </>
  );
}
