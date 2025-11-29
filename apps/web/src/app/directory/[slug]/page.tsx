import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, Mail, Globe, Clock, Share2, ArrowLeft } from 'lucide-react';
import { LocalBusinessStructuredData, BreadcrumbStructuredData } from '@/components/directory/StructuredData';
import RelatedStores from '@/components/directory/RelatedStores';
import DirectoryActions from '@/components/directory/DirectoryActions';

interface StoreDetailPageProps {
  params: {
    slug: string;
  };
}

async function getStoreListing(identifier: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    const res = await fetch(`${apiUrl}/api/directory/${identifier}`, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.listing;
  } catch (error) {
    console.error('Error fetching store:', error);
    return null;
  }
}

async function getStorefrontCategories(tenantId: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    const res = await fetch(`${apiUrl}/api/storefront/${tenantId}/categories`, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });

    if (!res.ok) {
      return { categories: [], uncategorizedCount: 0 };
    }

    const data = await res.json();
    return {
      categories: data.categories || [],
      uncategorizedCount: data.uncategorizedCount || 0,
    };
  } catch (error) {
    console.error('Error fetching storefront categories:', error);
    return { categories: [], uncategorizedCount: 0 };
  }
}

async function getBusinessProfile(tenantId: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    const res = await fetch(`${apiUrl}/public/tenant/${tenantId}/profile`, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching business profile:', error);
    return null;
  }
}

async function getFeaturedProducts(tenantId: string, limit: number = 6) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    const res = await fetch(`${apiUrl}/api/storefront/${tenantId}/products?limit=${limit}`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching featured products:', error);
    return [];
  }
}

async function getRelatedProducts(categorySlug: string, excludeTenantId: string, limit: number = 6) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    // First, get stores in the same category (from directory MV)
    const storesRes = await fetch(`${apiUrl}/api/directory/mv/search?category=${categorySlug}&limit=10`, {
      next: { revalidate: 300 },
    });

    if (!storesRes.ok) {
      return [];
    }

    const storesData = await storesRes.json();
    const otherStores = (storesData.listings || [])
      .filter((l: any) => l.tenant_id !== excludeTenantId)
      .slice(0, 3); // Get 3 other stores

    // Now fetch products from those stores using storefront_products MV
    const productPromises = otherStores.map(async (store: any) => {
      try {
        const productsRes = await fetch(`${apiUrl}/api/storefront/${store.tenant_id}/products?limit=2`, {
          next: { revalidate: 300 },
        });
        
        if (!productsRes.ok) return [];
        
        const productsData = await productsRes.json();
        return (productsData.items || []).map((p: any) => ({
          ...p,
          storeName: store.business_name,
          storeSlug: store.slug,
        }));
      } catch (error) {
        return [];
      }
    });

    const allProducts = (await Promise.all(productPromises)).flat();
    return allProducts.slice(0, limit);
  } catch (error) {
    console.error('Error fetching related products:', error);
    return [];
  }
}

export async function generateMetadata({ params }: StoreDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getStoreListing(slug);

  if (!listing) {
    return {
      title: 'Store Not Found',
    };
  }

  const businessName = listing.business_name || 'Business';
  const title = `${businessName} - ${listing.city}, ${listing.state}`;
  const description = listing.description || 
    `Visit ${businessName} in ${listing.city}, ${listing.state}. ${listing.product_count || 0} products available.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: listing.logo_url ? [listing.logo_url] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: listing.logo_url ? [listing.logo_url] : [],
    },
  };
}

export default async function StoreDetailPage({ params }: StoreDetailPageProps) {
  const { slug: identifier } = await params;
  const listing = await getStoreListing(identifier);

  if (!listing) {
    notFound();
  }

  // Fetch storefront categories with product counts (from materialized view!)
  const { categories: storefrontCategories, uncategorizedCount } = await getStorefrontCategories(listing.tenant_id);
  const totalProducts = storefrontCategories.reduce((sum: number, cat: any) => sum + (cat.count || 0), 0) + uncategorizedCount;

  // Fetch business profile for social links
  const businessProfile = await getBusinessProfile(listing.tenant_id);

  // Fetch products (all powered by materialized view!)
  const featuredProducts = await getFeaturedProducts(listing.tenant_id, 6);
  
  const fullAddress = [
    listing.address,
    listing.city,
    listing.state,
    listing.zip_code,
  ].filter(Boolean).join(', ');

  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
  const currentUrl = `${baseUrl}/directory/${identifier}`;

  // For RelatedStores, we need the slug (not tenant ID)
  const slugForRelated = identifier.startsWith('t-') ? listing.slug : identifier;

  // Get primary category for related stores and products
  const primaryCategory = listing.categories?.find((c: any) => c.isPrimary) || listing.categories?.[0];
  const relatedProducts = primaryCategory ? await getRelatedProducts(primaryCategory.slug, listing.tenant_id, 6) : [];

  return (
    <>
      {/* Structured Data for SEO */}
      <LocalBusinessStructuredData listing={listing} url={currentUrl} />
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: baseUrl },
          { name: 'Directory', url: `${baseUrl}/directory` },
          { name: listing.business_name, url: currentUrl },
        ]}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link 
              href="/directory"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Directory
            </Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Sidebar - Categories */}
            <div className="lg:col-span-3 space-y-6">
              {/* Store Type Categories */}
              {listing.gbpCategories && listing.gbpCategories.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Store Type
                  </h2>
                  <div className="space-y-2">
                    {listing.gbpCategories.filter((c: any) => c.isPrimary).map((category: any) => (
                      <Link
                        key={category.id}
                        href={`/directory/stores/${category.slug}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors group"
                      >
                        <span className="text-sm text-blue-900 font-semibold">
                          {category.name}
                        </span>
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                          Primary
                        </span>
                      </Link>
                    ))}
                    {listing.gbpCategories.filter((c: any) => !c.isPrimary).map((category: any) => (
                      <Link
                        key={category.id}
                        href={`/directory/stores/${category.slug}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <span className="text-sm text-gray-700 group-hover:text-blue-600">
                          {category.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Categories */}
              {storefrontCategories.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Product Categories
                  </h2>
                  <div className="space-y-2">
                    {storefrontCategories.map((category: any) => (
                      <Link
                        key={category.id}
                        href={`/tenant/${listing.tenant_id}?category=${category.slug}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <span className="text-sm text-gray-700 group-hover:text-blue-600 font-medium">
                          {category.name}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {category.count}
                        </span>
                      </Link>
                    ))}
                    {uncategorizedCount > 0 && (
                      <Link
                        href={`/tenant/${listing.tenant_id}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <span className="text-sm text-gray-500 group-hover:text-blue-600">
                          Other Products
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {uncategorizedCount}
                        </span>
                      </Link>
                    )}
                    <Link
                      href={`/tenant/${listing.tenant_id}`}
                      className="block text-sm text-blue-600 hover:text-blue-700 mt-4 font-medium"
                    >
                      View All Products →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Middle Column - Main Info */}
            <div className="lg:col-span-6 space-y-6">
              {/* Store Header */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-start gap-6">
                  {listing.logo_url && (
                    <img
                      src={listing.logo_url}
                      alt={listing.business_name}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                      {listing.business_name}
                    </h1>
                    {/* Display categories with primary/secondary separation */}
                    {listing.categories && listing.categories.length > 0 && (
                      <div className="mb-2 space-y-2">
                        {/* Primary Category - Prominent Display */}
                        {listing.categories.filter((c: any) => c.isPrimary).map((category: any) => (
                          <div key={category.id} className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Primary:
                            </span>
                            <Link
                              href={`/directory/categories/${category.slug}`}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-full font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
                            >
                              {category.icon && <span className="text-base">{category.icon}</span>}
                              <span>{category.name}</span>
                            </Link>
                          </div>
                        ))}
                        
                        {/* Secondary Categories - Subtle Display */}
                        {listing.categories.filter((c: any) => !c.isPrimary).length > 0 && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-1">
                              Also:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {listing.categories.filter((c: any) => !c.isPrimary).map((category: any, index: number) => (
                                <Link
                                  key={category.id || index}
                                  href={`/directory/categories/${category.slug}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                >
                                  {category.icon && <span className="text-sm">{category.icon}</span>}
                                  <span>{category.name}</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  {listing.product_count > 0 && (
                    <p className="text-gray-600 mt-2">
                      {listing.product_count} products available
                    </p>
                  )}
                </div>
                <DirectoryActions listing={listing} currentUrl={currentUrl} />
              </div>

              {listing.description && (
                <p className="mt-6 text-gray-700 leading-relaxed">
                  {listing.description}
                </p>
              )}
            </div>
          </div>

          {/* Right Column - Contact & Hours */}
          <div className="lg:col-span-3 space-y-6">
            {/* Contact Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Contact Information
              </h2>
              <div className="space-y-4">
                {fullAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Address</p>
                      <p className="text-sm text-gray-600">{fullAddress}</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-block"
                      >
                        Get Directions →
                      </a>
                    </div>
                  </div>
                )}

                {listing.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Phone</p>
                      <a
                        href={`tel:${listing.phone}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        {listing.phone}
                      </a>
                    </div>
                  </div>
                )}

                {listing.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email</p>
                      <a
                        href={`mailto:${listing.email}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        {listing.email}
                      </a>
                    </div>
                  </div>
                )}

                {listing.website && (
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Website</p>
                      <a
                        href={listing.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 break-all"
                      >
                        {listing.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Social Links */}
              {(businessProfile?.social_links?.facebook ||
                businessProfile?.social_links?.instagram ||
                businessProfile?.social_links?.twitter ||
                businessProfile?.social_links?.linkedin) && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Follow Us</h3>
                  <div className="flex flex-wrap gap-3">
                    {businessProfile.social_links.facebook && (
                      <a
                        href={businessProfile.social_links.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
                        title="Facebook"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </a>
                    )}
                    {businessProfile.social_links.instagram && (
                      <a
                        href={businessProfile.social_links.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-pink-600 hover:text-pink-700 transition-colors"
                        title="Instagram"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </a>
                    )}
                    {businessProfile.social_links.twitter && (
                      <a
                        href={businessProfile.social_links.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-500 transition-colors"
                        title="Twitter"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                        </svg>
                      </a>
                    )}
                    {businessProfile.social_links.linkedin && (
                      <a
                        href={businessProfile.social_links.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-700 hover:text-blue-800 transition-colors"
                        title="LinkedIn"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Business Hours */}
            {listing.business_hours && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Business Hours
                </h2>
                <div className="space-y-2">
                  {Object.entries(listing.business_hours).map(([day, hours]: [string, any]) => (
                    <div key={day} className="flex justify-between text-sm">
                      <span className="font-medium text-gray-900 capitalize">{day}</span>
                      <span className="text-gray-600">
                        {hours.closed ? 'Closed' : `${hours.open} - ${hours.close}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Featured Products from this Store */}
      {featuredProducts.length > 0 && (
        <div className="bg-white border-t">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
              <Link
                href={`/tenant/${listing.tenant_id}`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All Products →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {featuredProducts.map((product: any) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group"
                >
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    {product.imageUrl || product.image_url ? (
                      <img
                        src={product.imageUrl || product.image_url}
                        alt={product.name || product.title}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No image</span>
                      </div>
                    )}
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600">
                        {product.name || product.title}
                      </h3>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        ${product.price}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Related Products from Similar Stores */}
      {relatedProducts.length > 0 && primaryCategory && (
        <div className="bg-gray-50 border-t">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">More in {primaryCategory.name}</h2>
                <p className="text-sm text-gray-600 mt-1">Products from similar stores</p>
              </div>
              <Link
                href={`/directory/categories/${primaryCategory.slug}`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Browse Category →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {relatedProducts.map((product: any) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group"
                >
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    {product.imageUrl || product.image_url ? (
                      <img
                        src={product.imageUrl || product.image_url}
                        alt={product.name || product.title}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No image</span>
                      </div>
                    )}
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600">
                        {product.name || product.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {product.storeName}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        ${product.price}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Call-to-Action: Visit Storefront */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 border-t border-blue-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Shop at {listing.business_name}?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Browse {totalProducts} products, view detailed information, and discover everything this store has to offer.
          </p>
          <Link
            href={`/tenant/${listing.tenant_id}`}
            className="inline-flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-lg hover:shadow-xl"
          >
            Visit Storefront
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Related Stores */}
      <RelatedStores currentSlug={slugForRelated} />
    </>
  );
}
