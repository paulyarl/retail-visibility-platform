import { notFound, permanentRedirect } from 'next/navigation';

import { directoryService } from '@/services/DirectorySingletonService';
import { publicDirectoryService } from '@/services/PublicDirectoryService';
import { publicUnifiedCapabilityService } from '@/services/PublicUnifiedCapabilityService';
import { tenantPublicService } from '@/services/TenantPublicService';
import marketIntelPublicService from '@/services/MarketIntelPublicService';
import placesBrowsePublicService from '@/services/PlacesBrowsePublicService';
import {
  resolveReferrerShelf,
  resolveSecondaryShelves,
  secondaryCategoryNames,
} from '@/lib/place-shelves';
import { clientLogger } from '@/lib/client-logger';

import PlacePageClient from './PlacePageClient';

// Never prerender at build time — the listing API isn't reachable during
// builds and a statically baked "not found" would be served to crawlers.
export const dynamic = 'force-dynamic';

interface PlacePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ shelf?: string | string[] }>;
}

function normalizeListingBusinessHours(raw: any): any {
  if (!raw || typeof raw !== 'object') return null;

  const periods: any[] = [];
  const fullDays: any = {};

  Object.entries(raw).forEach(([day, value]: [string, any]) => {
    if (!value || typeof value !== 'object') return;
    const dayName = day.toUpperCase();
    if (!value.closed && value.open && value.close) {
      periods.push({ day: dayName, open: value.open, close: value.close });
      fullDays[dayName] = { open: value.open, close: value.close };
    }
  });

  if (periods.length === 0) return null;
  return { periods, ...fullDays, timezone: raw.timezone };
}

async function getBusinessHours(listing: any) {
  const tenantId = listing?.tenantId;

  // Prefer the tenant's business_hours_list (same service /t/:tenantId/settings/hours uses).
  if (tenantId) {
    try {
      const data = await directoryService.getBusinessHours(tenantId);
      if (data?.data?.periods && Array.isArray(data.data.periods) && data.data.periods.length > 0) {
        return data.data;
      }
    } catch (error) {
      clientLogger.error('Error fetching tenant business hours:', { detail: error });
    }
  }

  // Fallback to the hours stored on the listing itself for directory seeds.
  if (listing?.businessHours) {
    const listingHours = normalizeListingBusinessHours(listing.businessHours);
    if (listingHours) return listingHours;
  }

  return null;
}

export default async function PlacePage({ params, searchParams }: PlacePageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const shelfParam = Array.isArray(resolvedSearchParams?.shelf)
    ? resolvedSearchParams.shelf[0]
    : resolvedSearchParams?.shelf;

  let listing: any = null;
  try {
    const data = await directoryService.getDirectoryConsolidated(slug);
    listing = data?.listing ?? null;
  } catch (error) {
    clientLogger.error('[Place] Error fetching place data:', { detail: error });
  }

  if (!listing) {
    notFound();
  }

  // Suppressed seeds are hidden from shoppers even when the underlying
  // listing row is still published. The consolidated API filters them too;
  // this is the defence-in-depth gate for a stale cache.
  if (listing.seedStatus === 'suppressed') {
    notFound();
  }

  // Non-seed listings are redirected server-side in layout.tsx, but guard
  // here too in case of a race or stale cache.
  if (listing.listingOrigin !== 'directory_seed') {
    permanentRedirect(`/directory/${listing.slug || slug}`);
  }

  // Sidebar/skill data in parallel. Each failure degrades to null rather than
  // erroring the page — the listing content is the SEO payload that matters.
  const [businessHours, tenantInfo, dirEntryOpts, resolvedSlug, marketIntelTeaser, placesIndex] =
    await Promise.all([
      getBusinessHours(listing),
      tenantPublicService.getPublicTenantInfo(listing.tenantId).catch(() => null),
      publicUnifiedCapabilityService.getDirectoryEntryOptionsState(listing.tenantId).catch(() => null),
      publicDirectoryService.resolveBySlug(slug).catch(() => null),
      // Server-render the teaser so crawlers see it without JS (§11.5).
      marketIntelPublicService.getTeaserSummary(slug).catch(() => null),
      // Live shelf index — resolves the ?shelf= referrer label and the seed's
      // secondary categories to real shelves (5-min cached, shared with /place).
      placesBrowsePublicService.getCategories().catch(() => null),
    ]);

  const shelves = placesIndex?.categories ?? [];
  const market = { shelves, city: listing.city, state: listing.state };
  const referrerShelf = resolveReferrerShelf(shelfParam, market);
  const secondaryShelves = resolveSecondaryShelves(secondaryCategoryNames(listing), {
    ...market,
    // The category shown in the hero subtitle is not an "also on" chip.
    exclude: referrerShelf?.categoryLabel ?? listing.primaryCategory,
  });

  return (
    <PlacePageClient
      slug={slug}
      listing={listing}
      businessHours={businessHours}
      tenantInfo={tenantInfo}
      dirEntryOpts={dirEntryOpts}
      slugForRelated={resolvedSlug || slug}
      marketIntelTeaser={marketIntelTeaser}
      referrerShelf={referrerShelf}
      secondaryShelves={secondaryShelves}
    />
  );
}
