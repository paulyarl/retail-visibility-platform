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

// Force dynamic rendering for product pages
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

interface Product {
  id: string;
  sku: string;
  name: string;
  title: string;
  brand: string;
  manufacturer?: string;
  description?: string;
  price: number;
  currency: string;
  priceCents: number;
  stock: number;
  imageUrl?: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  itemStatus?: 'active' | 'inactive' | 'draft' | 'archived';
  visibility?: 'public' | 'private';
  categoryPath?: string[];
  condition?: string;
  gtin?: string;
  mpn?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  
  // Category assignment
  tenantCategoryId?: string | null;
  tenantCategory?: {
    id: string;
    name: string;
    slug: string;
    googleCategoryId?: string | null;
  } | null;
  
  // Enriched barcode data
  upc?: string;
  
  // Nutrition & dietary
  nutritionFacts?: {
    servingSize?: string;
    calories?: number;
    totalFat?: string;
    saturatedFat?: string;
    transFat?: string;
    cholesterol?: string;
    sodium?: string;
    totalCarbohydrate?: string;
    dietaryFiber?: string;
    sugars?: string;
    protein?: string;
    [key: string]: any;
  };
  allergens?: string[];
  ingredients?: string;
  dietaryInfo?: string[];
  nutriScore?: string;
  
  // Physical attributes
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
  weight?: {
    value?: number;
    unit?: string;
  };
  
  // Additional specs
  specifications?: Record<string, any>;
  environmentalInfo?: string[];
  
  // Tier-based landing page fields
  marketingDescription?: string;
  imageGallery?: string[];
  customCta?: {
    text: string;
    link: string;
    style?: string;
  };
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  customBranding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  customSections?: Array<{
    type: string;
    title: string;
    content: string;
  }>;
  landingPageTheme?: string;
}

interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  metadata?: {
    businessName?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    logo_url?: string;
    social_links?: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
      linkedin?: string;
    };
  };
}

async function getProduct(id: string): Promise<{ product: Product; tenant: Tenant; storeStatus?: any; directorySlug?: string } | null> {
  try {
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    
    // Fetch product
    const productRes = await fetch(`${apiBaseUrl}/items/${id}`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!productRes.ok) {
      return null;
    }

    const productData = await productRes.json();
    
    // Extract enriched fields from metadata if present
    const metadata = productData.metadata || {};
    const enrichedFields: any = {};
    
    // Extract AI-generated enriched content from metadata
    if (metadata.enhancedDescription) {
      enrichedFields.marketingDescription = metadata.enhancedDescription;
    }
    if (metadata.features && Array.isArray(metadata.features)) {
      enrichedFields.environmentalInfo = metadata.features; // Reuse environmentalInfo for features display
    }
    if (metadata.specifications && typeof metadata.specifications === 'object') {
      enrichedFields.specifications = {
        ...(productData.specifications || {}),
        ...metadata.specifications
      };
    }
    
    // Normalize field names from snake_case to camelCase
    const product: Product = {
      ...productData,
      ...enrichedFields,
      itemStatus: productData.itemStatus || productData.item_status || 'active',
      tenantId: productData.tenantId || productData.tenant_id,
      tenantCategoryId: productData.tenantCategoryId || productData.directory_category_id || null,
      tenantCategory: productData.tenantCategory || null,
      condition: productData.condition === 'brand_new' ? 'new' : productData.condition,
    };

    // Fetch tenant info and business profile using public endpoint
    const profileRes = await fetch(`${apiBaseUrl}/public/tenant/${product.tenantId}/profile`, {
      cache: 'no-store',
    });

    const tenant: Tenant = { id: product.tenantId, name: 'Store', metadata: {} };
    
    let storeStatus = null;
    if (profileRes.ok) {
      const profile = await profileRes.json();
      // Extract business name from profile
      tenant.name = profile.business_name || 'Store';
      // Merge business profile data into tenant metadata
      tenant.metadata = {
        businessName: profile.business_name,
        phone: profile.phone_number,
        email: profile.email,
        website: profile.website,
        address: profile.address_line1 
          ? `${profile.address_line1}${profile.address_line2 ? ', ' + profile.address_line2 : ''}, ${profile.city}, ${profile.state} ${profile.postal_code}`
          : undefined,
        logo_url: profile.logo_url,
        social_links: profile.social_links,
      };
      
      // Extract store hours for status calculation
      storeStatus = computeStoreStatus(profile.hours);
    }
    
    // Return tenant ID for directory link (we'll use tenant ID directly)
    return { product, tenant, storeStatus, directorySlug: product.tenantId };
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

type Photo = {
  url: string;
  alt?: string | null;
  caption?: string | null;
  position: number;
};

async function getProductPhotos(id: string): Promise<Photo[]> {
  try {
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${apiBaseUrl}/api/items/${id}/photos`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    // Expecting array of { url, position, alt, caption } objects
    const sorted = (data as Array<{ url?: string; position?: number; alt?: string | null; caption?: string | null }>)
      .filter((p) => typeof p?.url === 'string' && (p.url as string).length > 0)
      .sort((a, b) => ((a?.position ?? 0) - (b?.position ?? 0)));
    return sorted.map((p) => ({
      url: p.url as string,
      alt: p.alt,
      caption: p.caption,
      position: p.position ?? 0,
    }));
  } catch (_e) {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getProduct(id);

  if (!data) {
    return {
      title: 'Product Not Found',
    };
  }

  const { product, tenant } = data;
  const businessName = tenant.metadata?.businessName || tenant.name;

  return {
    title: `${product.title} - ${businessName}`,
    description: product.description || `Buy ${product.title} from ${businessName}. ${product.brand} - ${product.currency} ${product.price}`,
    openGraph: {
      title: product.title,
      description: product.description,
      images: product.imageUrl ? [product.imageUrl] : [],
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProduct(id);

  if (!data) {
    notFound();
  }

  const { product, tenant, storeStatus, directorySlug } = data;
  const businessName = tenant.metadata?.businessName || tenant.name;
  
  // Track product view for recommendations (using client component)
  // This will run on the client side where we can access localStorage for user info

  // Check if product is publicly accessible
  const isPubliclyAccessible = product.itemStatus === 'active' && product.visibility === 'public';
  const statusLabel = product.itemStatus === 'draft' ? 'Draft' : product.itemStatus === 'archived' ? 'Archived' : product.itemStatus;
  const visibilityLabel = product.visibility === 'private' ? 'Private' : 'Public';

  // Build image gallery: try photos endpoint; fall back to product.imageUrl
  const photos = await getProductPhotos(product.id);
  const gallery = photos.length > 0
    ? photos
    : (product.imageUrl ? [{ url: product.imageUrl, alt: product.title, caption: null, position: 0 }] : []);

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
    gtin: product.gtin,
    mpn: product.mpn,
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
        categoryId={product.tenantCategoryId}
      />

      {/* Navigation Buttons (for authenticated users) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <ProductNavigation tenantId={product.tenantId} directorySlug={directorySlug} />
        
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

      {/* Tier-Based Landing Page with Gallery (only if multiple images) */}
      <TierBasedLandingPage 
        product={product} 
        tenant={tenant}
        storeStatus={storeStatus}
        gallery={gallery.length > 1 ? <ProductGallery gallery={gallery} productTitle={product.title} /> : undefined}
      />

      {/* Product Recommendations */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProductRecommendations productId={product.id} tenantId={product.tenantId} />
      </div>

      {/* Product Reviews */}
      <div className="bg-neutral-50 dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ProductReviewsSection productId={product.id} tenantId={product.tenantId} />
        </div>
      </div>

      {/* Business Information */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProductBusinessInfoCollapsible product={product} tenant={tenant} storeStatus={storeStatus} />
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
