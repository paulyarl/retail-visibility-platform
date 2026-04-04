import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import ProductGallery from '@/components/products/ProductGallery';
import { TierBasedLandingPage } from '@/components/landing-page/TierBasedLandingPage';
import { ProductNavigation } from '@/components/products/ProductNavigation';
import { ProductRecommendations } from '@/components/products/ProductRecommendations';
import { FeaturedTypeProducts } from '@/components/products/FeaturedTypeProducts';
import LastViewed from '@/components/directory/LastViewed';
import { computeStoreStatus } from '@/lib/hours-utils';
import { ProductViewTracker } from '@/components/tracking/ProductViewTracker';
import { ProductLikeProvider } from '@/components/likes/ProductLikeProvider';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import ProductBusinessInfoCollapsible from '@/components/products/ProductBusinessInfoCollapsible';
import ProductReviewsSection from '@/components/products/ProductReviewsSection';
import FulfillmentOptionsPane from '@/components/storefront/FulfillmentOptionsPane';
import StorefrontActionsWrapper from '@/components/storefront/StorefrontActionsWrapper';
import { Badge, Group } from '@mantine/core';
import { Sparkles, TrendingUp, Star, Tag, Clock, Award, Zap, Flame } from 'lucide-react';
import { productDataService } from '@/services/ProductDataService';
import { storefrontSingletonService } from '@/services/StorefrontSingletonService';

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
  metadata?: {
    features?: string[];
    enhancedDescription?: string;
  };
  tenantId: string;
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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }

  const businessName = product.tenant?.name || 'Unknown Store';

  return {
    title: `${product.title} - ${businessName}`,
    description: product.description || `Buy ${product.title} from ${businessName}. ${product.brand} - ${product.currency} ${product.price}`,
    openGraph: {
      title: product.title,
      description: product.description,
      images: product.images?.map(img => img.url) || [],
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  
  if (!product) {
    notFound();
  }

  const shopData = await getShopData(product.tenantId);
  const bucketCounts = await getBucketCounts(product.tenantId);
  const businessName = product.tenant?.name || 'Unknown Store';
  
  // Convert images to gallery format for ProductGallery component
  const gallery = product.images?.map(img => ({
    url: img.url,
    alt: product.title,
    caption: null,
    position: img.position,
  })) || [];

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

  // Check if product is publicly accessible
  const isPubliclyAccessible = product.itemStatus === 'active' && product.visibility === 'public';
  const statusLabel = product.itemStatus === 'draft' ? 'Draft' : product.itemStatus === 'archived' ? 'Archived' : product.itemStatus;
  const visibilityLabel = product.visibility === 'private' ? 'Private' : 'Public';

  // Structured data for Google
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    sku: product.sku,
    image: gallery.map(p => p.url),
    offers: {
      '@type': 'Offer',
      url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://rvp.vercel.app'}/products/${product.id}`,
      priceCurrency: product.currency,
      price: product.price,
      availability: `https://schema.org/${product.availability === 'in_stock' ? 'InStock' : 'OutOfStock'}`,
      itemCondition: `https://schema.org/${product.condition === 'used' ? 'UsedCondition' : product.condition === 'refurbished' ? 'RefurbishedCondition' : 'NewCondition'}`,
      seller: {
        '@type': 'Organization',
        name: businessName,
      },
    },
  };

  return (
    <>
    <ProductLikeProvider>
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

      {/* Navigation Buttons (for authenticated users) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <ProductNavigation tenantId={product.tenantId} directorySlug={product.tenant?.slug} />
        
        {/* Featured Type Badges - moved below, keeping space */}
        
        {/* Storefront Actions */}
        <div className="flex justify-end mt-4">
          <StorefrontActionsWrapper 
            tenantId={product.tenantId}
            businessName={businessName}
            showBackButton={true}
          />
        </div>
        
        {/* Alert for non-public products (only shown to authenticated users) */}
        {!isPubliclyAccessible && (
          <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-r-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                  ⚠️ This Product is Not Publicly Accessible
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
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  💡 Only you can see this page because you're authenticated. Public visitors will see a 404 error.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tier-Based Landing Page with Gallery */}
      <TierBasedLandingPage 
        product={{
          id: product.id,
          tenantId: product.tenantId,
          name: product.name,
          title: product.title,
          description: product.description,
          marketingDescription: product.metadata?.enhancedDescription,
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
          // Pass features from metadata
          features: product.metadata?.features,
          specifications: undefined, // Not available in current API
          slug: product.tenant?.slug || '',
          variants: product.variants,
          productType: product.productType,
          digitalDeliveryMethod: product.digitalDeliveryMethod,
          digitalAssets: product.digitalAssets,
          licenseType: product.licenseType,
          accessDurationDays: product.accessDurationDays,
          downloadLimit: product.downloadLimit,
        } as any}
        tenant={{
          id: product.tenantId,
          name: product.tenant?.name,
          slug: product.tenant?.slug || '',
          subscriptionTier: product.tenant?.subscriptionTier,
          hasActivePaymentGateway: false, // Will be determined by service
          defaultGatewayType: undefined,
          metadata: {
            businessName: product.tenant?.name,
            phone: undefined,
            email: undefined,
            website: undefined,
            address: undefined,
            logo_url: undefined,
            social_links: undefined,
          },
        } as any}
        storeStatus={null}
        gallery={gallery.length > 0 ? <ProductGallery gallery={gallery} productTitle={product.title} /> : undefined}
        fulfillmentPane={<FulfillmentOptionsPane tenantId={product.tenantId} />}
      />

      {/* Business Information - Contact Us */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProductBusinessInfoCollapsible 
          product={product as any} 
          tenant={{
            id: product.tenantId, 
            name: product.tenant?.name, 
            metadata: {
              businessName: product.tenant?.name,
              phone: undefined,
              email: undefined,
              website: undefined,
              address: undefined,
              logo_url: undefined,
              social_links: undefined,
            }
          }} 
        />
      </div>

      {/* Product Recommendations */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProductRecommendations productId={product.id} tenantId={product.tenantId} tenantSlug={product.tenant?.slug || ''} />
      </div>

      {/* Featured Type Products - other products with same featured types */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FeaturedTypeProducts 
          currentProductId={product.id} 
          tenantId={product.tenantId} 
          featuredTypes={product.featuredTypes || []}
        />
      </div>

      {/* Product Reviews */}
      <div className="bg-neutral-50 dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ProductReviewsSection productId={product.id} tenantId={product.tenantId} />
        </div>
      </div>

      {/* Recently Viewed Products */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <LastViewed 
          title="Recently Viewed Products"
          entityType="product"
          limit={4}
          showEmptyState={false}
        />
      </div>

      {/* Platform Branding Footer */}
      <PoweredByFooter />
    </ProductLikeProvider>
  </>
);
}
