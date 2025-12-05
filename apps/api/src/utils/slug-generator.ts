/**
 * Slug Generation with Geographic Disambiguation
 * 
 * Handles name collisions at global scale by progressively adding:
 * 1. Base slug (business-name)
 * 2. City (business-name-new-york)
 * 3. State (business-name-new-york-ny)
 * 4. Country (business-name-new-york-ny-usa)
 * 5. Numeric suffix as last resort (business-name-new-york-ny-usa-2)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LocationInfo {
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Slugify a string (convert to URL-friendly format)
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a unique directory slug with geographic disambiguation
 * 
 * @param businessName - The business name
 * @param location - Location information (city, state, country)
 * @param tenantId - Optional tenant ID to exclude from uniqueness check (for updates)
 * @returns A unique slug
 */
export async function generateUniqueDirectorySlug(
  businessName: string,
  location: LocationInfo,
  tenantId?: string
): Promise<string> {
  const baseSlug = slugify(businessName);
  
  // Try base slug first
  if (await isSlugAvailable(baseSlug, tenantId)) {
    return baseSlug;
  }

  // Try with city
  if (location.city) {
    const citySlug = `${baseSlug}-${slugify(location.city)}`;
    if (await isSlugAvailable(citySlug, tenantId)) {
      return citySlug;
    }
  }

  // Try with city and state
  if (location.city && location.state) {
    const stateSlug = `${baseSlug}-${slugify(location.city)}-${slugify(location.state)}`;
    if (await isSlugAvailable(stateSlug, tenantId)) {
      return stateSlug;
    }
  }

  // Try with city, state, and country
  if (location.city && location.state && location.country) {
    const countrySlug = `${baseSlug}-${slugify(location.city)}-${slugify(location.state)}-${slugify(location.country)}`;
    if (await isSlugAvailable(countrySlug, tenantId)) {
      return countrySlug;
    }
  }

  // Last resort: numeric suffix
  // Use the most specific slug we can (with all available location data)
  let finalBaseSlug = baseSlug;
  if (location.city && location.state && location.country) {
    finalBaseSlug = `${baseSlug}-${slugify(location.city)}-${slugify(location.state)}-${slugify(location.country)}`;
  } else if (location.city && location.state) {
    finalBaseSlug = `${baseSlug}-${slugify(location.city)}-${slugify(location.state)}`;
  } else if (location.city) {
    finalBaseSlug = `${baseSlug}-${slugify(location.city)}`;
  }

  let counter = 2; // Start at 2 since the base already exists
  let slug = `${finalBaseSlug}-${counter}`;
  
  while (!(await isSlugAvailable(slug, tenantId))) {
    counter++;
    slug = `${finalBaseSlug}-${counter}`;
  }

  return slug;
}

/**
 * Check if a slug is available (not already taken)
 */
async function isSlugAvailable(slug: string, excludeTenantId?: string): Promise<boolean> {
  const existing = await prisma.directory_settings_list.findUnique({
    where: { slug },
  });

  // Slug is available if:
  // 1. It doesn't exist, OR
  // 2. It exists but belongs to the tenant we're updating
  if (!existing) return true;
  if (excludeTenantId && existing.tenant_id === excludeTenantId) return true;
  return false;
}

/**
 * Get location info from tenant's business profile
 */
export async function getTenantLocation(tenantId: string): Promise<LocationInfo> {
  const profile = await prisma.tenant_business_profiles_list.findUnique({
    where: { tenant_id: tenantId },
    select: {
      city: true,
      state: true,
      country_code: true,
    },
  });

  return {
    city: profile?.city || undefined,
    state: profile?.state || undefined,
    country: profile?.country_code || undefined,
  };
}

/**
 * Example usage:
 * 
 * const location = await getTenantLocation(tenantId);
 * const slug = await generateUniqueDirectorySlug('Starbucks', location, tenantId);
 * 
 * Results:
 * - First Starbucks: "starbucks"
 * - Second in NYC: "starbucks-new-york"
 * - Third in NYC: "starbucks-new-york-ny"
 * - Fourth in NYC: "starbucks-new-york-ny-usa"
 * - Fifth in NYC: "starbucks-new-york-ny-usa-2"
 */
