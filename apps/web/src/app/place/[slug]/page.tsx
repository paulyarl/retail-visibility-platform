import { notFound, permanentRedirect } from 'next/navigation';

import { directoryService } from '@/services/DirectorySingletonService';
import { publicDirectoryService } from '@/services/PublicDirectoryService';
import { publicUnifiedCapabilityService } from '@/services/PublicUnifiedCapabilityService';
import { tenantPublicService } from '@/services/TenantPublicService';
import { clientLogger } from '@/lib/client-logger';

import PlacePageClient from './PlacePageClient';

// Never prerender at build time — the listing API isn't reachable during
// builds and a statically baked "not found" would be served to crawlers.
export const dynamic = 'force-dynamic';

interface PlacePageProps {
  params: Promise<{ slug: string }>;
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

export default async function PlacePage({ params }: PlacePageProps) {
  const { slug } = await params;

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

  // Non-seed listings are redirected server-side in layout.tsx, but guard
  // here too in case of a race or stale cache.
  if (listing.listingOrigin !== 'directory_seed') {
    permanentRedirect(`/directory/${listing.slug || slug}`);
  }

  // Sidebar/skill data in parallel. Each failure degrades to null rather than
  // erroring the page — the listing content is the SEO payload that matters.
  const [businessHours, tenantInfo, dirEntryOpts, resolvedSlug] = await Promise.all([
    getBusinessHours(listing),
    tenantPublicService.getPublicTenantInfo(listing.tenantId).catch(() => null),
    publicUnifiedCapabilityService.getDirectoryEntryOptionsState(listing.tenantId).catch(() => null),
    publicDirectoryService.resolveBySlug(slug).catch(() => null),
  ]);

  return (
    <PlacePageClient
      slug={slug}
      listing={listing}
      businessHours={businessHours}
      tenantInfo={tenantInfo}
      dirEntryOpts={dirEntryOpts}
      slugForRelated={resolvedSlug || slug}
    />
  );
}
