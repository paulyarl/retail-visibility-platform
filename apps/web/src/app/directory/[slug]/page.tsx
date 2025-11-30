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

async function getStoreTypeCounts() {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    const res = await fetch(`${apiUrl}/api/directory/store-type-counts`, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });

    if (!res.ok) {
      console.error('Store type counts API failed:', res.status, res.statusText);
      return {};
    }

    const data = await res.json();
    console.log('Store type counts response:', data);
    return data.data?.storeTypeCounts || data.data?.store_type_counts || {};
  } catch (error) {
    console.error('Error fetching store type counts:', error);
    return {};
  }
}

async function getGbpCategoryCounts() {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    const res = await fetch(`${apiUrl}/api/directory/categories-optimized/gbp-counts`, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });

    if (!res.ok) {
      console.error('GBP category counts API failed:', res.status, res.statusText);
      return {};
    }

    const data = await res.json();
    console.log('GBP category counts response:', data);
    
    // Convert categories array to slug->count mapping for easy lookup
    const categoryCounts: Record<string, number> = {};
    if (data.categories && Array.isArray(data.categories)) {
      data.categories.forEach((category: any) => {
        // Use categorySlug first, fallback to category_slug
        const slug = category.categorySlug || category.category_slug;
        const stores = category.totalStores || category.total_stores;
        categoryCounts[slug] = parseInt(stores) || 0;
        
        // Also map category name to slug for common categories
        const categoryName = category.categoryName || category.category_name;
        const nameSlug = categoryName
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Remove duplicate hyphens
          .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
        
        categoryCounts[nameSlug] = parseInt(stores) || 0;
      });
    }
    
    // Add fallback for common categories that might not exist
    categoryCounts['international'] = categoryCounts['international'] || 0;
    categoryCounts['international-foods'] = categoryCounts['international-foods'] || 0;
    
    return categoryCounts;
  } catch (error) {
    console.error('Error fetching GBP category counts:', error);
    return {};
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

// NEW: Track store view for recommendations
async function trackStoreView(tenantId: string, categories: any[] = []) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    // Get user location (reuse existing logic)
    const location = await getUserLocation();
    
    // Get primary category for context
    const primaryCategory = categories.find((c: any) => c.isPrimary) || categories[0];
    
    await fetch(`${apiUrl}/api/recommendations/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'store',
        entityId: tenantId,
        entityName: '', // Will be populated by API
        context: {
          category_id: primaryCategory?.id,
          category_slug: primaryCategory?.slug,
          categories: categories.map((c: any) => ({ id: c.id, slug: c.slug }))
        },
        locationLat: location?.latitude,
        locationLng: location?.longitude,
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        pageType: 'directory_detail'
      })
    });
  } catch (error) {
    console.error('Error tracking store view:', error);
    // Don't throw - tracking failures shouldn't break the page
  }
}

// NEW: Get store recommendations
async function getStoreRecommendations(tenantId: string, categorySlug?: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    // Get user location
    const location = await getUserLocation();
    
    const params = new URLSearchParams();
    if (categorySlug) params.append('categorySlug', categorySlug);
    if (location) {
      params.append('lat', location.latitude.toString());
      params.append('lng', location.longitude.toString());
    }
    
    const response = await fetch(`${apiUrl}/api/recommendations/for-store/${tenantId}?${params}`);
    
    if (!response.ok) return { recommendations: [] };
    
    return await response.json();
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return { recommendations: [] };
  }
}

// NEW: Get user location (reuse from DirectoryClient)
async function getUserLocation(): Promise<{
  latitude: number;
  longitude: number;
  city: string;
  state: string;
} | null> {
  try {
    // Try browser geolocation first
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        });
      });
      
      const { latitude, longitude } = position.coords;
      
      // Reverse geocoding to get city/state
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
      );
      const data = await response.json();
      
      const address = data.address || {};
      const city = address.city || address.town || address.village || 'Unknown';
      const state = address.state || 'Unknown';
      
      return { latitude, longitude, city, state };
    }
  } catch (error) {
    console.warn('Geolocation failed, falling back to IP-based location');
  }
  
  // Fallback to IP-based location
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
    return {
      latitude: data.latitude || 0,
      longitude: data.longitude || 0,
      city: data.city || 'Unknown',
      state: data.region || 'Unknown'
    };
  } catch (error) {
    console.warn('IP location failed, using default');
    return null;
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

  // Fetch store type counts for sidebar
  const storeTypeCounts = await getStoreTypeCounts();

  // Fetch GBP category counts for sidebar
  const gbpCategoryCounts = await getGbpCategoryCounts();

  // Fetch business profile for social links
  const businessProfile = await getBusinessProfile(listing.tenant_id);

  // Fetch products (all powered by materialized view!)
  const featuredProducts = await getFeaturedProducts(listing.tenant_id, 6);
  
  // NEW: Track user behavior for recommendations
  await trackStoreView(listing.tenant_id, listing.categories);
  
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
  
  // NEW: Get recommendations for this store
  const recommendations = await getStoreRecommendations(listing.tenant_id, primaryCategory?.slug);

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
                  
                  {/* Store Type Categories Pane */}
                  <div className="inline-flex flex-wrap gap-2 p-3 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-700/50 mb-4">
                    {listing.gbpCategories
                      .sort((a: any, b: any) => {
                        if (a.isPrimary && !b.isPrimary) return -1;
                        if (!a.isPrimary && b.isPrimary) return 1;
                        return a.name.localeCompare(b.name);
                      })
                      .map((category: any) => (
                        <Link
                          key={category.id}
                          href={`/directory/stores/${category.slug}`}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80 ${
                            category.isPrimary
                              ? 'bg-white dark:bg-neutral-800 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-300 dark:border-blue-600'
                              : 'bg-white/60 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-600'
                          }`}
                        >
                          <span className="text-base">
                            {category.name === 'Grocery store' && '🏪'}
                            {category.name === 'Electronics store' && '🛍️'}
                            {category.name === 'Shoe store' && '👟'}
                            {category.name === 'Supermarket' && '🛒'}
                            {category.name === 'Clothing store' && '👕'}
                            {category.name === 'Hardware store' && '🔧'}
                            {category.name === 'Restaurant' && '🍽️'}
                            {category.name === 'Pharmacy' && '💊'}
                            {category.name === 'Bookstore' && '📚'}
                            {category.name === 'Pet store' && '🐕'}
                            {!['Grocery store', 'Electronics store', 'Shoe store', 'Supermarket', 'Clothing store', 'Hardware store', 'Restaurant', 'Pharmacy', 'Bookstore', 'Pet store'].includes(category.name) && '🏢'}
                          </span>
                          <span>{category.name}</span>
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                            {storeTypeCounts[category.slug] || 0} stores
                          </span>
                          {category.isPrimary && (
                            <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-full">
                              Primary
                            </span>
                          )}
                        </Link>
                      ))}
                  </div>
                  
                  <div className="mt-3 text-right">
                    <Link
                      href="/directory/stores"
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                    >
                      Browse all store types →
                    </Link>
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
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                      {listing.business_name}
                    </h1>
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
            {/* GBP Categories */}
            {listing.categories && listing.categories.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Business Categories
                </h2>
                
                {/* GBP Categories Pane */}
                <div className="inline-flex flex-wrap gap-2 p-3 bg-linear-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-700/50 mb-4">
                  {listing.categories
                    .sort((a: any, b: any) => {
                      if (a.isPrimary && !b.isPrimary) return -1;
                      if (!a.isPrimary && b.isPrimary) return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((category: any) => (
                      <Link
                        key={category.id}
                        href={`/directory/categories/${category.slug}`}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80 ${
                          category.isPrimary
                            ? 'bg-white dark:bg-neutral-800 text-purple-700 dark:text-purple-300 shadow-sm border border-purple-300 dark:border-purple-600'
                            : 'bg-white/60 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-600'
                        }`}
                      >
                        <span className="text-base">
                          {category.icon && category.icon}
                          {!category.icon && (
                            <>
                              {category.name === 'International Foods' && '🌍'}
                              {category.name === 'Electronics store' && '🛍️'}
                              {category.name === 'Shoe store' && '👟'}
                              {category.name === 'Grocery store' && '🏪'}
                              {category.name === 'Supermarket' && '🛒'}
                              {category.name === 'Clothing store' && '👕'}
                              {category.name === 'Hardware store' && '🔧'}
                              {category.name === 'Restaurant' && '🍽️'}
                              {category.name === 'Pharmacy' && '💊'}
                              {category.name === 'Bookstore' && '📚'}
                              {category.name === 'Pet store' && '🐕'}
                              {!['International Foods', 'Electronics store', 'Shoe store', 'Grocery store', 'Supermarket', 'Clothing store', 'Hardware store', 'Restaurant', 'Pharmacy', 'Bookstore', 'Pet store'].includes(category.name) && '🏢'}
                            </>
                          )}
                        </span>
                        <span>{category.name}</span>
                        <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
                          {gbpCategoryCounts[category.slug] || 0} stores
                        </span>
                        {category.isPrimary && (
                          <span className="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-full">
                            Primary
                          </span>
                        )}
                      </Link>
                    ))}
                </div>
                
                <div className="mt-3 text-right">
                  <Link
                    href="/directory/categories"
                    className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-medium"
                  >
                    Browse all business categories →
                  </Link>
                </div>
              </div>
            )}

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
                  <div key="email-contact" className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email</p>
                      <a
                        href={`mailto:${listing.email}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                        suppressHydrationWarning={true}
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

      {/* NEW: Store Recommendations */}
      {recommendations.recommendations && recommendations.recommendations.length > 0 && (
        <div className="bg-white border-t">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Discover More Stores</h2>
            <div className="space-y-8">
              {recommendations.recommendations.map((recGroup: any) => (
                <div key={recGroup.type}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{recGroup.title}</h3>
                    {recGroup.type === 'popular_in_category' && (
                      <Link
                        href={`/directory/categories/${primaryCategory?.slug}`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View All →
                      </Link>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recGroup.recommendations.map((rec: any) => (
                      <Link
                        key={rec.tenantId}
                        href={`/directory/${rec.slug}`}
                        className="group block p-4 bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 group-hover:text-blue-600 line-clamp-1">
                              {rec.businessName}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                              {rec.address}
                            </p>
                            <p className="text-sm text-gray-500">
                              {rec.city}, {rec.state}
                              {rec.distance && ` • ${rec.distance} mi`}
                            </p>
                            <p className="text-xs text-green-600 mt-2 font-medium">
                              {rec.reason}
                            </p>
                          </div>
                          <div className="ml-3 shrink-0">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
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

      {/* Map Section */}
      <div className="bg-gray-50 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Visit Our Location</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Find us at {fullAddress || listing.city + ', ' + listing.state}. We're conveniently located
            </p>
          </div>
          {listing.address && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">Store Location</h2>
              <div className="w-full h-64 sm:h-80 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&q=${encodeURIComponent(listing.address)}`}
                  title="Store Location"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Get Directions
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View on Google Maps
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related Stores */}
      <RelatedStores currentSlug={slugForRelated} />
    </>
  );
}
