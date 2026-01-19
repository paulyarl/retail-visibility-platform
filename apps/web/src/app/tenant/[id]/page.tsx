import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { Pagination } from '@/components/ui';
import Link from 'next/link';
import { getLandingPageFeatures } from '@/lib/landing-page-tiers';
import TenantMapSection from '@/components/tenant/TenantMapSection';
import { getTenantMapLocation, MapLocation } from '@/lib/map-utils';
import ProductSearch from '@/components/storefront/ProductSearch';
import ProductDisplay from '@/components/storefront/ProductDisplay';
import ProductCategorySidebar from '@/components/storefront/ProductCategorySidebar';
import ProductCategoriesCollapsible from '@/components/storefront/ProductCategoriesCollapsible';
import GBPCategoriesNav from '@/components/storefront/GBPCategoriesNav';
import GBPCategoryBadges from '@/components/shared/GBPCategoryBadges';
import CategoryMobileDropdown from '@/components/storefront/CategoryMobileDropdown';
import { computeStoreStatus, getTodaySpecialHours } from '@/lib/hours-utils';
import LocationClosedBanner from '@/components/storefront/LocationClosedBanner';
import StorefrontViewTracker from '@/components/tracking/StorefrontViewTracker';
import StorefrontActions from '@/components/products/StorefrontActions';
import { StorefrontRecommendations } from './StorefrontClient';
import { StoreRatingDisplay } from '@/components/reviews/StoreRatingDisplay';
import { getCategoryUrl } from '@/utils/slug';
import StorefrontMap from '@/components/storefront/StorefrontMap';
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import { trackStorefrontView } from '@/utils/behaviorTracking';
import ContactInformationCollapsible from '@/components/storefront/ContactInformationCollapsible';
import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';
import LastViewed from '@/components/directory/LastViewed';
import FulfillmentOptionsPane from '@/components/storefront/FulfillmentOptionsPane';
import StorefrontFeaturedProducts from '@/components/storefront/StorefrontFeaturedProducts';

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
  payment_gateway_type?: string | null;
  has_active_payment_gateway?: boolean;
}

interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  hasActivePaymentGateway?: boolean;
  metadata?: {
    businessName?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    logo_url?: string;
    banner_url?: string;
    business_description?: string;
    social_links?: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
      linkedin?: string;
    };
  };
}

interface PlatformSettings {
  platformName?: string;
  logoUrl?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
  googleCategoryId: string | null;
  category_type?: string;
  is_primary?: boolean;
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; search?: string; category?: string }>;
}

async function getTenantWithProducts(tenantId: string, page: number = 1, limit: number = 12, search?: string, category?: string) {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

    // Fetch tenant basic info
    const tenantRes = await fetch(`${apiBaseUrl}/public/tenant/${tenantId}`, {
      cache: 'no-store',
    });

    if (!tenantRes.ok) {
      return null;
    }

    const tenant: Tenant & { access?: { storefront: boolean } } = await tenantRes.json();

    // Fetch payment gateways (once for the entire storefront)
    let paymentGateways: any[] = [];
    try {
      const paymentRes = await fetch(`${apiBaseUrl}/public/tenant/${tenantId}/payment-gateways`, {
        cache: 'no-store',
      });
      if (paymentRes.ok) {
        const paymentData = await paymentRes.json();
        if (paymentData.success && paymentData.gateways) {
          paymentGateways = paymentData.gateways.filter((g: any) => g.is_active);
        }
      }
    } catch (e) {
      console.error('Failed to fetch payment gateways:', e);
    }

    
    // Fetch business profile
    let hasHours = false;
    let businessHours: any = null;
    try {
      const profileRes = await fetch(`${apiBaseUrl}/public/tenant/${tenantId}/profile`, {
        cache: 'no-store',
      });
      if (profileRes.ok) {
        const businessProfile = await profileRes.json();
        tenant.metadata = {
          ...tenant.metadata,
          ...businessProfile.metadata, // Preserve GBP categories and other metadata from profile
          businessName: businessProfile.business_name,
          phone: businessProfile.phone_number,
          email: businessProfile.email,
          website: businessProfile.website,
          address: businessProfile.address_line1
            ? `${businessProfile.address_line1}${businessProfile.address_line2 ? ', ' + businessProfile.address_line2 : ''}, ${businessProfile.city}, ${businessProfile.state} ${businessProfile.postal_code}`
            : undefined,
          logo_url: businessProfile.logo_url,
          business_description: businessProfile.business_description,
          social_links: businessProfile.social_links,
        };
        // Detect hours presence for branding evaluation
        const hours = (businessProfile as any)?.hours;
        businessHours = hours ?? null;
        if (hours) {
          if (Array.isArray(hours)) {
            hasHours = hours.length > 0;
          } else if (typeof hours === 'object') {
            hasHours = Object.keys(hours).length > 0;
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch business profile:', e);
    }

    // Fetch raw business hours data for proper display
    let rawBusinessHours: any = null;
    try {
      const hoursRes = await fetch(`${apiBaseUrl}/api/tenant/${tenantId}/business-hours`, {
        cache: 'no-store',
      });
      if (hoursRes.ok) {
        const hoursData = await hoursRes.json();
        if (hoursData.success && hoursData.data) {
          const { periods, timezone } = hoursData.data;
          const hours: any = { timezone };

          // Convert periods to day-based format for BusinessHoursDisplay
          periods.forEach((period: any) => {
            // Convert API day format (MONDAY) to title case (Monday) for storefront display
            const dayMap: Record<string, string> = {
              'MONDAY': 'Monday',
              'TUESDAY': 'Tuesday',
              'WEDNESDAY': 'Wednesday',
              'THURSDAY': 'Thursday',
              'FRIDAY': 'Friday',
              'SATURDAY': 'Saturday',
              'SUNDAY': 'Sunday'
            };
            const titleCaseDay = dayMap[period.day] || period.day;
            if (titleCaseDay && !hours[titleCaseDay]) {
              hours[titleCaseDay] = {
                open: period.open,
                close: period.close
              };
            }
          });

          // Include periods array for BusinessHoursDisplay to handle multiple periods
          if (periods.length > 0) {
            hours.periods = periods;
          }

          // Fetch and include special hours for status computation
          try {
            const specialRes = await fetch(`${apiBaseUrl}/api/tenant/${tenantId}/business-hours/special`, {
              cache: 'no-store',
            });
            if (specialRes.ok) {
              const specialData = await specialRes.json();
              if (specialData.success && specialData.data?.overrides) {
                hours.special = specialData.data.overrides.map((override: any) => ({
                  date: override.date,
                  open: override.open,
                  close: override.close,
                  isClosed: override.isClosed,
                  note: override.note
                }));
              }
            }
          } catch (e) {
            console.error('Failed to fetch special hours:', e);
          }

          rawBusinessHours = hours;
        }
      }
    } catch (e) {
      console.error('Failed to fetch raw business hours:', e);
    }

    // Fetch map location using utility
    const mapLocation = await getTenantMapLocation(tenantId);

    // Fetch categories with counts - using storefront categories API
    let categories: Category[] = [];
    let productCategories: Category[] = [];
    let storeCategories: Category[] = [];
    let uncategorizedCount = 0;
    try {
      // Get product counts per category from storefront categories API
      const storefrontCategoriesRes = await fetch(`${apiBaseUrl}/api/storefront/${tenantId}/categories`, {
        cache: 'no-store',
      });
      if (storefrontCategoriesRes.ok) {
        const storefrontData = await storefrontCategoriesRes.json();
        const storefrontCategories = storefrontData.categories || [];
        uncategorizedCount = storefrontData.uncategorizedCount || 0;

        // Convert storefront categories to the expected format
        categories = storefrontCategories.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          count: cat.count,
          googleCategoryId: cat.googleCategoryId,
          category_type: 'platform', // All storefront categories are platform categories
        }));

        // All categories are product categories for storefront
        productCategories = categories;
        storeCategories = [];
      }
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    }

    // Fetch products for this tenant with optional search and category filter
    // Using materialized view for 10-30x faster category filtering!
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const categoryParam = category ? `&category=${encodeURIComponent(category)}` : '';
    const productsRes = await fetch(`${apiBaseUrl}/api/storefront/${tenantId}/products?page=${page}&limit=${limit}${searchParam}${categoryParam}`, {
      cache: 'no-store',
    });

    const productsData = productsRes.ok ? await productsRes.json() : { items: [], pagination: { totalItems: 0 } };
    // Handle both old (array) and new (paginated object) response formats
    const rawProducts = productsData.items
      ? (Array.isArray(productsData.items) ? productsData.items : [])
      : (Array.isArray(productsData) ? productsData : []);

    // Transform products: convert priceCents to price and include payment gateway fields
    const products: Product[] = rawProducts.map((p: any) => ({
      ...p,
      price: typeof p.price === 'number' ? p.price : (typeof p.priceCents === 'number' ? p.priceCents / 100 : 0),
      title: p.title || p.name,
      currency: p.currency || 'USD',
      payment_gateway_type: p.defaultGatewayType ?? null, // From MV (camelCase from API)
      has_active_payment_gateway: p.hasActivePaymentGateway ?? false, // From MV (camelCase from API)
    }));

    const total = productsData.pagination?.totalItems || productsData.total || products.length;

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

    const hasLogo = !!tenant.metadata?.logo_url;
    const hasBranding = hasLogo || hasHours;
    const storeStatus = rawBusinessHours ? computeStoreStatus(rawBusinessHours) : null;

    // Find current category name if filtering
    const currentCategory = category ? categories.find((c: Category) => c.slug === category) : null;

    return { tenant, products, total, page, limit, platformSettings, mapLocation, hasBranding, businessHours: rawBusinessHours, storeStatus, categories, productCategories, storeCategories, uncategorizedCount, currentCategory, paymentGateways };
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
  const { page: pageParam, search, category } = await searchParams;
  const currentPage = parseInt(pageParam || '1', 10);

  const data = await getTenantWithProducts(id, currentPage, 12, search, category);

  if (!data) {
    notFound();
  }

  const { tenant, products, total, limit, platformSettings, mapLocation, hasBranding, businessHours, storeStatus, categories, productCategories, storeCategories, uncategorizedCount, currentCategory, paymentGateways } = data as any;
  const businessName = tenant.metadata?.businessName || tenant.name;

  // Track storefront view for recommendations (fire and forget)
  if (category && currentCategory) {
    // Track category browse on storefront
    import('@/utils/behaviorTracking').then(({ trackCategoryBrowse }) => {
      trackCategoryBrowse(currentCategory.id || category, currentCategory.slug || category).catch(err =>
        console.error('Failed to track category browse:', err)
      );
    });
  } else {
    // Track general storefront view
    trackStorefrontView(id, storeCategories || []).catch(err =>
      console.error('Failed to track storefront view:', err)
    );
  }
  const totalPages = Math.ceil(total / limit);

  // API base URL for additional calls
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

  // Fetch directory publish status and actual slug
  let directoryPublished = false;
  let tenantSlug = businessName?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || id;
  try {
    // Use tenant ID to lookup directory listing (more reliable than generated slug)
    // Note: id already includes 'tid-' prefix, no need to add 't-'
    const directoryRes = await fetch(`${apiBaseUrl}/api/directory/${id}`, {
      cache: 'no-store',
    });
    if (directoryRes.ok) {
      const directoryData = await directoryRes.json();
      // If the directory page exists, the store is published
      directoryPublished = true;
      // Use the actual slug from the directory listing
      if (directoryData.listing?.slug) {
        tenantSlug = directoryData.listing.slug;
      }
    }
  } catch (e) {
    // Directory page doesn't exist or error - store is not published
    directoryPublished = false;
  }

  // Find primary store category for header badge
  const primaryStoreCategory = storeCategories.find((cat: Category) => cat.is_primary);

  // Get GBP categories from tenant metadata (always available regardless of directory publish status)
  const primaryGBPCategory = tenant.metadata?.gbp_categories?.primary || tenant.metadata?.gbpCategories?.primary;
  const secondaryGBPCategories = tenant.metadata?.gbp_categories?.secondary || tenant.metadata?.gbpCategories?.secondary || [];

  // Fetch total product count for "All Products" (always unfiltered)
  let totalAllProducts = 0;
  try {
    const totalProductsRes = await fetch(`${apiBaseUrl}/api/storefront/${id}/products?page=1&limit=1`, {
      cache: 'no-store',
    });
    if (totalProductsRes.ok) {
      const totalData = await totalProductsRes.json();
      totalAllProducts = totalData.pagination?.totalItems || 0;
    }
  } catch (e) {
    console.error('Failed to fetch total product count:', e);
    // Fallback to current total if available
    totalAllProducts = total || 0;
  }

  // Get tier features for footer
  const tier = tenant.subscriptionTier || 'trial';
  const features = getLandingPageFeatures(tier);

  // Location status check: Show closed banner if location is not active
  if (tenant.storefrontMessage) {
    return (
      <LocationClosedBanner
        title={tenant.storefrontMessage.title}
        message={tenant.storefrontMessage.message}
        tenantId={id}
        businessName={businessName}
      />
    );
  }

  // Tier gate: Check backend access status (respects overrides)
  if (tenant.access && !tenant.access.storefront) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              Storefront Not Available
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Your <span className="font-semibold">Google-Only</span> plan focuses on Google Shopping feeds and doesn't include a public storefront.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Upgrade to Starter ($49/mo) to unlock:</h3>
              <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Public storefront with product catalog
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Product search functionality
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Mobile-responsive design
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Enhanced SEO
                </li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={`/t/${id}/settings/subscription`}
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors" style={{ color: '#ffffff' }}
              >
                Upgrade Plan
              </a>
              <a
                href={`/t/${id}/dashboard`}
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Client-side storefront tracking */}
      <StorefrontViewTracker tenantId={id} categoriesViewed={productCategories.map((c: any) => c.name)} />

      {/* Header with Business Name and Logo */}
      <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-6">
            {tenant.metadata?.logo_url && (
              <div className="relative w-24 h-24 shrink-0">
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

              {/* GBP Categories - Clean badges below store name */}
              {(primaryGBPCategory || (storeCategories && storeCategories.length > 0)) && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {/* Primary GBP Category */}
                  {primaryGBPCategory && (
                    <Link
                      href={`/directory/stores/${primaryGBPCategory.id?.replace('gcid:', '').replace(/_/g, '-') || primaryGBPCategory.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                      title={`Browse all ${primaryGBPCategory.name} stores`}
                    >
                      <span className="text-base">
                        {primaryGBPCategory.name === 'Grocery store' && '🏪'}
                        {primaryGBPCategory.name === 'Electronics store' && '🛍️'}
                        {primaryGBPCategory.name === 'Shoe store' && '👟'}
                        {primaryGBPCategory.name === 'Supermarket' && '🛒'}
                        {primaryGBPCategory.name === 'Clothing store' && '👕'}
                        {primaryGBPCategory.name === 'Hardware store' && '🔧'}
                        {primaryGBPCategory.name === 'Restaurant' && '🍽️'}
                        {primaryGBPCategory.name === 'Pharmacy' && '💊'}
                        {primaryGBPCategory.name === 'Bookstore' && '📚'}
                        {primaryGBPCategory.name === 'Pet store' && '🐕'}
                        {!['Grocery store', 'Electronics store', 'Shoe store', 'Supermarket', 'Clothing store', 'Hardware store', 'Restaurant', 'Pharmacy', 'Bookstore', 'Pet store'].includes(primaryGBPCategory.name) && '🏢'}
                      </span>
                      <span>{primaryGBPCategory.name}</span>
                    </Link>
                  )}

                  {/* Secondary GBP Categories */}
                  {secondaryGBPCategories && secondaryGBPCategories.length > 0 && secondaryGBPCategories.map((category: any, index: number) => (
                    <Link
                      key={category.id || index}
                      href={`/directory/stores/${category.id?.replace('gcid:', '').replace(/_/g, '-') || category.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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
                        {!['Grocery store', 'Electronics store', 'Shoe store', 'Supermarket', 'Clothing store', 'Hardware store', 'Restaurant', 'Pharmacy', 'Bookstore', 'Pet store'].includes(category.name) && '🏢'}
                      </span>
                      <span>{category.name}</span>
                    </Link>
                  ))}

                  {/* Fallback: Show store categories if no GBP categories */}
                  {!primaryGBPCategory && storeCategories && storeCategories.length > 0 &&
                    storeCategories
                      .sort((a: Category, b: Category) => {
                        if (a.is_primary && !b.is_primary) return -1;
                        if (!a.is_primary && b.is_primary) return 1;
                        return a.name.localeCompare(b.name);
                      })
                      .map((category: Category) => (
                        <Link
                          key={category.id}
                          href={getCategoryUrl(category, "/directory/stores")}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${category.is_primary
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700'
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
                            {!['Grocery store', 'Electronics store', 'Shoe store', 'Supermarket', 'Clothing store', 'Hardware store', 'Restaurant', 'Pharmacy', 'Bookstore', 'Pet store'].includes(category.name) && '🏢'}
                          </span>
                          <span>{category.name}</span>
                        </Link>
                      ))}
                </div>
              )}

              {storeStatus && (
                <p className="text-neutral-600 dark:text-neutral-400 mt-3 flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${storeStatus.status === 'open' ? 'bg-green-500' :
                    storeStatus.status === 'closing-soon' ? 'bg-orange-500' :
                      storeStatus.status === 'opening-soon' ? 'bg-blue-500' :
                        'bg-red-500'
                    }`}></span>
                  {storeStatus.label}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Storefront Actions */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <StorefrontActions
            tenantId={id}
            businessName={businessName}
            tenantSlug={tenantSlug}
            directoryPublished={directoryPublished}
          />
        </div>
      </div>

      {/* Banner Hero Section (if banner exists) */}
      {tenant.metadata?.banner_url && (
        <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden">
              <Image
                src={tenant.metadata.banner_url}
                alt={`${businessName} banner`}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      )}

      {/* Fulfillment & Payment Options */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <FulfillmentOptionsPane tenantId={id} compact={true} paymentGateways={paymentGateways} />
      </div>

      {/* Products Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Storefront Featured Products */}
        <StorefrontFeaturedProducts tenantId={id} />
        
        <div>
          {/* Product Categories - Collapsible */}
          {productCategories.length > 0 && (
            <ProductCategoriesCollapsible
              tenantId={id}
              categories={productCategories}
              totalProducts={totalAllProducts}
            />
          )}

          {/* Header with Search and Category Context */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                  {currentCategory ? currentCategory.name : 'All Products'} ({total})
                </h2>
                {(search || currentCategory) && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    {currentCategory && !search && `Showing all ${currentCategory.name.toLowerCase()} products`}
                    {search && !currentCategory && `Results for "${search}"`}
                    {search && currentCategory && `Results for "${search}" in ${currentCategory.name}`}
                  </p>
                )}
              </div>
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
            <div className="text-center py-12 space-y-6">
              <p className="text-neutral-600 dark:text-neutral-400 text-lg">
                {currentCategory && search
                  ? `No products found matching "${search}" in ${currentCategory.name}.`
                  : currentCategory
                    ? `No products in ${currentCategory.name} yet.`
                    : search
                      ? `No products found matching "${search}". Try a different search term.`
                      : 'No products available at this time.'}
              </p>
              {currentCategory && (
                <Link
                  href={`/tenant/${id}`}
                  className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline"
                >
                  ← View all products
                </Link>
              )}
              {!hasBranding && (
                <div className="mx-auto max-w-2xl p-5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200">
                  <div className="flex items-start gap-3">
                    <svg className="h-6 w-6 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                    </svg>
                    <div className="text-left">
                      <p className="font-medium">Set your store branding and add products to populate this page automatically.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={`/t/${id}/settings/branding`}
                          className="inline-flex items-center px-3 py-1.5 rounded bg-primary-600 text-white text-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1 no-underline"
                          style={{ color: 'white' }}
                        >
                          Edit Branding
                        </a>
                        <a
                          href={`/t/${id}/items`}
                          className="inline-flex items-center px-3 py-1.5 rounded border border-primary-300 bg-white text-primary-700 text-sm hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-1 dark:bg-neutral-900 dark:text-primary-300 dark:border-primary-700 dark:hover:bg-neutral-800"
                        >
                          Add Products
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Product Display with Grid/List Toggle */}
              <ProductDisplay products={products} tenantId={id} tenantName={tenant.name} tenantLogo={tenant.metadata?.logo_url} />

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
                        className={`px-4 py-2 rounded-lg transition-colors ${pageNum === currentPage
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

              {/* Storefront Recommendations - After Pagination */}
              <StorefrontRecommendations tenantId={id} />
            </>
          )}
        </div>
      </main>

      {/* Recently Viewed Stores */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <LastViewed 
          title="Other Stores You Viewed" 
          entityType="store"
          limit={3}
          showEmptyState={false}
        />
      </div>

      {/* Store Ratings and Reviews - After Products */}
      <div id="storefront-reviews-section" className="bg-neutral-50 dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <StoreRatingDisplay tenantId={id} showWriteReview={true} />
        </div>
      </div>{/* Social Media Follow */}
      <div className="bg-neutral-50 dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div>
            {/* Social Links */}
            {(tenant.metadata?.social_links as any)?.facebook ||
              (tenant.metadata?.social_links as any)?.instagram ||
              (tenant.metadata?.social_links as any)?.twitter ||
              (tenant.metadata?.social_links as any)?.linkedin ? (
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-600 mt-3">
                <h2 className="text-lg font-semibold text-neutral-500 dark:text-neutral-400 mb-2">Follow Us</h2>
                <div className="flex flex-wrap gap-3">
                  {(tenant.metadata?.social_links as any)?.facebook && (
                    <a
                      href={(tenant.metadata?.social_links as any)?.facebook}
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
                  {(tenant.metadata?.social_links as any)?.instagram && (
                    <a
                      href={(tenant.metadata?.social_links as any)?.instagram}
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
                  {(tenant.metadata?.social_links as any)?.twitter && (
                    <a
                      href={(tenant.metadata?.social_links as any)?.twitter}
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
                  {(tenant.metadata?.social_links as any)?.linkedin && (
                    <a
                      href={(tenant.metadata?.social_links as any)?.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-700 hover:text-blue-800 transition-colors"
                      title="LinkedIn"
                    >
                      <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 48 48">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Contact Information and Business Hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-8 xl:gap-4 2xl:gap-2">
        {/* Contact Information */}
        <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 md:border-b-0">
          <div>
            <ContactInformationCollapsible tenant={tenant} />
          </div>
          
        </div>

        {/* Business Hours */}
        <BusinessHoursCollapsible businessHours={businessHours} />
      </div>

      {/* Map Section - How to Get There */}
      {tenant.metadata?.address && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">Find Us</h2>
            <GoogleMapEmbed address={tenant.metadata.address} height="h-64 sm:h-80" />
          </div>
        </div>
      )}

      {/* Tier-Based Footer */}
      <footer className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Quick Links
              </h3>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 mb-4">
                <div className="space-y-3 text-sm">
                  {/* Directory Entry Link */}
                  {directoryPublished && tenantSlug && (
                    <Link
                      href={`/directory/${tenantSlug}`}
                      className="flex items-center gap-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      View Store in Directory
                    </Link>
                  )}

                </div>
              </div>

            </div>

            {/* Store Location Map */}
            <StorefrontMap
              tenant={{
                id: tenant.id,
                businessName: businessName,
                slug: tenantSlug,
                metadata: tenant.metadata
              }}
              primaryCategory={primaryStoreCategory?.name}
              productCount={total}
            />
          </div>

          {/* Platform Branding (unless Enterprise with removal) */}
          {!features.removePlatformBranding && (
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 text-sm text-neutral-500">
              <Link href="/" title={platformSettings?.platformName || 'Visible Shelf'} style={{ textDecoration: 'none' }} ><div className="flex items-center justify-center gap-2" >
                <span>⚡Powered by</span>
                <img 
                  src={platformSettings?.logoUrl} 
                  alt={platformSettings?.platformName || 'Platform Logo'} 
                  className="h-8 w-auto object-contain"
                  loading="lazy"
                  decoding="async"
                  width="32"
                  height="32"
                />
                <span>{platformSettings?.platformName || 'Visible Shelf'}</span>
              </div>
              </Link>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
