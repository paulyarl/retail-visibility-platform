import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ProductGallery from '@/components/products/ProductGallery';

// Tier Based Landing Page
import { TierBasedLandingPage } from '@/components/landing-page/TierBasedLandingPage';

// Product Components
import { ProductViewTracker } from '@/components/tracking/ProductViewTracker';
import { ProductLikeProvider } from '@/components/likes/ProductLikeProvider';
import FulfillmentOptionsPane from '@/components/storefront/FulfillmentOptionsPane';
import { productDataService } from '@/services/ProductDataService';
import { storefrontSingletonService } from '@/services/StorefrontSingletonService';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';
import { directoryService } from '@/services/DirectorySingletonService';
import ProductCategorySidebar from '@/components/storefront/ProductCategorySidebar';
import CategoryMobileDropdown from '@/components/storefront/CategoryMobileDropdown';
import { TenantQRCode } from '@/components/public/TenantQRCode';
import { publicUnifiedCapabilityService } from '@/services/PublicUnifiedCapabilityService';
import { StorefrontOptionFlags, type ProductOptionFlags, type FeaturedOptionsState, type FeaturedType } from '@/services/CapabilityResolutionService';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';
import LastViewed from '@/components/directory/LastViewed';
import PublicBotWidget from '@/components/bot/PublicBotWidget';
import { ProductVideoPlayer } from '@/components/products/ProductVideoPlayer';
import { SocialPixels } from '@/components/tracking/SocialPixels';

// Shared product page sections
import { ProductHeaderSection } from '@/components/products/sections/ProductHeaderSection';
import { FeaturedProductsSection } from '@/components/products/sections/FeaturedProductsSection';
import { ProductBusinessInfoSection } from '@/components/products/sections/ProductBusinessInfoSection';
import { ProductReviewsSectionWrapper } from '@/components/products/sections/ProductReviewsSectionWrapper';
import { ProductFAQSection } from '@/components/products/sections/ProductFAQSection';
import { ProductRecommendationsSection } from '@/components/products/sections/ProductRecommendationsSection';
import { ProductInquirySection } from '@/components/products/sections/ProductInquirySection';
import { ProductFooterSection } from '@/components/products/sections/ProductFooterSection';

import { tenantPublicService, SubscriptionStatusInfo, LocationStatusInfo, PublicTenantInfo, TenantProfile } from '@/services/TenantPublicService';
import { ProductPageStatusWrapper } from '@/components/storefront/ProductPageStatusWrapper';
import { resolveProductLayout, type ProductLayoutKey } from './layouts/types';
import ProductShowcaseLayout from './ProductShowcaseLayout';
import ProductQuickCommerceLayout from './ProductQuickCommerceLayout';
import CouponSpotlight from '@/components/storefront/CouponSpotlight';
import { clientLogger } from '@/lib/client-logger';

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
    clientLogger.error('[ProductPage] Error fetching product:', { detail: error });
    return null;
  }
}

async function getShopData(tenantId: string) {
  try {
    // For now, return null since we don't have shop data in the API response
    return null;
  } catch (error) {
    clientLogger.error('Error fetching shop data:', { detail: error });
    return null;
  }
}

async function getTenantProfile(tenantId: string) {
  try {
    const profile = await publicTenantInfoService.getTenantProfile(tenantId);
    // console.log(`[ProductPage] Tenant profile for ${tenantId}:`, profile);
    return profile || null;
  } catch (error) {
    clientLogger.error('Error fetching tenant profile:', { detail: error });
    return null;
  }
}

async function getFeaturedProductsByType(tenantId: string): Promise<{ counts: Record<string, number>; groupedProducts: Record<string, any[]> }> {
  try {
    const featuredData = await storefrontSingletonService.getFeaturedProductsByType(tenantId, undefined, 6);
    const counts: Record<string, number> = {};
    for (const [type, products] of Object.entries(featuredData || {})) {
      counts[type] = Array.isArray(products) ? products.length : 0;
    }
    return { counts, groupedProducts: featuredData || {} };
  } catch (error) {
    clientLogger.error('Error fetching featured products by type:', { detail: error });
    return { counts: {}, groupedProducts: {} };
  }
}

// Merchant gate helpers: filter by merchant preferences before passing to components
function filterTypesByMerchantPreferences(
  types: string[],
  state: FeaturedOptionsState | null
): string[] {
  const prefs = state?.merchantPreferences;
  if (!prefs || !prefs.featured_enabled) return [];
  const effectiveSet = new Set(state?.effectiveTypes || []);
  return types.filter(type => {
    const key = `featured_${type}` as keyof FeaturedOptionsState['merchantPreferences'];
    return prefs[key] === true && effectiveSet.has(type as FeaturedType);
  });
}

function filterBucketCountsByMerchantPreferences(
  counts: Record<string, number> | undefined,
  state: FeaturedOptionsState | null
): Record<string, number> | undefined {
  const prefs = state?.merchantPreferences;
  if (!counts) return undefined;
  if (!prefs || !prefs.featured_enabled) return {};
  const effectiveSet = new Set(state?.effectiveTypes || []);
  const filtered: Record<string, number> = {};
  for (const [type, count] of Object.entries(counts)) {
    const key = `featured_${type}` as keyof FeaturedOptionsState['merchantPreferences'];
    if (prefs[key] === true && effectiveSet.has(type as FeaturedType)) {
      filtered[type] = count;
    }
  }
  return filtered;
}

function filterGroupedProductsByMerchantPreferences(
  grouped: Record<string, any[]>,
  state: FeaturedOptionsState | null
): Record<string, any[]> {
  const prefs = state?.merchantPreferences;
  if (!prefs || !prefs.featured_enabled) return {};
  const effectiveSet = new Set(state?.effectiveTypes || []);
  const filtered: Record<string, any[]> = {};
  for (const [type, products] of Object.entries(grouped)) {
    const key = `featured_${type}` as keyof FeaturedOptionsState['merchantPreferences'];
    if (prefs[key] === true && effectiveSet.has(type as FeaturedType)) {
      filtered[type] = products;
    }
  }
  return filtered;
}

async function getStorefrontCategories(tenantId: string) {
  try {
    const data = await directoryService.getStorefrontCategories(tenantId);
    return data;
  } catch (error) {
    clientLogger.error('Error fetching storefront categories:', { detail: error });
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
  const optFlags = await publicUnifiedCapabilityService.getStorefrontOptionFlags(product.tenantId);
  const showEnhancedSEO = optFlags?.showEnhancedSEO ?? false;

  let storefrontType: string | undefined;
  try {
    const storefrontState = await publicUnifiedCapabilityService.getStorefrontState(product.tenantId);
    storefrontType = storefrontState.effectiveType;
  } catch (e) {
    // Non-critical — default to undefined
  }

  // console.log(`tenantProfile: `, tenantProfile);
  const businessName = tenantProfile?.business_name || product.tenant?.name || 'Unknown Store';

  // Basic metadata — always emitted
  const basicDescription = product.description || `Buy ${product.title} from ${businessName}`;
  const ogVerb = storefrontType === 'service' ? 'Book' : storefrontType === 'social' ? 'Discover' : 'Buy';
  const basicTitle = storefrontType === 'social'
    ? `${product.title} | ${businessName}`
    : `${product.title} - ${businessName}`;

  if (!showEnhancedSEO) {
    return {
      title: basicTitle,
      description: basicDescription,
      openGraph: {
        title: product.title,
        description: `${ogVerb} ${product.title} from ${businessName}`,
        images: product.images?.map(img => img.url) || [],
        type: 'website',
      },
    };
  }

  // Enhanced metadata — gated behind merchant capability
  const businessDescription = tenantProfile?.business_description;
  const seoTags = tenantProfile?.seo_tags || [];
  const enhancedDescription = businessDescription
    ? `${basicDescription}. ${businessDescription}`
    : basicDescription;

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
    title: basicTitle,
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

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ layout_preview?: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  // console.log(`ProductPage product 2: `, product);
  if (!product) {
    notFound();
  }

  const shopData = await getShopData(product.tenantId);
  const { counts: rawBucketCounts, groupedProducts: rawGroupedProducts } = await getFeaturedProductsByType(product.tenantId);

  // Fetch featured options state and apply merchant gate filtering at page root
  const featuredState = await publicUnifiedCapabilityService.getFeaturedOptionsState(product.tenantId);
  const bucketCounts = filterBucketCountsByMerchantPreferences(rawBucketCounts, featuredState);
  const merchantFilteredFeaturedTypes = filterTypesByMerchantPreferences(product.featuredTypes || [], featuredState);
  const merchantFilteredGroupedProducts = filterGroupedProductsByMerchantPreferences(rawGroupedProducts, featuredState);
  // const tenantProfile2 = await getTenantProfile(product.tenantId);
  const tenantProfile = await tenantPublicService.getPublicTenantInfo(product.tenantId);
  const tenant = await tenantPublicService.getPublicTenantInfo(product.tenantId);
  const storefrontCategories = await getStorefrontCategories(product.tenantId);
  const totalProducts = await directoryService.getStorefrontProductCount(product.tenantId);
  const optFlags = await publicUnifiedCapabilityService.getStorefrontOptionFlags(product.tenantId);
  const productOptFlags = await publicUnifiedCapabilityService.getProductOptionFlags(product.tenantId);
  const faqOptionsFlags = await publicUnifiedCapabilityService.getFaqOptionsFlags(product.tenantId);
  const crmOptionsFlags = await publicUnifiedCapabilityService.getCrmOptionsFlags(product.tenantId);
  const platformSettings = await platformSettingsService.getPlatformSettings();

  // Fetch storefront type for social behavior overlay
  let storefrontType: string | undefined;
  try {
    const storefrontState = await publicUnifiedCapabilityService.getStorefrontState(product.tenantId);
    storefrontType = storefrontState.effectiveType;
  } catch (e) {
    clientLogger.error('Failed to fetch storefront type:', { detail: e });
  }

  // Fetch social commerce flags for share buttons + social proof gating
  let socialCommerceFlags: { enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null = null;
  try {
    const socialCommerceState = await publicUnifiedCapabilityService.getSocialCommerceOptionsState(product.tenantId);
    socialCommerceFlags = {
      enabled: socialCommerceState.enabled,
      canUseShareButtons: socialCommerceState.canUseShareButtons,
      canUseSocialProof: socialCommerceState.canUseSocialProof,
    };
  } catch (e) {
    clientLogger.error('Failed to fetch social commerce options:', { detail: e });
  }
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

  // Extract enriched fields from metadata for ProductDetailTabs consumption
  // Mirrors item detail page logic at /t/[tenantId]/items/[itemId]/page.tsx
  const meta = product.metadata || {};
  const enrichedFields: Record<string, any> = {};

  if (meta.ingredients) {
    enrichedFields.ingredients = typeof meta.ingredients === 'string'
      ? meta.ingredients
      : Array.isArray(meta.ingredients)
        ? meta.ingredients.join(', ')
        : String(meta.ingredients);
  }

  if (meta.nutrition) {
    const nutrition = meta.nutrition;
    enrichedFields.nutritionFacts = {};
    if (nutrition.per_100g) {
      const per100g = nutrition.per_100g;
      enrichedFields.nutritionFacts = {
        servingSize: nutrition.servingSize || nutrition.serving_size || 'Per 100g',
        calories: per100g.energy_kcal || per100g['energy-kcal_100g'] || per100g.energy,
        totalFat: per100g.fat != null ? `${per100g.fat}g` : undefined,
        saturatedFat: per100g.saturated_fat != null ? `${per100g.saturated_fat}g` : undefined,
        carbohydrates: per100g.carbohydrates != null ? `${per100g.carbohydrates}g` : undefined,
        sugars: per100g.sugars != null ? `${per100g.sugars}g` : undefined,
        protein: per100g.proteins != null ? `${per100g.proteins}g` : undefined,
        fiber: per100g.fiber != null ? `${per100g.fiber}g` : undefined,
        sodium: per100g.sodium != null ? `${per100g.sodium}g` : undefined,
        salt: per100g.salt != null ? `${per100g.salt}g` : undefined,
      };
    }
    if (nutrition.grade || nutrition.nutrition_grade_fr) {
      enrichedFields.nutriScore = nutrition.grade || nutrition.nutrition_grade_fr;
    }
  }

  if (meta.allergens) {
    enrichedFields.allergens = typeof meta.allergens === 'string'
      ? meta.allergens.split(',').map((a: string) => a.trim()).filter(Boolean)
      : Array.isArray(meta.allergens) ? meta.allergens : [];
  }
  if (meta.allergens_tags && Array.isArray(meta.allergens_tags)) {
    enrichedFields.allergens = [...new Set([...(enrichedFields.allergens || []), ...meta.allergens_tags])];
  }

  if (meta.ingredients_analysis) {
    const analysis = meta.ingredients_analysis;
    enrichedFields.dietaryInfo = [];
    if (analysis.vegan) enrichedFields.dietaryInfo.push('Vegan');
    if (analysis.vegetarian) enrichedFields.dietaryInfo.push('Vegetarian');
    if (analysis.palm_oil_free) enrichedFields.dietaryInfo.push('Palm Oil Free');
  }

  enrichedFields.environmentalInfo = [];
  if (meta.environmental) {
    const env = meta.environmental;
    if (env.ecoscore_grade) {
      enrichedFields.environmentalInfo.push(`Eco-Score: ${env.ecoscore_grade.toUpperCase()}`);
    }
    if (env.carbon_footprint) {
      enrichedFields.environmentalInfo.push(`Carbon Footprint: ${env.carbon_footprint}g CO₂`);
    }
  }
  if (meta.nova_group) {
    enrichedFields.environmentalInfo.push(`Processing Level: NOVA ${meta.nova_group}`);
  }
  if (enrichedFields.environmentalInfo.length === 0) {
    delete enrichedFields.environmentalInfo;
  }

  const productWithEnrichment = {
    ...productWithGallery,
    ...enrichedFields,
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

  // Resolve product page layout from storefront preference + preview param
  const { layout_preview } = await searchParams;
  const productLayout: ProductLayoutKey = resolveProductLayout(
    productOptFlags?.effectiveLayout,
    layout_preview,
  );

  return (
    <>
      <SocialPixels tenantId={product.tenantId} usePublic />
      <ProductLikeProvider>
        {/* SEO Meta Tags — gated behind enhanced SEO capability */}
        {optFlags?.showEnhancedSEO && tenantProfile?.directoryData.seo_keywords && tenantProfile.directoryData.seo_keywords.length > 0 && (
          <>
            {tenantProfile.directoryData.seo_keywords.map((tag: string, index: number) => (
              <meta key={index} name="keywords" content={tag} />
            ))}
          </>
        )}

        {/* Structured Data — gated behind enhanced SEO capability */}
        {optFlags?.showEnhancedSEO && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
        )}

        {/* Product View Tracking */}
        <ProductViewTracker
          productId={product.id}
          tenantId={product.tenantId}
          productName={product.name}
          categoryId={product.category?.id}
        />

        {/* Hero Header - Store Brand Identity, Navigation, Actions */}
        <ProductHeaderSection
          product={product}
          tenantProfile={tenantProfile}
          businessName={businessName}
          currentUrl={currentUrl}
          optFlags={optFlags}
          layoutVariant={productLayout === 'quick-commerce' ? 'quick-commerce' : 'classic'}
          storefrontType={storefrontType}
          socialCommerceFlags={socialCommerceFlags}
        />

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

        {/* Product Detail Area — layout-dependent composition */}
        {productLayout === 'showcase' ? (
          /* ── Layout B: Product Showcase ── */
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <TenantPaymentProvider tenantId={product.tenantId}>
              <ProductShowcaseLayout
                product={{
                  ...productWithEnrichment,
                  featuredTypes: merchantFilteredFeaturedTypes,
                  bucketCounts,
                  slug: product.tenant?.slug || '',
                  videoUrl: (product as any).videoUrl || (product as any).video_url || product.metadata?.videoUrl || null,
                } as any}
                tenant={{
                  id: product.tenantId,
                  name: product.tenant?.name,
                  slug: product.tenant?.slug || '',
                  subscriptionTier: tenant?.subscriptionTier || product.tenant?.subscriptionTier,
                  hasActivePaymentGateway: false,
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
                videoPlayer={(product as any).videoUrl || (product as any).video_url || product.metadata?.videoUrl ? <ProductVideoPlayer videoUrl={(product as any).videoUrl || (product as any).video_url || product.metadata?.videoUrl} title={`${product.title} Video`} /> : undefined}
                fulfillmentPane={productOptFlags?.showsFulfillment !== false ? <FulfillmentOptionsPane tenantId={product.tenantId} isPublic /> : undefined}
                currentUrl={currentUrl}
                initialOptFlags={optFlags}
                productOptFlags={productOptFlags}
                storefrontType={storefrontType}
                socialCommerceFlags={socialCommerceFlags}
              />
            </TenantPaymentProvider>
          </div>
        ) : productLayout === 'quick-commerce' ? (
          /* ── Layout C: Quick Commerce ── */
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <TenantPaymentProvider tenantId={product.tenantId}>
              <ProductQuickCommerceLayout
                disableQRCode
                product={{
                  ...productWithEnrichment,
                  featuredTypes: merchantFilteredFeaturedTypes,
                  bucketCounts,
                  slug: product.tenant?.slug || '',
                  videoUrl: (product as any).videoUrl || (product as any).video_url || product.metadata?.videoUrl || null,
                } as any}
                tenant={{
                  id: product.tenantId,
                  name: product.tenant?.name,
                  slug: product.tenant?.slug || '',
                  subscriptionTier: tenant?.subscriptionTier || product.tenant?.subscriptionTier,
                  hasActivePaymentGateway: false,
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
                videoPlayer={(product as any).videoUrl || (product as any).video_url || product.metadata?.videoUrl ? <ProductVideoPlayer videoUrl={(product as any).videoUrl || (product as any).video_url || product.metadata?.videoUrl} title={`${product.title} Video`} compact /> : undefined}
                fulfillmentPane={productOptFlags?.showsFulfillment !== false ? <FulfillmentOptionsPane tenantId={product.tenantId} isPublic /> : undefined}
                currentUrl={currentUrl}
                initialOptFlags={optFlags}
                productOptFlags={productOptFlags}
                storefrontType={storefrontType}
                socialCommerceFlags={socialCommerceFlags}
              />
            </TenantPaymentProvider>
          </div>
        ) : (
          /* ── Layout A: Classic (default, unchanged) ── */
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Desktop Category Sidebar */}
              <div className="hidden lg:block lg:w-64 flex-shrink-0">
                {productOptFlags?.showsCategories !== false && (
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
                )}
                {/* QR Code - under categories */}
                {productOptFlags?.showsQRCodes !== false && (
                  <TenantQRCode
                    url={currentUrl}
                    tenantId={product.tenantId}
                    label="Scan to Share"
                    capabilityFlags={optFlags}
                    pageType="product"
                    isPublic
                  />
                )}
              </div>

              {/* Mobile Category Dropdown */}
              <div className="lg:hidden w-full">
                {productOptFlags?.showsCategories !== false && (
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
                )}
                {/* QR Code - under categories */}
                {productOptFlags?.showsQRCodes !== false && (
                  <TenantQRCode
                    url={currentUrl}
                    tenantId={product.tenantId}
                    label="Scan to Share"
                    capabilityFlags={optFlags}
                    pageType="product"
                    isPublic
                  />
                )}
              </div>

              {/* Coupon Spotlight Strip */}
              <div className="flex-1 lg:flex-1 min-w-0 w-full lg:w-auto">
                <div className="mb-4">
                  <CouponSpotlight tenantId={product.tenantId} coupon={null} variant="strip" />
                </div>

              {/* Product Description Section */}

              <TenantPaymentProvider tenantId={product.tenantId}>
                  <TierBasedLandingPage
                    disableQRCode
                    product={{
                      ...productWithEnrichment,
                      featuredTypes: merchantFilteredFeaturedTypes,
                      bucketCounts,
                      gtin: undefined,
                      mpn: undefined,
                      defaultGatewayType: undefined,
                      slug: product.tenant?.slug || '',
                    } as any}
                    tenant={{
                      id: product.tenantId,
                      name: product.tenant?.name,
                      slug: product.tenant?.slug || '',
                      subscriptionTier: tenant?.subscriptionTier || product.tenant?.subscriptionTier,
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
                    fulfillmentPane={productOptFlags?.showsFulfillment !== false ? <FulfillmentOptionsPane tenantId={product.tenantId} isPublic /> : undefined}
                    currentUrl={currentUrl}
                    initialOptFlags={optFlags}
                  />
                </TenantPaymentProvider>
              </div>

            </div>
          </div>
        )}
        {/* Business Description - Merchant Branding - Full Width */}
        <ProductPageStatusWrapper tenantInfo={tenantInfoForStatus}>

          {/* Featured Type Products - Full Width */}
          <FeaturedProductsSection
            currentProductId={product.id}
            tenantId={product.tenantId}
            featuredTypes={merchantFilteredFeaturedTypes}
            groupedProducts={merchantFilteredGroupedProducts}
            layoutVariant={productLayout === 'quick-commerce' ? 'quick-commerce' : 'classic'}
          />

          {/* Business Info, Available Nearby, Digital Product Info */}
          <ProductBusinessInfoSection
            product={product}
            tenantProfile={tenantProfile}
            productOptFlags={productOptFlags}
            optFlags={optFlags}
            layoutVariant={productLayout === 'quick-commerce' ? 'quick-commerce' : 'classic'}
          />

          {/* Product Recommendations - Full Width */}
          <ProductRecommendationsSection
            product={product}
            tenantId={product.tenantId}
            tenantSlug={product.tenant?.slug || ''}
            productOptFlags={productOptFlags}
            layoutVariant={productLayout === 'quick-commerce' ? 'quick-commerce' : 'classic'}
            storefrontType={storefrontType}
          />

          {/* Product FAQs */}
          <ProductFAQSection
            tenantId={product.tenantId}
            productId={product.id}
            businessName={businessName}
            faqOptionsFlags={faqOptionsFlags}
            layoutVariant={productLayout === 'quick-commerce' ? 'quick-commerce' : 'classic'}
          />

          {/* Inquiry Form — for tenants without storefront/directory */}
          <ProductInquirySection
            tenantId={product.tenantId}
            businessName={businessName}
            productId={product.id}
            productName={product.name || product.title}
            crmOptionsFlags={crmOptionsFlags}
            layoutVariant={productLayout === 'quick-commerce' ? 'quick-commerce' : 'classic'}
          />

          {/* Product Reviews - Full Width */}
          <ProductReviewsSectionWrapper
            productId={product.id}
            tenantId={product.tenantId}
            productOptFlags={productOptFlags}
            layoutVariant={productLayout === 'quick-commerce' ? 'quick-commerce' : 'classic'}
          />

        </ProductPageStatusWrapper>

        {/* Recently Viewed Products */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {productOptFlags?.showsRecentlyViewed !== false && (
            <LastViewed
              title="Recently Viewed Products"
              entityType="product"
              limit={4}
              showEmptyState={false}
              currentProductId={product.id}
            />
          )}
        </div>

        {/* Storefront Footer (includes platform branding) */}
        <ProductFooterSection
          product={product}
          tenantProfile={tenantProfile}
          businessName={businessName}
          platformSettings={platformSettings}
          optFlags={optFlags}
          currentUrl={currentUrl}
          layoutVariant={productLayout === 'quick-commerce' ? 'quick-commerce' : 'classic'}
          primaryColor={tenant?.metadata?.primaryColor || tenant?.metadata?.primary_color || undefined}
        />
      </ProductLikeProvider>
      <PublicBotWidget
        tenantId={product.tenantId}
        pageContext="product"
        contextEntityName={product.name}
        hasActivePaymentGateway={tenant?.metadata?.hasActivePaymentGateway ?? false}
      />
    </>
  );
}
