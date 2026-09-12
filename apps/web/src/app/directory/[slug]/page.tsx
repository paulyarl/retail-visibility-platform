import { notFound } from 'next/navigation';

import { directoryService } from '@/services/DirectorySingletonService';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';
import { publicDirectoryService } from '@/services/PublicDirectoryService';
import { publicUnifiedCapabilityService } from '@/services/PublicUnifiedCapabilityService';
import { tenantPublicService } from '@/services/TenantPublicService';
import { tenantDirectoryService } from '@/services/TenantDirectorySingletonService';
import { clientLogger } from '@/lib/client-logger';

import StoreDetailClient, { StoreComingSoon } from './StoreDetailClient';

// Never prerender at build time — the listing API isn't reachable during
// builds and a statically baked "not found" would be served to crawlers.
export const dynamic = 'force-dynamic';

interface StoreDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

type DirectoryResult =
  | { type: 'listing'; data: any }
  | { type: 'pending'; tenantId: string }
  | null;

async function getConsolidatedDirectoryData(identifier: string): Promise<DirectoryResult> {
  try {
    // First, try to load as a slug (most common case)
    const data = await directoryService.getDirectoryConsolidated(identifier);

    if (data?.listing) {
      return { type: 'listing', data };
    }

    // No listing — try resolving identifier (slug or tenantId) to a tenant
    const status = await tenantDirectoryService.getTenantDirectoryStatus(identifier);

    if (!status) {
      return null; // Identifier not found anywhere — true 404
    }

    if (!status.slug) {
      // Tenant exists but directory listing is not published
      return { type: 'pending', tenantId: status.tenantId || identifier };
    }

    // Has published slug — fetch by slug
    const resolvedData = await directoryService.getDirectoryConsolidated(status.slug);
    if (resolvedData?.listing) {
      return { type: 'listing', data: resolvedData };
    }

    return null;
  } catch (error) {
    clientLogger.error(`[Directory] Error fetching consolidated directory data for ${identifier}:`, { detail: error });
    return null;
  }
}

async function getStorefrontCategories(tenantId: string) {
  try {
    const data = await directoryService.getStorefrontCategories(tenantId);
    return data;
  } catch (error) {
    clientLogger.error('Error fetching storefront categories:', { detail: error });
    return { categories: [], uncategorizedCount: 0 };
  }
}

async function getActualProductCount(tenantId: string) {
  try {
    const count = await directoryService.getStorefrontProductCount(tenantId);
    return count;
  } catch (error) {
    clientLogger.error('Error fetching actual product count:', { detail: error });
    return 0;
  }
}

async function getBusinessProfile(tenantId: string) {
  try {
    const profile = await directoryService.getBusinessProfile(tenantId);
    return profile;
  } catch (error) {
    clientLogger.error('Error fetching business profile:', { detail: error });
    return null;
  }
}

async function getBusinessHours(tenantId: string) {
  try {
    const data = await directoryService.getBusinessHours(tenantId);
    if (!data || !data.success || !data.data) return null;

    const hoursData = data.data;

    // Handle both response formats: periods array or day-based object
    if (hoursData.periods && Array.isArray(hoursData.periods)) {
      const { periods, timezone } = hoursData;
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
    } else {
      // Assume data is already in day-based format
      return hoursData;
    }
  } catch (error) {
    clientLogger.error('Error fetching business hours:', { detail: error });
    return null;
  }
}

async function getRelatedProducts(categorySlug: string, excludeTenantId: string, limit: number = 6) {
  try {
    // First, get stores in the same category (from directory MV)
    const storesData = await directoryService.getStoresByCategoryForProducts(categorySlug, 10);
    const otherStores = storesData
      .filter((l: any) => l.tenant_id !== excludeTenantId)
      .slice(0, 3); // Get 3 other stores

    // Now fetch products from those stores using storefront_products MV
    const productPromises = otherStores.map(async (store: any) => {
      try {
        const productsData = await directoryService.getStorefrontProducts(store.tenant_id, 2);
        return productsData.map((p: any) => ({
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
    clientLogger.error('Error fetching related products:', { detail: error });
    return [];
  }
}

export default async function StoreDetailPage({ params }: StoreDetailPageProps) {
  const { slug: identifier } = await params;
  const result = await getConsolidatedDirectoryData(identifier);

  if (result === null) {
    notFound();
  }

  if (result.type === 'pending') {
    return <StoreComingSoon tenantId={result.tenantId} />;
  }

  // result.type === 'listing'
  const data = result.data;
  const listing = data.listing;

  const primaryCategory = listing.categories?.find((c: any) => c.isPrimary) || listing.categories?.[0];

  // Fetch remaining data that's not in the consolidated endpoint. Each
  // failure degrades to null rather than erroring the page — the listing
  // content is the SEO payload that matters.
  const [
    logo,
    profile,
    hours,
    related,
    categories,
    productCount,
    featuredPrefs,
    faqOptionFlags,
    crmOptionFlags,
    dirEntryOptions,
    info,
    idResolvedBySlug,
  ] = await Promise.all([
    publicTenantInfoService.getTenantLogoFromDiscovery(listing.tenantId).catch(() => null),
    getBusinessProfile(listing.tenantId),
    getBusinessHours(listing.tenantId),
    primaryCategory ? getRelatedProducts(primaryCategory.slug, listing.tenantId, 6) : Promise.resolve([]),
    getStorefrontCategories(listing.tenantId),
    getActualProductCount(listing.tenantId),
    publicUnifiedCapabilityService.getFeaturedOptionsState(listing.tenantId).catch(() => null),
    publicUnifiedCapabilityService.getFaqOptionsFlags(listing.tenantId).catch(() => null),
    publicUnifiedCapabilityService.getCrmOptionsFlags(listing.tenantId).catch(() => null),
    publicUnifiedCapabilityService.getDirectoryEntryOptionsState(listing.tenantId).catch(() => null),
    tenantPublicService.getPublicTenantInfo(listing.tenantId).catch(() => null),
    publicDirectoryService.resolveBySlug(identifier).catch(() => null),
  ]);

  return (
    <StoreDetailClient
      identifier={identifier}
      consolidatedData={data}
      tenantLogo={logo}
      businessProfile={profile?.data ?? null}
      businessHours={hours}
      relatedProducts={related}
      storefrontCategories={categories}
      actualProductCount={productCount}
      tenantInfo={info}
      slugForRelated={idResolvedBySlug || identifier}
      featuredOptionsState={featuredPrefs}
      faqFlags={faqOptionFlags}
      crmFlags={crmOptionFlags}
      directoryEntryOptions={dirEntryOptions}
    />
  );
}
