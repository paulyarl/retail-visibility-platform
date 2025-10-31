import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ProductGallery from '@/components/products/ProductGallery';
import { TierBasedLandingPage } from '@/components/landing-page/TierBasedLandingPage';
import { BackToInventoryButton } from '@/components/products/BackToInventoryButton';

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
  categoryPath?: string[];
  condition?: string;
  gtin?: string;
  mpn?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
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
  };
}

async function getProduct(id: string): Promise<{ product: Product; tenant: Tenant } | null> {
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

    const product: Product = await productRes.json();

    // Fetch tenant info
    const tenantRes = await fetch(`${apiBaseUrl}/tenants/${product.tenantId}`, {
      cache: 'no-store',
    });

    const tenant: Tenant = tenantRes.ok ? await tenantRes.json() : { id: product.tenantId, name: 'Store' };

    // Fetch business profile using public endpoint (no auth required)
    try {
      const profileRes = await fetch(`${apiBaseUrl}/public/tenant/${product.tenantId}/profile`, {
        cache: 'no-store',
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        // Merge business profile data into tenant metadata
        tenant.metadata = {
          ...tenant.metadata,
          businessName: profile.business_name,
          phone: profile.phone_number,
          email: profile.email,
          website: profile.website,
          address: profile.address_line1 
            ? `${profile.address_line1}${profile.address_line2 ? ', ' + profile.address_line2 : ''}, ${profile.city}, ${profile.state} ${profile.postal_code}`
            : undefined,
          logo_url: profile.logo_url,
        };
      }
    } catch (e) {
      // Profile fetch failed, continue without it
      console.error('Failed to fetch business profile:', e);
    }

    return { product, tenant };
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
    const res = await fetch(`${apiBaseUrl}/items/${id}/photos`, { cache: 'no-store' });
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

  const { product, tenant } = data;
  const businessName = tenant.metadata?.businessName || tenant.name;

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
      seller: {
        '@type': 'Organization',
        name: businessName,
      },
    },
  };

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Back to Inventory Button (for authenticated users) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <BackToInventoryButton tenantId={product.tenantId} />
      </div>

      {/* Tier-Based Landing Page with Gallery (only if multiple images) */}
      <TierBasedLandingPage 
        product={product} 
        tenant={tenant}
        gallery={gallery.length > 1 ? <ProductGallery gallery={gallery} productTitle={product.title} /> : undefined}
      />
    </>
  );
}
