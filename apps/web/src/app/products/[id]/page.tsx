import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Metadata } from 'next';

// Force dynamic rendering for product pages
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

interface Product {
  id: string;
  sku: string;
  name: string;
  title: string;
  brand: string;
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
}

interface Tenant {
  id: string;
  name: string;
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
      type: 'product',
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
  const contactEmail = tenant.metadata?.email;
  const contactPhone = tenant.metadata?.phone;
  const businessWebsite = tenant.metadata?.website;

  // Format price
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: product.currency,
  }).format(product.price);

  // Availability badge
  const availabilityConfig = {
    in_stock: { label: 'In Stock', color: 'bg-green-100 text-green-800' },
    out_of_stock: { label: 'Out of Stock', color: 'bg-red-100 text-red-800' },
    preorder: { label: 'Pre-order', color: 'bg-blue-100 text-blue-800' },
  };

  const availability = availabilityConfig[product.availability] || availabilityConfig.in_stock;

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

      <div className="min-h-screen bg-neutral-50">
        {/* Header */}
        <header className="bg-white border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-neutral-900">{businessName}</h1>
              {businessWebsite && (
                <a
                  href={businessWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Visit Store →
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Product Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 lg:p-8">
              {/* Product Image */}
              <div className="aspect-square relative bg-neutral-100 rounded-lg overflow-hidden">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-400">
                    <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="flex flex-col">
                {/* Brand */}
                <p className="text-sm text-neutral-600 mb-2">{product.brand}</p>

                {/* Title */}
                <h1 className="text-3xl font-bold text-neutral-900 mb-4">{product.title}</h1>

                {/* Price */}
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-4xl font-bold text-neutral-900">{formattedPrice}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${availability.color}`}>
                    {availability.label}
                  </span>
                </div>

                {/* Description */}
                {product.description && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-neutral-900 mb-2">Description</h2>
                    <p className="text-neutral-700 leading-relaxed">{product.description}</p>
                  </div>
                )}

                {/* Product Details */}
                <div className="border-t border-neutral-200 pt-6 space-y-3">
                  <h2 className="text-lg font-semibold text-neutral-900 mb-4">Product Details</h2>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-neutral-600">SKU:</span>
                      <span className="ml-2 text-neutral-900 font-medium">{product.sku}</span>
                    </div>
                    
                    {product.condition && (
                      <div>
                        <span className="text-neutral-600">Condition:</span>
                        <span className="ml-2 text-neutral-900 font-medium capitalize">{product.condition}</span>
                      </div>
                    )}
                    
                    {product.gtin && (
                      <div>
                        <span className="text-neutral-600">GTIN:</span>
                        <span className="ml-2 text-neutral-900 font-medium">{product.gtin}</span>
                      </div>
                    )}
                    
                    {product.mpn && (
                      <div>
                        <span className="text-neutral-600">MPN:</span>
                        <span className="ml-2 text-neutral-900 font-medium">{product.mpn}</span>
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  {product.categoryPath && product.categoryPath.length > 0 && (
                    <div className="pt-3">
                      <span className="text-neutral-600 text-sm">Category:</span>
                      <span className="ml-2 text-neutral-900 text-sm">{product.categoryPath.join(' › ')}</span>
                    </div>
                  )}
                </div>

                {/* Contact CTA */}
                <div className="mt-8 pt-6 border-t border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Interested in this product?</h3>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {contactPhone && (
                      <a
                        href={`tel:${contactPhone}`}
                        className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                      >
                        Call Us
                      </a>
                    )}
                    {contactEmail && (
                      <a
                        href={`mailto:${contactEmail}?subject=Inquiry about ${product.title}`}
                        className="flex-1 bg-white border-2 border-blue-600 text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors text-center"
                      >
                        Email Us
                      </a>
                    )}
                    {!contactPhone && !contactEmail && businessWebsite && (
                      <a
                        href={businessWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                      >
                        Visit Store
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Store Info */}
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">About {businessName}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {tenant.metadata?.address && (
                <div>
                  <span className="text-neutral-600">Address:</span>
                  <p className="text-neutral-900 mt-1">{tenant.metadata.address}</p>
                </div>
              )}
              {contactPhone && (
                <div>
                  <span className="text-neutral-600">Phone:</span>
                  <p className="text-neutral-900 mt-1">{contactPhone}</p>
                </div>
              )}
              {contactEmail && (
                <div>
                  <span className="text-neutral-600">Email:</span>
                  <p className="text-neutral-900 mt-1">{contactEmail}</p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-neutral-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-center text-sm text-neutral-600">
              © {new Date().getFullYear()} {businessName}. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
