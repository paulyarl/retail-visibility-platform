import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, Mail, Globe, Clock, Share2, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { LocalBusinessStructuredData, BreadcrumbStructuredData } from '@/components/directory/StructuredData';
import RelatedStores from '@/components/directory/RelatedStores';
import DirectoryActions from '@/components/directory/DirectoryActions';
import StoreRatingsSection from '@/components/directory/StoreRatingsSection';
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import { computeStoreStatus } from '@/lib/hours-utils';
import StoreDirectoryCategories from '@/components/directory/StoreDirectoryCategories';
import DirectoryPhotoGalleryDisplay from '@/components/directory/DirectoryPhotoGalleryDisplay';
import ProductCategoriesCollapsible from '@/components/directory/ProductCategoriesCollapsible';
import StoreViewTracker from '@/components/tracking/StoreViewTracker';
import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';
import ContactInformationCollapsible from '@/components/directory/ContactInformationCollapsible';
import { PoweredByFooter } from '@/components/PoweredByFooter';

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

async function getBusinessHours(tenantId: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    const res = await fetch(`${apiUrl}/api/tenant/${tenantId}/business-hours`);
    if (!res.ok) return null;
    
    const data = await res.json();
    if (!data.success || !data.data) return null;
    
    const { periods, timezone } = data.data;
    const hours: any = { timezone };
    
    // Convert periods to day-based format for BusinessHoursDisplay
    periods.forEach((period: any) => {
      const dayName = period.day?.toUpperCase(); // Keep uppercase for BusinessHoursDisplay
      if (dayName && !hours[dayName]) {
        hours[dayName] = {
          open: period.open,
          close: period.close
        };
      }
    });
    
    // Include periods array for BusinessHoursDisplay to handle multiple periods
    if (periods.length > 0) {
      hours.periods = periods;
    }
    
    return hours;
  } catch (error) {
    console.error('Error fetching business hours:', error);
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
    storefrontCategories,
    businessProfile,
    businessHours,
    featuredProducts,
    relatedProducts,
    recommendations
  ] = await Promise.all([
    getGbpCategoryCounts(),
    getDirectoryCategoryCountsMap(),
    getStorefrontCategories(listing.tenant_id),
    getBusinessProfile(listing.tenant_id),
    getBusinessHours(listing.tenant_id),
    getFeaturedProducts(listing.tenant_id, 6),
    primaryCategory ? getRelatedProducts(primaryCategory.slug, listing.tenant_id, 6) : Promise.resolve([]),
    getStoreRecommendations(listing.tenant_id, primaryCategory?.slug)
  ]);
  
  // Compute store status from business hours data
  const storeStatus = businessHours ? computeStoreStatus(businessHours) : null;
  
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

      {/* Client-side store tracking */}
      <StoreViewTracker tenantId={listing.tenant_id} categories={listing.categories} />

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
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                  storeStatus.status === 'open' ? 'bg-green-500' :
                  storeStatus.status === 'closing-soon' ? 'bg-orange-500' :
                  storeStatus.status === 'opening-soon' ? 'bg-blue-500' :
                  'bg-red-500'
                }`}></span>
                <span className={`font-medium ${
                  storeStatus.status === 'open' ? 'text-green-700' :
                  storeStatus.status === 'closing-soon' ? 'text-orange-700' :
                  storeStatus.status === 'opening-soon' ? 'text-blue-700' :
                  'text-red-700'
                }`}>
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
          <div className="space-y-6">
            {/* Main Content Column */}
            <div className="space-y-6">
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
                              href={`/directory/categories/${category.slug}`}
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
                
                    {storefrontCategories.categories.length > 0 && (
                      <div className="mt-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                          <svg className="w-4 h-4 mr-1.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          {storefrontCategories.categories.reduce((sum: number, cat: any) => sum + (cat.count || 0), 0) + storefrontCategories.uncategorizedCount} products available
                        </span>
                      </div>
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

              {/* Photo Gallery */}
              <DirectoryPhotoGalleryDisplay listing={listing} />

              {/* Product Categories - Collapsible */}
              {storefrontCategories.categories.length > 0 && (
                <ProductCategoriesCollapsible
                  categories={storefrontCategories.categories}
                  tenantId={listing.tenant_id}
                  uncategorizedCount={storefrontCategories.uncategorizedCount}
                />
              )}

              {/* Business Description - Full Width Pane */}
              {businessProfile?.business_description && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">About Us</h2>
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
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Contact
                </h2>
                <div>
                            <ContactInformationCollapsible tenant={listing} fullAddress={fullAddress} initialExpanded={true} />
                          </div>
                
                  
                  {/* Social Links */}
                  {businessProfile?.social_links && Object.keys(businessProfile.social_links).length > 0 && (
                    <div className="pt-3 border-t border-neutral-200 dark:border-neutral-600 mt-3">
                      <h2 className="text-lg font-semibold text-neutral-500 dark:text-neutral-400 mb-3">Follow Us</h2>
                      <div className="flex flex-wrap gap-4">
                        {businessProfile.social_links.facebook && (
                          <a
                            href={businessProfile.social_links.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
                            title="Facebook"
                          >
                            <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
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
                            <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.162c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                            </svg>
                          </a>
                        )}
                        {businessProfile.social_links.twitter && (
                          <a
                            href={businessProfile.social_links.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-500 transition-colors"
                            title="Twitter/X"
                          >
                            <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
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
                            <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0C9.958 0 0 9.958 0 22.225c0 12.268 9.958 22.225 22.225 22.225s22.225-9.958 22.225-22.225C44.45 9.958 34.492 0 22.225 0zM14.818 30.055a.5.5 0 01-.5.5h-4.263a.5.5 0 01-.5-.5V14.218a.5.5 0 01.5-.5h4.263a.5.5 0 01.5.5v15.837zM10.555 11.685a2.555 2.555 0 11-5.11 0 2.555 2.555 0 015.11 0zM32.408 30.055a.5.5 0 01-.5.5h-4.263a.5.5 0 01-.5-.5V20.218a4.894 4.894 0 00-1.685-.578 4.685 4.685 0 00-1.938.245 3.654 3.654 0 00-1.563 1.5 3.654 3.654 0 00-.245 1.563v7.107a.5.5 0 01-.5.5h-4.263a.5.5 0 01-.5-.5v-15.837a.5.5 0 01.5-.5h4.263a.5.5 0 01.5.5v.5c1.5-1.5 3.5-2 5.5-1.5 2 0 4 .5 5.5 2v-.5a.5.5 0 01.5-.5h4.263a.5.5 0 01.5.5v10.837z" />
                            </svg>
                          </a>
                        )}
                        {businessProfile.social_links.youtube && (
                          <a
                            href={businessProfile.social_links.youtube}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-red-600 hover:text-red-700 transition-colors"
                            title="YouTube"
                          >
                            <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                              <path d="M23.498 6.186c-.885-1.76-3.11-1.76-3.996 0L9.84 19.91c-.78 1.552.195 3.496 1.998 3.496h18.324c1.803 0 2.777-1.944 1.998-3.496L23.498 6.186zM24 29.5c-5.247 0-9.5-4.253-9.5-9.5s4.253-9.5 9.5-9.5 9.5 4.253 9.5 9.5-4.253 9.5-9.5 9.5zm0-15c-3.038 0-5.5 2.462-5.5 5.5s2.462 5.5 5.5 5.5 5.5-2.462 5.5-5.5-2.462-5.5-5.5-5.5z" />
                            </svg>
                          </a>
                        )}
                        {businessProfile.social_links.tiktok && (
                          <a
                            href={businessProfile.social_links.tiktok}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-gray-700 hover:text-gray-800 transition-colors"
                            title="TikTok"
                          >
                            <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                              <path d="M24 4.5c11.046 0 20 8.954 20 20s-8.954 20-20 20S4 35.546 4 24.5 12.954 4.5 24 4.5zm0 36c8.837 0 16-7.163 16-16s-7.163-16-16-16-16 7.163-16 16 7.163 16 16 16zm-4.5-22.5v15c0 .414.336.75.75.75s.75-.336.75-.75v-5.25h3c.414 0 .75-.336.75-.75s-.336-.75-.75-.75h-3V18h3c.414 0 .75-.336.75-.75s-.336-.75-.75-.75h-3.75c-.414 0-.75.336-.75.75v7.5h-1.5V18zm7.5 0v15c0 .414.336.75.75.75s.75-.336.75-.75V18h3.75c.414 0 .75-.336.75-.75s-.336-.75-.75-.75H27zm-15-3v15c0 .414.336.75.75.75s.75-.336.75-.75V15h3.75c.414 0 .75-.336.75-.75s-.336-.75-.75-.75H12zm30 0v15c0 .414.336.75.75.75s.75-.336.75-.75V15h3.75c.414 0 .75-.336.75-.75s-.336-.75-.75-.75H42z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Hours - Collapsible */}
              {businessHours && (
                <BusinessHoursCollapsible businessHours={businessHours} />
              )}

              {/* Map Location */}
              {listing.address && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Our Location
                  </h2>
                  <GoogleMapEmbed address={listing.address} />
                </div>
              )}
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

            {/* Platform Branding Footer */}
            <PoweredByFooter />
    </>
  );
}
