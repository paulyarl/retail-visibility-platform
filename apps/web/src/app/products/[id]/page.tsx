import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { TierBasedLandingPage } from '@/components/landing-page/TierBasedLandingPage';

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

    return { product, tenant };
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
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
    image: product.imageUrl,
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

      {/* Tier-Based Landing Page */}
      <TierBasedLandingPage product={product} tenant={tenant} />
    </>
  );
}
