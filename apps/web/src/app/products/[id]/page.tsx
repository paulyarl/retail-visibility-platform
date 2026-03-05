import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import ProductGallery from '@/components/products/ProductGallery';
import { TierBasedLandingPage } from '@/components/landing-page/TierBasedLandingPage';
import { ProductNavigation } from '@/components/products/ProductNavigation';
import { ProductRecommendations } from '@/components/products/ProductRecommendations';
import LastViewed from '@/components/directory/LastViewed';
import { computeStoreStatus } from '@/lib/hours-utils';
import { ProductViewTracker } from '@/components/tracking/ProductViewTracker';
import { ProductLikeProvider } from '@/components/likes/ProductLikeProvider';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import ProductBusinessInfoCollapsible from '@/components/products/ProductBusinessInfoCollapsible';
import ProductReviewsSection from '@/components/products/ProductReviewsSection';
import FulfillmentOptionsPane from '@/components/storefront/FulfillmentOptionsPane';
import StorefrontActions from '@/components/storefront/StorefrontActions';
import { enhancedProductService, type EnhancedProduct, type FeaturedType } from '@/services/EnhancedProductService';
import { productPhotosService, type Photo } from '@/services/ProductPhotosService';
import { Badge, Group } from '@mantine/core';
import { Sparkles, TrendingUp, Star, Tag, Clock, Award, Zap, Flame } from 'lucide-react';

// Force dynamic rendering for product pages
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

async function getProduct(id: string): Promise<EnhancedProduct | null> {
  return await enhancedProductService.fetchProductWithVariants(id);
}

async function getProductPhotos(productData: EnhancedProduct): Promise<Photo[]> {
  return await productPhotosService.getProductPhotos(productData);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }

  const businessName = product.tenant_name || 'Unknown Store';

  return {
    title: `${product.product_title} - ${businessName}`,
    description: product.product_description || `Buy ${product.product_title} from ${businessName}. ${product.brand} - ${product.currency} ${product.price}`,
    openGraph: {
      title: product.product_title,
      description: product.product_description,
      images: product.image_url ? [product.image_url] : [],
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  console.log('[ProductPage] product:', product);

  if (!product) {
    notFound();
  }

  const businessName = product.tenant_name || 'Unknown Store';
  
  // Get featured type badges
  const featuredBadges = enhancedProductService.getFeaturedTypeBadges(product);

  // Check if product is publicly accessible
  const isPubliclyAccessible = product.item_status === 'active' && product.visibility === 'public';
  const statusLabel = product.item_status === 'draft' ? 'Draft' : product.item_status === 'archived' ? 'Archived' : product.item_status;
  const visibilityLabel = product.visibility === 'private' ? 'Private' : 'Public';

  // Build image gallery: use images from product data
  const photos = await getProductPhotos(product);
  const gallery = photos.length > 0
    ? photos
    : (product.image_url ? [{ url: product.image_url, alt: product.product_title, caption: null, position: 0 }] : []);

  // Structured data for Google
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.product_title,
    description: product.product_description,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    sku: product.sku,
    gtin: product.gtin,
    mpn: product.mpn,
    image: gallery.map((p: Photo) => p.url),
    offers: {
      '@type': 'Offer',
      url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://rvp.vercel.app'}/products/${product.inventory_item_id}`,
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
        productId={product.inventory_item_id}
        tenantId={product.tenant_id}
        categoryId={product.product_category}
      />

      {/* Navigation Buttons (for authenticated users) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <ProductNavigation tenantId={product.tenant_id} directorySlug={product.tenant_slug} />
        
        {/* Featured Type Badges - moved below, keeping space */}
        
        {/* Storefront Actions */}
        <div className="flex justify-end mt-4">
          <StorefrontActions 
            tenantId={product.tenant_id}
            businessName={businessName}
            currentUrl={typeof window !== 'undefined' ? window.location.href : ''}
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
                  {product.item_status === 'draft' && 'This product is in draft mode. Activate it to make it publicly accessible.'}
                  {product.item_status === 'archived' && 'This product is archived. Restore it to active status to make it publicly accessible.'}
                  {product.item_status === 'inactive' && 'This product is inactive. Activate it to make it publicly accessible.'}
                  {product.visibility === 'private' && product.item_status === 'active' && 'This product is set to private. Change visibility to public to make it accessible.'}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  💡 Only you can see this page because you're authenticated. Public visitors will see a 404 error.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tier-Based Landing Page with Gallery (only if multiple images) */}
      <TierBasedLandingPage 
        product={{
          id: product.inventory_item_id,
          tenantId: product.tenant_id,
          name: product.product_name,
          title: product.product_title,
          description: product.product_description,
          marketingDescription: product.marketing_description,
          price: parseFloat(product.price),
          priceCents: product.current_price_cents,
          salePriceCents: product.sale_price_cents,
          currency: product.currency,
          imageUrl: product.image_url,
          imageGallery: product.gallery_urls,
          brand: product.brand,
          sku: product.sku,
          stock: product.stock,
          availability: product.availability,
          tenantCategoryId: product.product_category,
          featuredTypes: product.featured_type_array,
          gtin: product.gtin,
          mpn: product.mpn,
          defaultGatewayType: 'square', // Default payment gateway type
          // Pass features and specifications from product_metadata
          features: product.product_metadata?.features,
          specifications: product.product_metadata?.specifications,
        } as any}
        tenant={{
          id: product.tenant_id,
          name: product.tenant_name,
          slug: product.tenant_slug,
          subscriptionTier: product.subscription_tier,
          hasActivePaymentGateway: true, // Enable Add to Cart button
          metadata: {
            businessName: product.tenant_name,
            address: product.tenant_address,
            logo_url: product.tenant_logo_url,
          },
        } as any}
        storeStatus={null}
        gallery={gallery.length > 1 ? <ProductGallery gallery={gallery} productTitle={product.product_title} /> : undefined}
        fulfillmentPane={<FulfillmentOptionsPane tenantId={product.tenant_id} />}
      />

      {/* Product Recommendations */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProductRecommendations productId={product.inventory_item_id} tenantId={product.tenant_id} />
      </div>

      {/* Product Reviews */}
      <div className="bg-neutral-50 dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ProductReviewsSection productId={product.inventory_item_id} tenantId={product.tenant_id} />
        </div>
      </div>

      {/* Business Information */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProductBusinessInfoCollapsible product={product as any} tenant={{ id: product.tenant_id, name: product.tenant_name, metadata: { businessName: product.tenant_name, address: product.tenant_address, logo_url: product.tenant_logo_url } }} storeStatus={null} />
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
