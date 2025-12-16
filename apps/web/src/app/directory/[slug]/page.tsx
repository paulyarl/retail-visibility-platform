import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, Mail, Globe, Clock, Share2, ArrowLeft } from 'lucide-react';
import { LocalBusinessStructuredData, BreadcrumbStructuredData } from '@/components/directory/StructuredData';
import RelatedStores from '@/components/directory/RelatedStores';
import DirectoryActions from '@/components/directory/DirectoryActions';
import StoreRatingsSection from '@/components/directory/StoreRatingsSection';
import GBPCategoriesNav from '@/components/storefront/GBPCategoriesNav';
import GBPCategoryBadges from '@/components/shared/GBPCategoryBadges';
import BusinessHoursDisplay from '@/components/shared/BusinessHoursDisplay';
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import { computeStoreStatus } from '@/lib/hours-utils';

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
    const listing = data.listing;
    
    // Fetch business profile to get GBP categories (same as storefront, but using public endpoint)
    if (listing && listing.tenant_id) {
      try {
        const profileRes = await fetch(`${apiUrl}/public/tenant/${listing.tenant_id}/profile`, {
          next: { revalidate: 300 },
        });
        
        if (profileRes.ok) {
          const profile = await profileRes.json();
          
          // Extract GBP categories from profile metadata
          const gbpCategories = profile.metadata?.gbp_categories || profile.metadata?.gbpCategories;
          
          if (gbpCategories) {
            const categories = [];
            
            // Add primary category
            if (gbpCategories.primary) {
              categories.push({
                id: gbpCategories.primary.id,
                name: gbpCategories.primary.name,
                slug: gbpCategories.primary.id?.replace('gcid:', '').replace(/_/g, '-') || 
                      gbpCategories.primary.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-'),
                isPrimary: true
              });
            }
            
            // Add secondary categories
            if (gbpCategories.secondary && Array.isArray(gbpCategories.secondary)) {
              gbpCategories.secondary.forEach((cat: any) => {
                categories.push({
                  id: cat.id,
                  name: cat.name,
                  slug: cat.id?.replace('gcid:', '').replace(/_/g, '-') || 
                        cat.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-'),
                  isPrimary: false
                });
              });
            }
            
            listing.categories = categories;
          }
        }
      } catch (error) {
        console.error('Error fetching business profile for GBP categories:', error);
      }
    }
    
    return listing;
  } catch (error) {
    console.error('Error fetching store:', error);
    return null;
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

async function getDirectoryCategoryCountsMap() {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    // Query the materialized view directly for category counts
    const res = await fetch(`${apiUrl}/api/directory/categories-optimized/counts-by-name`, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });

    if (!res.ok) {
      console.error('Directory category counts API failed:', res.status, res.statusText);
      return {};
    }

    const data = await res.json();
    // Return a map of category name -> count
    return data.counts || {};
  } catch (error) {
    console.error('Error fetching directory category counts:', error);
    return {};
  }
}

// Directory categories are already in the listing from the materialized view
// No separate fetch needed - they come from directory_listings_list.primary_category and secondary_categories

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
    
    const response = await fetch(`${apiUrl}/api/recommendations/for-storefront/${tenantId}?${params}`);
    
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

  // Get primary category early for parallel fetching
  const primaryCategory = listing.categories?.find((c: any) => c.isPrimary) || listing.categories?.[0];

  // Build directory categories from the listing (already in materialized view)
  const storeDirectoryCategories = [];
  if (listing.primary_category) {
    storeDirectoryCategories.push({
      name: listing.primary_category,
      slug: listing.primary_category.toLowerCase().replace(/\s+/g, '-'),
      isPrimary: true
    });
  }
  if (listing.secondary_categories && Array.isArray(listing.secondary_categories)) {
    listing.secondary_categories.forEach((catName: string) => {
      storeDirectoryCategories.push({
        name: catName,
        slug: catName.toLowerCase().replace(/\s+/g, '-'),
        isPrimary: false
      });
    });
  }

  // Fetch all independent data in parallel for better performance
  const [
    gbpCategoryCounts,
    directoryCategoryCountsMap,
    businessProfile,
    featuredProducts,
    relatedProducts,
    recommendations
  ] = await Promise.all([
    getGbpCategoryCounts(),
    getDirectoryCategoryCountsMap(),
    getBusinessProfile(listing.tenant_id),
    getFeaturedProducts(listing.tenant_id, 6),
    primaryCategory ? getRelatedProducts(primaryCategory.slug, listing.tenant_id, 6) : Promise.resolve([]),
    getStoreRecommendations(listing.tenant_id, primaryCategory?.slug)
  ]);
  
  // Compute store status from business profile hours
  const storeStatus = businessProfile?.hours ? computeStoreStatus(businessProfile.hours) : null;
  
  // Track user behavior for recommendations (fire and forget, don't await)
  trackStoreView(listing.tenant_id, listing.categories).catch(err => 
    console.error('Failed to track store view:', err)
  );
  
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
        {/* Header with Visit Storefront Banner */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link 
              href="/directory"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Directory
            </Link>
            
            {/* Store Open/Closed Status */}
            {storeStatus && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${storeStatus.isOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className={`font-medium ${storeStatus.isOpen ? 'text-green-700' : 'text-red-700'}`}>
                  {storeStatus.label}
                </span>
              </div>
            )}
            
            {/* Visit Storefront Hero Banner */}
            <div className="mt-4 bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100 border-2 border-blue-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-8 sm:px-8 sm:py-10 text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                  Shop {listing.business_name}
                </h2>
                <p className="text-gray-700 mb-6 text-sm sm:text-base max-w-2xl mx-auto">
                  Browse {listing.product_count > 0 ? `${listing.product_count} products` : 'our full catalog'} and shop directly from their online storefront
                </p>
                <Link
                  href={`/tenant/${listing.tenant_id}`}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg shadow-md"
                >
                  <Globe className="w-5 h-5" />
                  Visit Storefront
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Sidebar - Store Type Categories & Hours */}
            <div className="lg:col-span-3 space-y-6">
              {/* Directory Categories - Owner's Intentional Assignments */}
              {storeDirectoryCategories.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Store Categories
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Business types this store is listed under
                  </p>
                  {/* Enclosed Style Container */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-2">
                      {storeDirectoryCategories.map((category: any) => {
                        const count = directoryCategoryCountsMap[category.name] || 0;
                        return (
                          <Link
                            key={category.slug}
                            href={`/directory/categories/${category.slug}`}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-sm text-gray-700 font-medium">
                                {category.name}
                              </span>
                              {category.isPrimary && (
                                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full font-medium">
                                  Primary
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              {count} stores
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Business Hours - Moved from right sidebar for balance */}
              {businessProfile?.hours && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Hours
                  </h2>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <BusinessHoursDisplay businessHours={businessProfile.hours} />
                  </div>
                </div>
              )}
            </div>

            {/* Middle Column - Store Info */}
            <div className="lg:col-span-6 space-y-6">
              {/* Store Header */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-start gap-6">
                  {listing.logo_url && (
                    <img
                      src={listing.logo_url}
                      alt={listing.business_name}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {listing.business_name}
                    </h1>
                
                    {/* GBP Categories - Clean badges below store name */}
                    {listing.categories && listing.categories.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {listing.categories
                          .sort((a: any, b: any) => {
                            if (a.isPrimary && !b.isPrimary) return -1;
                            if (!a.isPrimary && b.isPrimary) return 1;
                            return a.name.localeCompare(b.name);
                          })
                          .map((category: any, index: number) => (
                            <Link
                              key={category.id || index}
                              href={`/directory/stores/${category.slug}`}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                category.isPrimary
                                  ? 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200'
                                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                              }`}
                              title={`Browse all ${category.name} stores`}
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
                                {category.name === 'Specialty food store' && '🍱'}
                                {!['Grocery store', 'Electronics store', 'Shoe store', 'Supermarket', 'Clothing store', 'Hardware store', 'Restaurant', 'Pharmacy', 'Bookstore', 'Pet store', 'Specialty food store'].includes(category.name) && '🏢'}
                              </span>
                              <span>{category.name}</span>
                            </Link>
                          ))}
                      </div>
                    )}
                
                    {listing.product_count > 0 && (
                      <p className="text-gray-600 mt-3">
                        {listing.product_count} products available
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons - Clean inline layout */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  {/* Visit Storefront - Left side */}
                  <Link
                    href={`/tenant/${listing.tenant_id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    title="Browse products on the storefront"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Visit Storefront</span>
                  </Link>
                  
                  {/* Share/Print Actions - Right side */}
                  <DirectoryActions 
                    listing={{
                      business_name: listing.business_name,
                      slug: listing.slug,
                      tenantId: listing.tenant_id,
                      id: listing.id
                    }}
                    currentUrl={currentUrl}
                  />
                </div>
              </div>

              {/* Business Description - Full Width Pane */}
              {businessProfile?.business_description && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">About This Business</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-700 leading-relaxed text-base whitespace-pre-wrap">
                      {businessProfile.business_description}
                    </p>
                  </div>
                </div>
              )}

              {/* Store Ratings and Reviews */}
              <StoreRatingsSection tenantId={listing.tenant_id} showWriteReview={true} />
            </div>

            {/* Right Column - Contact Info */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Contact Information
                </h2>
                
                {/* Contact Details - Enclosed Style */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                  {fullAddress && (
                    <div className="flex items-start gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700">{fullAddress}</p>
                    </div>
                  )}
                  {listing.phone && (
                    <div className="flex items-center gap-2 mb-3">
                      <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <a href={`tel:${listing.phone}`} className="text-sm text-blue-600 hover:text-blue-700">
                        {listing.phone}
                      </a>
                    </div>
                  )}
                  {listing.email && (
                    <div className="flex items-center gap-2 mb-3">
                      <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <a 
                        href={`mailto:${listing.email}`} 
                        className="text-sm text-blue-600 hover:text-blue-700"
                        suppressHydrationWarning
                      >
                        {listing.email}
                      </a>
                    </div>
                  )}
                  
                  {/* Social Links */}
                  {businessProfile?.social_links && Object.keys(businessProfile.social_links).length > 0 && (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-700 mb-2">Follow Us</p>
                      <div className="flex flex-wrap gap-2">
                        {businessProfile.social_links.facebook && (
                          <a
                            href={businessProfile.social_links.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                          >
                            Facebook
                          </a>
                        )}
                        {businessProfile.social_links.instagram && (
                          <a
                            href={businessProfile.social_links.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs hover:bg-pink-200 transition-colors"
                          >
                            Instagram
                          </a>
                        )}
                        {businessProfile.social_links.twitter && (
                          <a
                            href={businessProfile.social_links.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs hover:bg-sky-200 transition-colors"
                          >
                            Twitter
                          </a>
                        )}
                        {businessProfile.social_links.linkedin && (
                          <a
                            href={businessProfile.social_links.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200 transition-colors"
                          >
                            LinkedIn
                          </a>
                        )}
                        {businessProfile.social_links.youtube && (
                          <a
                            href={businessProfile.social_links.youtube}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
                          >
                            YouTube
                          </a>
                        )}
                        {businessProfile.social_links.tiktok && (
                          <a
                            href={businessProfile.social_links.tiktok}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors"
                          >
                            TikTok
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Map Location */}
              {listing.address && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Location
                  </h2>
                  <GoogleMapEmbed address={listing.address} />
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Featured Products */}
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
                        ${Number(product.price).toFixed(2)}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        {product.tenantCategory && (
                          <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
                            {product.tenantCategory.name}
                          </span>
                        )}
                        <span className={`text-xs font-medium ${
                          product.stock === 0 
                            ? 'text-red-600 dark:text-red-400' 
                            : product.stock < 10 
                            ? 'text-amber-600 dark:text-amber-400' 
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          Stock: {product.stock}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Related Stores */}
      <RelatedStores currentSlug={slugForRelated} />
    </>
  );
}
