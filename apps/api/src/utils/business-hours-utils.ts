import { prisma } from '../prisma';

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
    console.error('[buildCombinedHoursObject] Error:', error);
    return null;
  }
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
    console.error('[updateBusinessProfileHours] Error:', error);
  }
}
