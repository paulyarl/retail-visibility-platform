import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getLandingPageFeatures } from '@/lib/landing-page-tiers';
import TenantMapSection from '@/components/tenant/TenantMapSection';
import { getTenantMapLocation, MapLocation } from '@/lib/map-utils';
import ProductSearch from '@/components/storefront/ProductSearch';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Product {
  id: string;
  sku: string;
  name: string;
  title: string;
  brand: string;
  description?: string;
  price: number;
  currency: string;
  stock: number;
  imageUrl?: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
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

interface PlatformSettings {
  platformName?: string;
  logoUrl?: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
}

async function getTenantWithProducts(tenantId: string, page: number = 1, limit: number = 12, search?: string) {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

    // Fetch tenant basic info
    const tenantRes = await fetch(`${apiBaseUrl}/public/tenant/${tenantId}`, {
      cache: 'no-store',
    });

    if (!tenantRes.ok) {
      return null;
    }

    const tenant: Tenant = await tenantRes.json();

    // Fetch business profile
    try {
      const profileRes = await fetch(`${apiBaseUrl}/public/tenant/${tenantId}/profile`, {
        cache: 'no-store',
      });
      if (profileRes.ok) {
        const businessProfile = await profileRes.json();
        tenant.metadata = {
          ...tenant.metadata,
          businessName: businessProfile.business_name,
          phone: businessProfile.phone_number,
          email: businessProfile.email,
          website: businessProfile.website,
          address: businessProfile.address_line1 
            ? `${businessProfile.address_line1}${businessProfile.address_line2 ? ', ' + businessProfile.address_line2 : ''}, ${businessProfile.city}, ${businessProfile.state} ${businessProfile.postal_code}`
            : undefined,
          logo_url: businessProfile.logo_url,
        };
      }
    } catch (e) {
      console.error('Failed to fetch business profile:', e);
    }

    // Fetch map location using utility
    const mapLocation = await getTenantMapLocation(tenantId);

    // Fetch products for this tenant with optional search
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const productsRes = await fetch(`${apiBaseUrl}/items?tenantId=${tenantId}&page=${page}&limit=${limit}${searchParam}`, {
      cache: 'no-store',
    });

    const productsData = productsRes.ok ? await productsRes.json() : { items: [], total: 0 };
    const products: Product[] = Array.isArray(productsData.items) ? productsData.items : [];
    const total = productsData.total || 0;

    // Fetch platform settings for footer
    let platformSettings: PlatformSettings = {};
    try {
      const settingsRes = await fetch(`${apiBaseUrl}/platform-settings`, {
        cache: 'no-store',
      });
      if (settingsRes.ok) {
        platformSettings = await settingsRes.json();
      }
    } catch (e) {
      console.error('Failed to fetch platform settings:', e);
    }

    return { tenant, products, total, page, limit, platformSettings, mapLocation };
  } catch (error) {
    console.error('Error fetching tenant storefront:', error);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getTenantWithProducts(id);

  if (!data) {
    return {
      title: 'Store Not Found',
    };
  }

  const { tenant } = data;
  const businessName = tenant.metadata?.businessName || tenant.name;

  return {
    title: `${businessName} - Product Catalog`,
    description: `Browse products from ${businessName}. ${tenant.metadata?.address || ''}`,
    openGraph: {
      title: businessName,
      description: `Shop products from ${businessName}`,
      images: tenant.metadata?.logo_url ? [tenant.metadata.logo_url] : [],
      type: 'website',
    },
  };
}

export default async function TenantStorefrontPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { page: pageParam, search } = await searchParams;
  const currentPage = parseInt(pageParam || '1', 10);
  
  const data = await getTenantWithProducts(id, currentPage, 12, search);

  if (!data) {
    notFound();
  }

  const { tenant, products, total, limit, platformSettings, mapLocation } = data;
  const businessName = tenant.metadata?.businessName || tenant.name;
  const totalPages = Math.ceil(total / limit);
  
  // Get tier features for footer
  const tier = tenant.subscriptionTier || 'trial';
  const features = getLandingPageFeatures(tier);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header with Business Info */}
      <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-6">
            {tenant.metadata?.logo_url && (
              <div className="relative w-24 h-24 flex-shrink-0">
                <Image
                  src={tenant.metadata.logo_url}
                  alt={businessName}
                  fill
                  className="object-contain rounded-lg"
                />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
                {businessName}
              </h1>
              {tenant.metadata?.address && (
                <p className="text-neutral-600 dark:text-neutral-400 mt-2">
                  📍 {tenant.metadata.address}
                </p>
              )}
              <div className="flex gap-4 mt-3 text-sm">
                {tenant.metadata?.phone && (
                  <a href={`tel:${tenant.metadata.phone}`} className="text-primary-600 hover:text-primary-700">
                    📞 {tenant.metadata.phone}
                  </a>
                )}
                {tenant.metadata?.email && (
                  <a href={`mailto:${tenant.metadata.email}`} className="text-primary-600 hover:text-primary-700">
                    ✉️ {tenant.metadata.email}
                  </a>
                )}
                {tenant.metadata?.website && (
                  <a href={tenant.metadata.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700">
                    🌐 Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header with Search */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">
              Products ({total})
              {search && (
                <span className="text-base font-normal text-neutral-600 dark:text-neutral-400 ml-2">
                  - Results for "{search}"
                </span>
              )}
            </h2>
            {totalPages > 1 && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Page {currentPage} of {totalPages}
              </p>
            )}
          </div>
          
          {/* Search Box */}
          <div className="max-w-md">
            <ProductSearch tenantId={id} />
          </div>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-600 dark:text-neutral-400 text-lg">
              {search 
                ? `No products found matching "${search}". Try a different search term.`
                : 'No products available at this time.'}
            </p>
          </div>
        ) : (
          <>
            {/* Product Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Product Image */}
                  <div className="relative aspect-square bg-neutral-100 dark:bg-neutral-700">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                        <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    {/* Stock Badge */}
                    {product.availability === 'out_of_stock' && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                        Out of Stock
                      </div>
                    )}
                    {product.availability === 'preorder' && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                        Pre-order
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                      {product.brand}
                    </p>
                    <h3 className="font-semibold text-neutral-900 dark:text-white line-clamp-2 mb-2">
                      {product.title}
                    </h3>
                    {product.description && (
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
                        {product.currency} {product.price.toFixed(2)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        SKU: {product.sku}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                {currentPage > 1 && (
                  <Link
                    href={`/tenant/${id}?page=${currentPage - 1}`}
                    className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    ← Previous
                  </Link>
                )}
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Link
                      key={pageNum}
                      href={`/tenant/${id}?page=${pageNum}`}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        pageNum === currentPage
                          ? 'bg-primary-600 text-white'
                          : 'border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {pageNum}
                    </Link>
                  );
                })}

                {currentPage < totalPages && (
                  <Link
                    href={`/tenant/${id}?page=${currentPage + 1}`}
                    className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Map Section - How to Get There */}
      {mapLocation && (
        <TenantMapSection 
          location={mapLocation} 
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
        />
      )}

      {/* Tier-Based Footer */}
      <footer className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Business Info */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                {businessName}
              </h3>
              
              {/* Contact Information */}
              <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                {/* Phone */}
                {tenant.metadata?.phone && (
                  <p className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a href={`tel:${tenant.metadata.phone}`} className="hover:underline">
                      {tenant.metadata.phone}
                    </a>
                  </p>
                )}

                {/* Email */}
                {tenant.metadata?.email && (
                  <p className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <a href={`mailto:${tenant.metadata.email}`} className="hover:underline">
                      {tenant.metadata.email}
                    </a>
                  </p>
                )}

                {/* Website */}
                {tenant.metadata?.website && (
                  <p className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <a href={tenant.metadata.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {tenant.metadata.website}
                    </a>
                  </p>
                )}

                {/* Address - Required for NAP */}
                {tenant.metadata?.address && (
                  <p className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{tenant.metadata.address}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Quick Links
              </h3>
              <div className="space-y-2 text-sm">
                <Link href={`/tenant/${id}`} className="block text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400">
                  All Products
                </Link>
                {tenant.metadata?.website && (
                  <a href={tenant.metadata.website} target="_blank" rel="noopener noreferrer" className="block text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400">
                    Visit Website
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Platform Branding (unless Enterprise with removal) */}
          {!features.removePlatformBranding && (
            <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-700 text-center text-sm text-neutral-500">
              <p>Powered by {platformSettings?.platformName || 'Visible Shelf'} ⚡</p>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
