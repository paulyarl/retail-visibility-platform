import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
// import Image from 'next/image';
// import { Pagination } from '@/components/ui';
// import Link from 'next/link';
import { getLandingPageFeatures } from '@/lib/landing-page-tiers';
// import TenantMapSection from '@/components/tenant/TenantMapSection';
import { getTenantMapLocation, MapLocation } from '@/lib/map-utils';
// import ProductSearch from '@/components/storefront/ProductSearch';
// import EnhancedProductDisplay from '@/components/storefront/EnhancedProductDisplay';
// import ProductCategorySidebar from '@/components/storefront/ProductCategorySidebar';
// import ProductCategoriesCollapsible from '@/components/storefront/ProductCategoriesCollapsible';
// import GBPCategoriesNav from '@/components/storefront/GBPCategoriesNav';
// import GBPCategoryBadges from '@/components/shared/GBPCategoryBadges';
// import CategoryMobileDropdown from '@/components/storefront/CategoryMobileDropdown';
import { computeStoreStatus, getTodaySpecialHours } from '@/lib/hours-utils';
import LocationClosedBanner from '@/components/storefront/LocationClosedBanner';
// import StorefrontViewTracker from '@/components/tracking/StorefrontViewTracker';
// import StorefrontActions from '@/components/products/StorefrontActions';
// import { StorefrontRecommendations } from './StorefrontClient';
import { ProductSingletonProvider } from '@/providers/data/ProductSingleton';
// import FeaturedProductsSection from '@/components/storefront/FeaturedProductsSection';
// import { getCategoryUrl } from '@/utils/slug';
// import StorefrontMap from '@/components/storefront/StorefrontMap';
// import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import { trackStorefrontView } from '@/utils/behaviorTracking';
// import LastViewed from '@/components/directory/LastViewed';
// import FulfillmentOptionsPane from '@/components/storefront/FulfillmentOptionsPane';
// import StorefrontFeaturedProducts from '@/components/storefront/StorefrontFeaturedProducts';
// import CollapsibleCatalogSidebar from '@/components/storefront/CollapsibleCatalogSidebar';
import { tenantPublicService } from '@/services/TenantPublicService';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';
import { storefrontSingletonService } from '@/services/StorefrontSingletonService';
// import  storefrontService  from '@/services/StorefrontService';
// import { tenantDirectoryService } from '@/services/TenantDirectorySingletonService';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import StorefrontClientWrapper from './StorefrontClientWrapper';
import { publicDirectoryService } from '@/services/PublicDirectoryService';
// import { publicTenantInfoService} from '@/services/PublicTenantInfoService';
// import ProductDataService from '@/services/ProductDataService';

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
  slug: string;
  category: string;
  subcategory: string;
  tags: string[];
  attributes: Record<string, any>;
  stock: number;
  imageUrl?: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  payment_gateway_type?: string | null;
  has_active_payment_gateway?: boolean;
  // product display attributes
  product_rating?: number;
  product_review_count?: number;
  product_helpful_count?: number;
  product_review_approved?: number;

  // Enhanced fields from new API
  imageGallery?: Array<{
    id: string;
    url: string;
    position: number;
    alt?: string;
    caption?: string;
    variant_id?: string;
    createdAt: string;
    isPrimary: boolean;
  }>;
  variants?: Array<{
    id: string;
    sku: string;
    variant_name: string;
    price_cents: number;
    sale_price_cents?: number;
    stock: number;
    image_url?: string;
    attributes: Record<string, any>;
    sort_order: number;
    is_active: boolean;
    is_on_sale: boolean;
    discount_percentage: number;
  }>;
  hasVariants?: boolean;
  productType?: 'physical' | 'digital' | 'hybrid';
  digitalDeliveryMethod?: string;
  digitalAssets?: any[];
  licenseType?: string;
  accessDurationDays?: number;
  downloadLimit?: number;
}

interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };

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
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  accentColor?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
  googleCategoryId: string | null;
  category_type?: string;
  is_primary?: boolean;
  color?: string;
  icon?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  isDeleted?: boolean;
  isPublished?: boolean;
  isHidden?: boolean;
  isDraft?: boolean;
  isInactive?: boolean;
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; search?: string; category?: string; products_only?: string; featured?: string; view?: string }>;
}

interface StorefrontDetailPageProps extends PageProps {
  tenant?: Tenant;
  products?: Product[];
  categories?: Category[];
  totalProducts?: number;
  currentPage?: number;
  totalPages?: number;
  hasMore?: boolean;
  businessHours?: any;
  platformSettings?: PlatformSettings;
  slug?: string;
}


async function getTenantWithProducts(tenantId: string, page: number = 1, limit: number = 12, search?: string, category?: string, featured?: string) {
  try {
    // console.log(`[getTenantWithProducts] Resolving tenant ID for slug: ${tenantId}`);
    const idResolvedBySlug = await publicDirectoryService.resolveBySlug(tenantId);
    // console.log(`[getTenantWithProducts] Resolved tenant ID: ${idResolvedBySlug}`);

    const hoursResponse = await tenantPublicService.getBusinessHours(idResolvedBySlug);
    
    // Extract business hours data from API response
    const rawBusinessHours = hoursResponse?.data || hoursResponse;
    
    // Transform business hours data to handle periods format
    let businessHours = null;
    if (rawBusinessHours) {
      if (rawBusinessHours.periods && Array.isArray(rawBusinessHours.periods)) {
        const { periods, timezone } = rawBusinessHours;
        const hours: any = { timezone };
        
        // Convert periods to day-based format for BusinessHoursDisplay
        periods.forEach((period: any) => {
          const dayName = period.day?.toUpperCase();
          if (dayName && !hours[dayName]) {
            hours[dayName] = {
              open: period.open,
              close: period.close
            };
          }
        });
        
        // Include periods array for BusinessHoursDisplay to handle multiple periods
        hours.periods = periods;
        businessHours = hours;
      } else {
        // Already in day-based format
        businessHours = rawBusinessHours;
      }
    }
    
    // Fetch full shop details using the resolved tenant ID

    const tenant = await tenantPublicService.getPublicTenantInfo(idResolvedBySlug);
    const directoryData = tenant?.directoryData;

    // Fetch shop info from MV only if tenant is active (MV excludes non-active tenants)
    let shopInfo: any = null;
    const isActiveTenant = !tenant?.locationStatus || tenant.locationStatus === 'active';
    if (directoryData?.is_published && isActiveTenant) {
      shopInfo = await publicDirectoryService.getShopInfoById(idResolvedBySlug);
    }

    // }


    
    // console.log('[TenantPage] Shop info response:', shopInfo);
    // console.log('[TenantPage] Tenant data:', tenant);

    const tenantData = (tenant as any)?.data || tenant;
    // console.log('[TenantPage] Tenant data (after extraction):', tenantData);

    const tenantDirectoryData = tenantData?.directoryData;
    const tenantMetadata = tenantData?.metadata;
    const tenantProfileData = tenantData?.profileData;
    const tenantStatusInfo = tenantData?.statusInfo;
    // console.log(`[TenantPage] tenantDirectoryData: `,tenantDirectoryData);
    // console.log(`[TenantPage] tenantMetadata: `,tenantMetadata);
    // console.log(`[TenantPage] tenantProfileData: `,tenantProfileData);
    // console.log(`[TenantPage] tenantStatusInfo: `,tenantStatusInfo);


    // API returns { success: true, shop: {...} }
    const shopData = shopInfo?.success ? shopInfo.shop : null;

    if (shopData||tenant) {
      tenantData.metadata = {
        ...tenantData.metadata,
        businessName: tenantProfileData?.business_name|| shopData?.business_name || tenantData.name,
        phone: tenantProfileData?.phone_number||shopData?.phone || null,
        email: tenantProfileData?.email||shopData?.email || null,
        website:tenantProfileData?.website|| shopData?.website || null,
        address:tenantProfileData?.address_line1|| shopData?.address && tenantProfileData?.city|| shopData?.city && tenantProfileData?.state|| shopData?.state && tenantProfileData?.postal_code|| shopData?.zip_code
          ? `${tenantProfileData?.address_line1||shopData.address}, ${tenantProfileData?.city||shopData.city}, ${tenantProfileData?.state||shopData.state} ${tenantProfileData?.postal_code||shopData.zip_code}`
          : null,
        logo_url:tenantProfileData?.logo_url|| shopData?.imageUrl || tenantData.logo_url || tenantData.metadata?.logo_url,
        business_description: tenantProfileData?.business_description||shopData?.description || null,
        defaultGatewayType: shopData?.default_gateway_type || null,
        hasActivePaymentGateway: shopData?.has_active_payment_gateway || false,
        isActive: shopData?.is_active || false,
        isFeatured: shopData?.is_featured || false,
        isArchived: shopData?.is_archived || false,
        isDeleted: shopData?.is_deleted || false,
        isPublished: tenantDirectoryData?.is_published || shopData?.is_published || false,
        isHidden: shopData?.is_hidden || false,
        isDraft: shopData?.is_draft || false,
        isInactive: shopData?.is_inactive || false,

      };
      
    } else {
      // console.log('[TenantPage] No shop data found');
     // console.log('[TenantPage] Raw shopInfo:', shopInfo);
    }

    const hasLogo = !!tenantProfileData?.logo_url||!!tenantData.metadata?.logo_url;
    const hasBranding = hasLogo || !!businessHours;
    const storeStatus = businessHours ? computeStoreStatus(businessHours) : null;

    // Fetch map location using utility (use resolved tenant ID)
    const mapLocation = await getTenantMapLocation(idResolvedBySlug);

    // Fetch categories with counts using singleton service (use resolved tenant ID)
    let categories: Category[] = [];
    let productCategories: Category[] = [];
    let storeCategories: Category[] = [];
    let uncategorizedCount = 0;
    try {
      // Get product counts per category from storefront singleton service
      const storefrontData = await storefrontSingletonService.getStorefrontCategories(idResolvedBySlug);
      const storefrontCategories = storefrontData.categories || [];
      uncategorizedCount = storefrontData.uncategorizedCount || 0;

      // Convert storefront categories to the expected format
      categories = storefrontCategories.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        count: parseInt(cat.productCount) || 0, // API returns productCount as string
        googleCategoryId: cat.googleCategoryId,
        category_type: 'platform', // All storefront categories are platform categories
        isActive: cat.isActive || false,
        isFeatured: cat.isFeatured || false,
        isArchived: cat.isArchived || false,
        isDeleted: cat.isDeleted || false,
        isPublished: cat.isPublished || false,
        isHidden: cat.isHidden || false,
        isDraft: cat.isDraft || false,
        isInactive: cat.isInactive || false,
      }));

      // All categories are product categories for storefront
      productCategories = categories;
      storeCategories = [];
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    }

    // Fetch products using singleton service (use resolved tenant ID)
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const categoryParam = category ? `&category=${encodeURIComponent(category)}` : '';
    
    let productsData;
    if (featured) {
      // Use the featured products API when filtering by featured type
      productsData = await storefrontSingletonService.getFeaturedProducts(idResolvedBySlug, {
        limit,
        search
      });
      // console.log('[TenantPage] Featured products data:', productsData);
    } else {
      // Use regular products API for general browsing
      productsData = await storefrontSingletonService.getStorefrontProducts(idResolvedBySlug, {
        page,
        limit,
        search,
        category
      });
      // console.log('[TenantPage] Products data:', productsData);
    }
    // Handle both old (array) and new (paginated object) response formats
    const rawProducts = productsData.items
      ? (Array.isArray(productsData.items) ? productsData.items : [])
      : (Array.isArray(productsData) ? productsData : []);

    // console.log('[TenantPage] Raw products:', rawProducts);

    // Deduplicate products by ID to prevent React key conflicts
    const uniqueRawProducts = rawProducts.filter((product, index, arr) => 
      arr.findIndex(p => p.id === product.id) === index
    );

    // Transform products: convert priceCents to price and include payment gateway fields
    const products: Product[] = uniqueRawProducts.map((p: any) => ({
      ...p,
      price: typeof p.price === 'number' ? p.price : (typeof p.priceCents === 'number' ? p.priceCents / 100 : 0),
      title: p.title || p.name,
      currency: p.currency || 'USD',
      payment_gateway_type: p.defaultGatewayType ?? null, // From MV (camelCase from API)
      has_active_payment_gateway: p.hasActivePaymentGateway ?? false, // From MV (camelCase from API)
      isActive: p.isActive ?? false,
      isFeatured: p.isFeatured ?? false,
      isArchived: p.isArchived ?? false,
      isAvailable: p.isAvailable ?? false,
      isDeleted: p.isDeleted ?? false,
      isPublished: p.isPublished ?? false,
      isHidden: p.isHidden ?? false,
      isDraft: p.isDraft ?? false,
      isInactive: p.isInactive ?? false,
    }));

    // console.log(`${featured ? 'Featured' : 'Regular'} Products: ${products.length}`);
    // console.log(`${featured ? 'Featured' : 'Regular'} Products Data:`, productsData);

    const total = featured 
      ? ('count' in productsData ? productsData.count : 0) || products.length // Featured API uses count field
      : ('pagination' in productsData ? productsData.pagination?.totalItems : ('total' in productsData ? productsData.total : 0)) || products.length;

    // Fetch platform settings for footer using singleton service
    let platformSettings: any = {};
    try {
      platformSettings = await platformSettingsService.getPlatformSettings();
    } catch (e) {
      console.error('Failed to fetch platform settings:', e);
    }

    // Find current category name if filtering
    const currentCategory = category ? categories.find((c: Category) => c.slug === category) : null;

    return { tenant: tenantData, products, total, page, limit, platformSettings, mapLocation, hasBranding, businessHours, storeStatus, categories, productCategories, storeCategories, uncategorizedCount, currentCategory, resolvedTenantId: idResolvedBySlug };
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

export default async function TenantStorefrontPage({ params, searchParams }: StorefrontDetailPageProps) {
  const { id } = await params;
  // console.log(`[TenantStorefrontPage] id:`, id);
  const { page: pageParam, search, category, products_only, featured, view } = await searchParams;
  // console.log(`[TenantStorefrontPage] searchParams:`, searchParams);
  const currentPage = parseInt(pageParam || '1', 10);
  // console.log(`[TenantStorefrontPage] currentPage:`, currentPage);
  
  
  // Check if products_only mode is enabled
  const isProductsOnly = products_only === 'true';
  // console.log(`[TenantStorefrontPage] isProductsOnly:`, isProductsOnly);

  const data = await getTenantWithProducts(id, currentPage, 12, search, category, featured);
  // console.log('[TenantStorefrontPage] data:', data); 

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
      case 'best_seller': return 'Best Sellers';
      case 'trending': return 'Trending Items';
      case 'clearance': return 'Clearance Items';
      case 'recommended': return 'Recommended Items';
      case 'featured': return 'Featured Items';
      
      default: return 'Products';
    }
  };

  const { tenant, products, total, limit, platformSettings, mapLocation, hasBranding, businessHours, storeStatus, categories, productCategories, storeCategories, uncategorizedCount, currentCategory, resolvedTenantId } = data as any;
  const businessName = tenant.metadata?.businessName || tenant.name;
  // console.log('[TenantPage Main] Store Categories:', storeCategories);
  // console.log('[TenantPage Main] Product Categories:', productCategories);
  
  // console.log('[TenantPage Main] Current Category:', currentCategory);

  // console.log('[TenantPage Main] Resolved Tenant ID:', resolvedTenantId);
  // console.log('[TenantPage Main] Tenant:', tenant);
  // console.log('[TenantPage Main] Products:', products);


  // Log what data we're passing to StorefrontClientWrapper
  // console.log('[TenantPage Main] Tenant metadata being passed:', tenant.metadata);
  // console.log('[TenantPage Main] Tenant phone:', tenant.metadata?.phone);
  // console.log('[TenantPage Main] Tenant email:', tenant.metadata?.email);
  // console.log('[TenantPage Main] Tenant address:', tenant.metadata?.address);
  // console.log('[TenantPage Main] Business hours:', businessHours);

  // Track storefront view for recommendations (fire and forget)
  // console.log('[TenantPage Main] Tracking storefront view');
  // console.log('[TenantPage Main] Category:', category);
  // console.log('[TenantPage Main] Current Category:', currentCategory);
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
 // const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

  // Fetch directory publish status and actual slug using singleton services
  let directoryPublished = tenant?.hasDirectory||false;
  let tenantSlug = tenant?.slug||id;

  // try {
  //   // Use tenant directory service to get the actual slug from the API
  //  console.log('[TenantPage] Calling getTenantSlug...');
  //  console.log(`[TenantPage] Tenant ID: ${tenant?.id}`);
  //  console.log(`[TenantPage] Tenant slug: ${tenant?.slug}`);
  //  console.log(`[TenantPage] Tenant: ${JSON.stringify(tenant)}`);
    // const apiSlug = await tenantDirectoryService.getTenantSlug(id);
  // const apiSlug = tenant?.slug;
  //  console.log('[TenantPage] API slug:', apiSlug);

    // Use hasPublishedDirectory from tenant data (already fetched) instead of making another API call
    // directoryPublished = tenant.hasPublishedDirectory ?? false;

    // Use API slug if available, otherwise generate from business name or use tenant ID
    // tenantSlug = apiSlug || data.tenant?.slug || id;
    // console.log('[TenantPage] Final tenantSlug:', tenantSlug);
  // } catch (e) {
    // Directory page doesn't exist or error - store is not published
    // console.warn('[TenantPage] Directory service failed:', e);
    // directoryPublished = false;
    // Fallback to generated slug
    // tenantSlug = businessName?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || id;
  // }

  // Find primary store category for header badge
  // console.log('[TenantPage] Store Categories:', storeCategories);
  const primaryStoreCategory = storeCategories.find((cat: Category) => cat.is_primary);
  // console.log('[TenantPage] Primary Store Category:', primaryStoreCategory);

  // Get GBP categories from tenant metadata (always available regardless of directory publish status)
  const primaryGBPCategory = tenant?.primary_category || tenant?.metadata?.gbp_categories?.primary || tenant?.metadata?.gbpCategories?.primary;
  const secondaryGBPCategories = tenant?.secondary_categories || tenant?.metadata?.gbp_categories?.secondary || tenant?.metadata?.gbpCategories?.secondary || [];

  // Fetch total product count for "All Products" using singleton service
  let totalAllProducts = 0;
  try {
    totalAllProducts = await storefrontSingletonService.getTotalProductCount(id);
  } catch (e) {
    console.error('Failed to fetch total product count:', e);
    // Fallback to current total if available
    totalAllProducts = total || 0;
  }

  // Get tier features for footer
  const tier = tenant.subscriptionTier || 'trial';
  // console.log('[TenantPage Main] Tier:', tier);
  const features = getLandingPageFeatures(tier);
  // console.log('[TenantPage Main] Features:', features);

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
      <TenantPaymentProvider tenantId={resolvedTenantId || tenant.id || id}>
        <StorefrontClientWrapper 
          tenantId={resolvedTenantId || tenant.id || id}
          tenant={tenant}
          platformSettings={platformSettings}
          mapLocation={mapLocation}
          hasBranding={hasBranding}
          storeStatus={storeStatus}
          categories={categories}
          productCategories={productCategories}
          storeCategories={storeCategories}
          uncategorizedCount={uncategorizedCount}
          businessName={businessName}
          businessHours={businessHours}
          search={search}
          category={category}
          featured={featured}
          view={view}
          isProductsOnly={isProductsOnly} 
          directoryPublished={directoryPublished}
          tenantSlug={tenantSlug}
          primaryGBPCategory={primaryGBPCategory}
          secondaryGBPCategories={secondaryGBPCategories}
          tier={tier}
          features={features}
          totalAllProducts={totalAllProducts}
          fullWidthLayout={false} // Default to constrained layout
          products={products}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={total}
          locationStatus={tenant?.locationStatus}
          statusInfo={tenant?.statusInfo}
        />
      </TenantPaymentProvider>
    </ProductSingletonProvider>
  );
}
