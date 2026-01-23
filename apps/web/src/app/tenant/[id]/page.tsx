import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { Pagination } from '@/components/ui';
import Link from 'next/link';
import { getLandingPageFeatures } from '@/lib/landing-page-tiers';
import TenantMapSection from '@/components/tenant/TenantMapSection';
import { getTenantMapLocation, MapLocation } from '@/lib/map-utils';
import ProductSearch from '@/components/storefront/ProductSearch';
import EnhancedProductDisplay from '@/components/storefront/EnhancedProductDisplay';
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
import { ProductSingletonProvider } from '@/providers/data/ProductSingleton';
import FeaturedProductsSection from '@/components/storefront/FeaturedProductsSection';
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
import CollapsibleCatalogSidebar from '@/components/storefront/CollapsibleCatalogSidebar';
import StorefrontClientWrapper from './StorefrontClientWrapper';

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
  searchParams: Promise<{ page?: string; search?: string; category?: string; products_only?: string; featured?: string; view?: string }>;
}

async function getTenantWithProducts(tenantId: string, page: number = 1, limit: number = 12, search?: string, category?: string, featured?: string) {
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

    // Fetch products for this tenant with optional search, category, and featured filter
    // Using materialized view for 10-30x faster category filtering!
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const categoryParam = category ? `&category=${encodeURIComponent(category)}` : '';
    const featuredParam = featured ? `&featured=${encodeURIComponent(featured)}` : '';
    
    let productsRes;
    if (featured) {
      // Use the featured products API when filtering by featured type
      productsRes = await fetch(`${apiBaseUrl}/api/storefront/${tenantId}/featured-products?limit=${limit}${searchParam}`, {
        cache: 'no-store',
      });
    } else {
      // Use regular products API for general browsing
      productsRes = await fetch(`${apiBaseUrl}/api/storefront/${tenantId}/products?page=${page}&limit=${limit}${searchParam}${categoryParam}`, {
        cache: 'no-store',
      });
    }

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

    const total = featured 
      ? productsData.count || products.length // Featured API uses count field
      : productsData.pagination?.totalItems || productsData.total || products.length;

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
  const { page: pageParam, search, category, products_only, featured, view } = await searchParams;
  const currentPage = parseInt(pageParam || '1', 10);
  
  // Check if products_only mode is enabled
  const isProductsOnly = products_only === 'true';

  const data = await getTenantWithProducts(id, currentPage, 12, search, category, featured);

  if (!data) {
    notFound();
  }

  // Helper function to get featured type display name
  const getFeaturedTypeName = (type: string) => {
    switch (type) {
      case 'store_selection': return 'Featured Products';
      case 'new_arrival': return 'New Arrivals';
      case 'seasonal': return 'Seasonal Specials';
      case 'sale': return 'Sale Items';
      case 'staff_pick': return 'Staff Picks';
      default: return 'Products';
    }
  };

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
    <ProductSingletonProvider>
      <StorefrontClientWrapper 
        tenantId={id}
        tenant={tenant}
        products={products}
        total={total}
        limit={limit}
        platformSettings={platformSettings}
        mapLocation={mapLocation}
        hasBranding={hasBranding}
        businessHours={businessHours}
        storeStatus={storeStatus}
        categories={categories}
        productCategories={productCategories}
        storeCategories={storeCategories}
        uncategorizedCount={uncategorizedCount}
        currentCategory={currentCategory}
        paymentGateways={paymentGateways}
        businessName={businessName}
        currentPage={currentPage}
        totalPages={totalPages}
        search={search}
        category={category}
        featured={featured}
        view={view}
        isProductsOnly={isProductsOnly}
        apiBaseUrl={apiBaseUrl}
        directoryPublished={directoryPublished}
        tenantSlug={tenantSlug}
        primaryStoreCategory={primaryStoreCategory}
        primaryGBPCategory={primaryGBPCategory}
        secondaryGBPCategories={secondaryGBPCategories}
        tier={tier}
        features={features}
        totalAllProducts={totalAllProducts}
        fullWidthLayout={false} // Default to constrained layout
      />
    </ProductSingletonProvider>
  );
}
