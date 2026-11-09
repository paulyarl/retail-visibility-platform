import { prisma } from '../prisma';
import { logger } from '../logger';
import { usStateTimezone } from '../lib/us-timezone';

/**
 * Builds combined business hours object for business profile storage
 * Combines regular hours from business_hours_list with special hours from business_hours_special_list
 */
export async function buildCombinedHoursObject(tenantId: string): Promise<any | null> {
  try {
    // Get regular hours
    const regularHours = await prisma.business_hours_list.findUnique({
      where: { tenant_id: tenantId },
    });

    // Get special hours
    const specialHours = await prisma.business_hours_special_list.findMany({
      where: { tenant_id: tenantId },
      orderBy: { date: 'asc' },
    });

    if (!regularHours && specialHours.length === 0) {
      return null; // No hours data at all
    }

    const combinedHours: any = {};

    // Add timezone if available
    if (regularHours?.timezone) {
      combinedHours.timezone = regularHours.timezone;
    }

    // Add regular hours (convert periods array to day objects)
    if (regularHours?.periods) {
      const periods = regularHours.periods as any[];
      if (Array.isArray(periods)) {
        // Convert periods array to day-based structure
        periods.forEach((period: any) => {
          if (period.day && typeof period.day === 'number') {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayName = dayNames[period.day];
            if (dayName) {
              combinedHours[dayName] = {
                open: period.open,
                close: period.close,
              };
            }
          }
        });
      }
    }

    // Add special hours
    if (specialHours.length > 0) {
      combinedHours.special = specialHours.map((sh: any) => ({
        date: sh.date.toISOString().slice(0, 10), // YYYY-MM-DD format
        open: sh.open,
        close: sh.close,
        isClosed: sh.isClosed,
        note: sh.note,
      }));
    }

    return Object.keys(combinedHours).length > 0 ? combinedHours : null;
  } catch (error) {
    logger.error('[buildCombinedHoursObject] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return null;
  }
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function parseProfileHoursToPeriods(hours: any): any[] {
  if (!hours || typeof hours !== 'object') return [];
  const fallbackPeriods: any[] = [];
  for (const day of DAYS) {
    const h = hours[day];
    if (h && typeof h === 'object' && !h.closed && h.open && h.close) {
      fallbackPeriods.push({ day: day.toUpperCase(), open: h.open, close: h.close });
    } else if (typeof h === 'string' && h.toLowerCase() !== 'closed') {
      const match = h.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
      if (match) {
        fallbackPeriods.push({ day: day.toUpperCase(), open: match[1].trim(), close: match[2].trim() });
      }
    }
  }
  return fallbackPeriods;
}

/**
 * Canonical hours resolver shared by the public and private status endpoints.
 * Canonical source is business_hours_list; when it has no saved periods the
 * chain falls back to the seed listing's business_hours blob, then the
 * business profile hours blob (unclaimed directory seeds live there — the
 * public status endpoint used to read business_hours_list alone and reported
 * every seed 'Closed'). The timezone comes from whichever source supplied
 * hours; if none carries one it's inferred from the listing's state before
 * the America/New_York default.
 */
export async function getTenantBusinessHours(tenantId: string): Promise<{ timezone: string; periods: any[] }> {
  const row = await prisma.business_hours_list.findUnique({ where: { tenant_id: tenantId } });
  let timezone: string | null = row?.timezone || null;
  let periods: any[] = (row?.periods as any) || [];
  let listingState: string | null | undefined;

  if (periods.length === 0) {
    const listing = await prisma.directory_listings_list.findFirst({
      where: { tenant_id: tenantId, listing_origin: 'directory_seed' }
    });
    listingState = listing?.state;
    const listingHours = listing?.business_hours as any;
    if (listingHours && typeof listingHours === 'object') {
      periods = parseProfileHoursToPeriods(listingHours);
      timezone = listingHours.timezone || timezone;
    }

    if (periods.length === 0) {
      const profile = await prisma.tenant_business_profiles_list.findUnique({
        where: { tenant_id: tenantId },
        select: { hours: true },
      });
      const profileHours = profile?.hours as any;
      if (profileHours && typeof profileHours === 'object') {
        periods = parseProfileHoursToPeriods(profileHours);
        timezone = profileHours.timezone || timezone;
      }
    }
  }

  if (!timezone) {
    if (listingState === undefined) {
      const listing = await prisma.directory_listings_list.findFirst({
        where: { tenant_id: tenantId },
        select: { state: true },
      });
      listingState = listing?.state;
    }
    timezone = usStateTimezone(listingState) || 'America/New_York';
  }

  return { timezone, periods };
}

/**
 * Updates the business profile's hours field with combined hours data
 * Only updates existing profiles, doesn't create new ones
 */
export async function updateBusinessProfileHours(tenantId: string): Promise<void> {
  try {
    const combinedHours = await buildCombinedHoursObject(tenantId);

    // Only update if profile exists
    const existingProfile = await prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id: tenantId },
    });

    if (existingProfile) {
      await prisma.tenant_business_profiles_list.update({
        where: { tenant_id: tenantId },
        data: {
          hours: combinedHours,
          updated_at: new Date(),
        },
      });
      console.log(`[updateBusinessProfileHours] Updated business profile hours for tenant ${tenantId}`);
    } else {
      console.log(`[updateBusinessProfileHours] No business profile found for tenant ${tenantId}, skipping hours update`);
    }
  } catch (error) {
    logger.error('[updateBusinessProfileHours] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  }
}
