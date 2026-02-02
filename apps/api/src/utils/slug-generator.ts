/**
 * ============================================================================
 * PLATFORM STANDARD: Slug Generation Utility
 * ============================================================================
 * 
 * This is the OFFICIAL platform standard for all slug generation.
 * All services, routes, and components MUST use this utility for consistency.
 * 
 * DO NOT create custom slug generation logic elsewhere in the codebase.
 * 
 * Features:
 * - Geographic disambiguation for global scale
 * - Database uniqueness validation
 * - Intelligent collision resolution
 * - State/country abbreviations for SEO
 * - AutoId fallback for guaranteed uniqueness
 * - Tenant-aware for multi-tenant isolation
 * 
 * Disambiguation Strategy:
 * 1. Base slug (business-name)
 * 2. City (business-name-new-york)
 * 3. State (business-name-new-york-ny)
 * 4. Country (business-name-new-york-ny-usa)
 * 5. AutoId/Numeric suffix (business-name-new-york-ny-usa-12345)
 * 
 * Usage Examples:
 * - Tenant directory slugs: generateUniqueDirectorySlug()
 * - Product slugs: slugify() (no uniqueness check needed)
 * - Category slugs: slugify() (no uniqueness check needed)
 * - Location slugs: Use with location data for disambiguation
 * 
 * Migration Status:
 * ✅ TenantSingletonService
 * ✅ GBPCategorySync
 * ⏳ store-type-directory.service.ts (pending)
 * ⏳ routes/integrations/clover.ts (pending)
 * ⏳ Frontend components (pending API endpoint)
 * 
 * @see Phase 2-5 migration plan in platform documentation
 * ============================================================================
 */

import { prisma } from '../prisma';

interface LocationInfo {
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Slugify a string (convert to URL-friendly format)
 * 
 * Use this for simple slug generation where uniqueness checks are not required:
 * - Product slugs (unique by product ID)
 * - Category slugs (unique by category ID)
 * - Tag slugs (unique by tag ID)
 * 
 * For tenant/directory slugs that require uniqueness validation,
 * use generateUniqueDirectorySlug() instead.
 * 
 * @param text - The text to convert to a slug
 * @returns URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get 2-character state abbreviation
 */
function getStateAbbreviation(state: string): string {
  const stateAbbreviations: Record<string, string> = {
    // US States
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
    'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
    'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
    'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
    'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH',
    'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
    'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA',
    'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN',
    'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
    'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
    // Canadian Provinces
    'ontario': 'ON', 'quebec': 'QC', 'british columbia': 'BC', 'alberta': 'AB',
    'manitoba': 'MB', 'saskatchewan': 'SK', 'nova scotia': 'NS', 'new brunswick': 'NB',
    'newfoundland': 'NL', 'prince edward island': 'PE'
  };
  
  const normalizedState = state.toLowerCase().trim();
  return stateAbbreviations[normalizedState] || normalizedState.substring(0, 2).toUpperCase();
}

/**
 * Get 2-character country abbreviation
 */
function getCountryAbbreviation(country: string): string {
  const countryAbbreviations: Record<string, string> = {
    'united states': 'US', 'canada': 'CA', 'united kingdom': 'UK', 'australia': 'AU',
    'germany': 'DE', 'france': 'FR', 'italy': 'IT', 'spain': 'ES', 'japan': 'JP',
    'china': 'CN', 'india': 'IN', 'brazil': 'BR', 'mexico': 'MX', 'netherlands': 'NL',
    'south korea': 'KR', 'russia': 'RU', 'argentina': 'AR', 'south africa': 'ZA',
    'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI', 'belgium': 'BE',
    'austria': 'AT', 'switzerland': 'CH', 'ireland': 'IE', 'portugal': 'PT', 'poland': 'PL',
    'new zealand': 'NZ', 'singapore': 'SG', 'hong kong': 'HK', 'israel': 'IL', 'uae': 'AE'
  };
  
  const normalizedCountry = country.toLowerCase().trim();
  return countryAbbreviations[normalizedCountry] || normalizedCountry.substring(0, 2).toUpperCase();
}

/**
 * Generate a unique directory slug with geographic disambiguation
 * 
 * @param businessName - The business name
 * @param location - Location information (city, state, country)
 * @param tenantId - Optional tenant ID to exclude from uniqueness check (for updates)
 * @param autoId - Optional autoId to use as final fallback instead of numeric suffix
 * @returns A unique slug
 */
export async function generateUniqueDirectorySlug(
  businessName: string,
  location: LocationInfo,
  tenantId?: string,
  autoId?: string
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

  // Try with city and abbreviated state
  if (location.city && location.state) {
    const stateAbbr = getStateAbbreviation(location.state);
    const cityStateSlug = `${baseSlug}-${slugify(location.city)}-${stateAbbr}`;
    if (await isSlugAvailable(cityStateSlug, tenantId)) {
      return cityStateSlug;
    }
  }

  // Try with city, abbreviated state, and abbreviated country
  if (location.city && location.state && location.country) {
    const stateAbbr = getStateAbbreviation(location.state);
    const countryAbbr = getCountryAbbreviation(location.country);
    const cityStateCountrySlug = `${baseSlug}-${slugify(location.city)}-${stateAbbr}-${countryAbbr}`;
    if (await isSlugAvailable(cityStateCountrySlug, tenantId)) {
      return cityStateCountrySlug;
    }
  }

  // Last resort: use autoId for guaranteed uniqueness
  // Use the most specific slug we can (with all available location data)
  let finalBaseSlug = baseSlug;
  if (location.city && location.state && location.country) {
    const stateAbbr = getStateAbbreviation(location.state);
    const countryAbbr = getCountryAbbreviation(location.country);
    finalBaseSlug = `${baseSlug}-${slugify(location.city)}-${stateAbbr}-${countryAbbr}`;
  } else if (location.city && location.state) {
    const stateAbbr = getStateAbbreviation(location.state);
    finalBaseSlug = `${baseSlug}-${slugify(location.city)}-${stateAbbr}`;
  } else if (location.city) {
    finalBaseSlug = `${baseSlug}-${slugify(location.city)}`;
  }

  // Use autoId as the final fallback for guaranteed uniqueness
  if (autoId) {
    const slug = `${finalBaseSlug}-${autoId}`;
    return slug;
  }

  // Fallback to numeric suffix if no autoId provided (backward compatibility)
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
