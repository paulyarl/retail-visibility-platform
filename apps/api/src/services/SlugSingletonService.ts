/**
 * ============================================================================
 * PLATFORM STANDARD: Slug Singleton Service
 * ============================================================================
 * 
 * Centralized slug management with caching and database persistence.
 * All slug operations MUST go through this service for consistency.
 * 
 * Features:
 * - Automatic slug generation with geographic disambiguation
 * - Database persistence to directory_settings_list
 * - 15-minute caching per tenant
 * - Automatic uniqueness validation
 * - Handles slug lifecycle (create, read, update)
 * 
 * Usage:
 * ```typescript
 * import slugSingletonService from './SlugSingletonService';
 * 
 * // Get or create slug for tenant
 * const slug = await slugSingletonService.getOrCreateSlug(tenantId);
 * 
 * // Generate new slug without saving
 * const newSlug = await slugSingletonService.generateSlug(businessName, location);
 * 
 * // Update existing slug
 * await slugSingletonService.updateSlug(tenantId, newSlug);
 * ```
 * ============================================================================
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { logger } from '../logger';
import { basePrisma } from '../prisma';
import { 
  generateUniqueDirectorySlug, 
  getTenantLocation, 
  slugify 
} from '../utils/slug-generator';

// Slug Information Interface
export interface SlugInfo {
  tenantId: string;
  slug: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Location Information Interface
export interface LocationInfo {
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Slug Singleton Service
 * Manages slug generation, caching, and persistence
 */
class SlugSingletonService extends UniversalSingleton {
  constructor() {
    const options: SingletonCacheOptions = {
      defaultTTL: 15 * 60, // 15 minutes in seconds
      enableCache: true,
      enableMetrics: true,
      enableLogging: true,
    };
    super('SlugSingletonService', options);
  }

  /**
   * Get or create slug for a tenant
   * 
   * Flow:
   * 1. Check cache
   * 2. Check database (directory_settings_list)
   * 3. If not found, generate new slug
   * 4. Save to database
   * 5. Cache result
   * 6. Return slug
   * 
   * @param tenantId - The tenant ID
   * @returns The tenant's slug
   */
  async getOrCreateSlug(tenantId: string): Promise<string> {
    if (!tenantId) {
      logger.error('[SlugSingletonService] getOrCreateSlug: tenantId is required');
      throw new Error('tenantId is required');
    }

    const cacheKey = `slug:${tenantId}`;

    try {
      // Check cache first
      const cached = await this.getFromCache<string>(cacheKey);
      if (cached) {
        logger.debug(`[SlugSingletonService] Cache hit for tenant ${tenantId}`);
        return cached;
      }

      // Check database
      const existing = await basePrisma.directory_settings_list.findUnique({
        where: { tenant_id: tenantId },
        select: { slug: true },
      });

      if (existing?.slug) {
        logger.debug(`[SlugSingletonService] Found existing slug in database: ${existing.slug}`);
        await this.setCache(cacheKey, existing.slug);
        return existing.slug;
      }

      // Generate new slug
      logger.info(`[SlugSingletonService] Generating new slug for tenant ${tenantId}`);
      const slug = await this.createSlugForTenant(tenantId);
      
      // Cache the result
      await this.setCache(cacheKey, slug);
      
      return slug;
    } catch (error: unknown) {
      logger.error('[SlugSingletonService] Failed to get or create slug:', undefined, { error });
      throw error;
    }
  }

  /**
   * Create and persist a new slug for a tenant
   * 
   * @param tenantId - The tenant ID
   * @returns The generated slug
   */
  private async createSlugForTenant(tenantId: string): Promise<string> {
    try {
      // Get tenant info
      const tenant = await basePrisma.tenants.findUnique({
        where: { id: tenantId },
        select: { 
          name: true,
          slug: true,
        },
      });

      if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      // Get business profile for better slug generation
      const businessProfile = await basePrisma.tenant_business_profiles_list.findUnique({
        where: { tenant_id: tenantId },
        select: {
          business_name: true,
          city: true,
          state: true,
          country_code: true,
        },
      });

      // Use business name if available, otherwise tenant name
      const businessName = businessProfile?.business_name || tenant.name;

      // Get location info
      const location: LocationInfo = {
        city: businessProfile?.city || undefined,
        state: businessProfile?.state || undefined,
        country: businessProfile?.country_code || undefined,
      };

      // Generate autoId for guaranteed uniqueness
      const autoId = this.generateAutoId(tenantId);

      // Generate unique slug using platform standard
      const slug = await generateUniqueDirectorySlug(
        businessName,
        location,
        tenantId,
        autoId
      );

      // Save to database
      await basePrisma.directory_settings_list.upsert({
        where: { tenant_id: tenantId },
        update: {
          slug,
          updated_at: new Date(),
        },
        create: {
          id: tenantId,
          tenant_id: tenantId,
          slug,
          is_published: false,
          updated_at: new Date(),
        },
      });

      logger.info(`[SlugSingletonService] Created and saved slug: ${slug} for tenant ${tenantId}`);
      
      return slug;
    } catch (error: unknown) {
      logger.error('[SlugSingletonService] Failed to create slug for tenant:', undefined, { error });
      throw error;
    }
  }

  /**
   * Generate a slug without saving to database
   * Useful for previewing slugs or validation
   * 
   * @param businessName - The business name
   * @param location - Location information
   * @param tenantId - Optional tenant ID to exclude from uniqueness check
   * @returns The generated slug
   */
  async generateSlug(
    businessName: string,
    location: LocationInfo = {},
    tenantId?: string
  ): Promise<string> {
    try {
      const autoId = tenantId ? this.generateAutoId(tenantId) : undefined;
      return await generateUniqueDirectorySlug(businessName, location, tenantId, autoId);
    } catch (error: unknown) {
      logger.error('[SlugSingletonService] Failed to generate slug:', undefined, { error });
      throw error;
    }
  }

  /**
   * Regenerate slug from current business name
   * Useful when business name changes and slug should be updated to match
   * 
   * @param tenantId - The tenant ID
   * @param forceUpdate - If true, updates even if slug already exists
   * @returns The new slug
   */
  async regenerateSlugFromBusinessName(tenantId: string, forceUpdate: boolean = false): Promise<string> {
    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    try {
      // Get current business name and location
      const businessProfile = await basePrisma.tenant_business_profiles_list.findUnique({
        where: { tenant_id: tenantId },
        select: {
          business_name: true,
          city: true,
          state: true,
          country_code: true,
        },
      });

      if (!businessProfile?.business_name) {
        throw new Error(`No business name found for tenant ${tenantId}`);
      }

      // Get current slug
      const currentSettings = await basePrisma.directory_settings_list.findUnique({
        where: { tenant_id: tenantId },
        select: { slug: true },
      });

      // Generate new slug based on current business name
      const location = {
        city: businessProfile.city || undefined,
        state: businessProfile.state || undefined,
        country: businessProfile.country_code || undefined,
      };

      const autoId = this.generateAutoId(tenantId);
      const newSlug = await generateUniqueDirectorySlug(
        businessProfile.business_name,
        location,
        tenantId,
        autoId
      );

      // Only update if slug changed or force update
      if (forceUpdate || !currentSettings || currentSettings.slug !== newSlug) {
        await this.updateSlug(tenantId, newSlug);
        logger.info(`[SlugSingletonService] Regenerated slug from business name: ${newSlug} for tenant ${tenantId}`);
      }

      return newSlug;
    } catch (error: unknown) {
      logger.error('[SlugSingletonService] Failed to regenerate slug from business name:', undefined, { error });
      throw error;
    }
  }

  /**
   * Update slug for a tenant
   * 
   * @param tenantId - The tenant ID
   * @param newSlug - The new slug
   */
  async updateSlug(tenantId: string, newSlug: string): Promise<void> {
    if (!tenantId || !newSlug) {
      throw new Error('tenantId and newSlug are required');
    }

    try {
      // Validate slug is available
      const existing = await basePrisma.directory_settings_list.findUnique({
        where: { slug: newSlug },
      });

      if (existing && existing.tenant_id !== tenantId) {
        throw new Error(`Slug "${newSlug}" is already taken by another tenant`);
      }

      // Update in database
      await basePrisma.directory_settings_list.update({
        where: { tenant_id: tenantId },
        data: {
          slug: newSlug,
          updated_at: new Date(),
        },
      });

      // Invalidate cache
      const cacheKey = `slug:${tenantId}`;
      await this.clearCache(cacheKey);
      
      // Also invalidate tenant identifiers cache (used by TenantSingletonService)
      await this.clearCache(`tenant_identifiers:${tenantId}`);
      
      // Invalidate shop data cache (used by ShopManagementService)
      await this.clearCache(`shop_data:${tenantId}`);

      logger.info(`[SlugSingletonService] Updated slug to: ${newSlug} for tenant ${tenantId}`);
    } catch (error: unknown) {
      logger.error('[SlugSingletonService] Failed to update slug:', undefined, { error });
      throw error;
    }
  }

  /**
   * Get slug info with metadata
   * 
   * @param tenantId - The tenant ID
   * @returns Slug information with metadata
   */
  async getSlugInfo(tenantId: string): Promise<SlugInfo | null> {
    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    const cacheKey = `slug-info:${tenantId}`;

    try {
      // Check cache
      const cached = await this.getFromCache<SlugInfo>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get from database
      const settings = await basePrisma.directory_settings_list.findUnique({
        where: { tenant_id: tenantId },
        select: {
          tenant_id: true,
          slug: true,
          is_published: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!settings) {
        return null;
      }

      const slugInfo: SlugInfo = {
        tenantId: settings.tenant_id,
        slug: settings.slug || '',
        isPublished: settings.is_published,
        createdAt: settings.created_at || new Date(),
        updatedAt: settings.updated_at || new Date(),
      };

      // Cache the result
      await this.setCache(cacheKey, slugInfo);

      return slugInfo;
    } catch (error: unknown) {
      logger.error('[SlugSingletonService] Failed to get slug info:', undefined, { error });
      throw error;
    }
  }

  /**
   * Check if a slug is available
   * 
   * @param slug - The slug to check
   * @param excludeTenantId - Optional tenant ID to exclude from check
   * @returns True if slug is available
   */
  async isSlugAvailable(slug: string, excludeTenantId?: string): Promise<boolean> {
    try {
      const existing = await basePrisma.directory_settings_list.findUnique({
        where: { slug },
      });

      if (!existing) return true;
      if (excludeTenantId && existing.tenant_id === excludeTenantId) return true;
      return false;
    } catch (error: unknown) {
      logger.error('[SlugSingletonService] Failed to check slug availability:', undefined, { error });
      throw error;
    }
  }

  /**
   * Get slug ownership status
   * Returns both availability and whether it belongs to the current tenant
   * 
   * @param slug - The slug to check
   * @param tenantId - The tenant ID to check ownership against
   * @returns Object with isAvailable and isOwnSlug booleans
   */
  async getSlugOwnership(slug: string, tenantId?: string): Promise<{ isAvailable: boolean; isOwnSlug: boolean }> {
    try {
      const existing = await basePrisma.directory_settings_list.findUnique({
        where: { slug },
        select: { tenant_id: true },
      });

      if (!existing) {
        return { isAvailable: true, isOwnSlug: false };
      }

      if (tenantId && existing.tenant_id === tenantId) {
        return { isAvailable: true, isOwnSlug: true };
      }

      return { isAvailable: false, isOwnSlug: false };
    } catch (error: unknown) {
      logger.error('[SlugSingletonService] Failed to get slug ownership:', undefined, { error });
      throw error;
    }
  }

  /**
   * Invalidate slug cache for a tenant
   * 
   * @param tenantId - The tenant ID
   */
  async invalidateSlugCache(tenantId: string): Promise<void> {
    const cacheKey = `slug:${tenantId}`;
    const infoKey = `slug-info:${tenantId}`;
    await this.clearCache(cacheKey);
    await this.clearCache(infoKey);
    logger.debug(`[SlugSingletonService] Invalidated cache for tenant ${tenantId}`);
  }

  /**
   * Generate deterministic autoId from tenantId
   * Matches backend logic in TenantSingletonService
   */
  private generateAutoId(tenantId: string): string {
    // Extract the numeric part from tenantId (tid-12345 -> 12345)
    const match = tenantId.match(/tid-(\d+)/);
    if (match && match[1]) {
      return match[1];
    }
    
    // Fallback: use hash of tenantId
    return this.simpleHash(tenantId);
  }

  /**
   * Simple hash function for autoId generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 6).toUpperCase();
  }

  /**
   * Bulk get slugs for multiple tenants
   * Optimized for performance with batch caching
   * 
   * @param tenantIds - Array of tenant IDs
   * @returns Map of tenantId to slug
   */
  async getBulkSlugs(tenantIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const uncachedIds: string[] = [];

    // Check cache first
    for (const tenantId of tenantIds) {
      const cacheKey = `slug:${tenantId}`;
      const cached = await this.getFromCache<string>(cacheKey);
      if (cached) {
        result.set(tenantId, cached);
      } else {
        uncachedIds.push(tenantId);
      }
    }

    // Fetch uncached slugs from database
    if (uncachedIds.length > 0) {
      const settings = await basePrisma.directory_settings_list.findMany({
        where: { tenant_id: { in: uncachedIds } },
        select: { tenant_id: true, slug: true },
      });

      for (const setting of settings) {
        if (setting.tenant_id && setting.slug) {
          result.set(setting.tenant_id, setting.slug);
          // Cache the result
          const cacheKey = `slug:${setting.tenant_id}`;
          await this.setCache(cacheKey, setting.slug);
        }
      }
    }

    return result;
  }

  /**
   * Get all possible slug patterns for a business name and location
   * Allows callers to choose their preferred slug pattern
   * 
   * @param businessName - The business name
   * @param location - Location information
   * @param tenantId - Optional tenant ID to check availability
   * @returns Array of slug patterns with availability status
   */
  async getAllSlugPatterns(
    businessName: string,
    location: LocationInfo = {},
    tenantId?: string
  ): Promise<Array<{ pattern: string; slug: string; isAvailable: boolean; isOwnSlug: boolean; description: string }>> {
    const patterns: Array<{ pattern: string; slug: string; isAvailable: boolean; isOwnSlug: boolean; description: string }> = [];
    const baseSlug = slugify(businessName);

    // Pattern 1: Business name only
    const pattern1 = baseSlug;
    const ownership1 = await this.getSlugOwnership(pattern1, tenantId);
    patterns.push({
      pattern: 'business_name',
      slug: pattern1,
      isAvailable: ownership1.isAvailable,
      isOwnSlug: ownership1.isOwnSlug,
      description: 'Business name only (shortest, most memorable)',
    });

    // Pattern 2: Business name + city
    if (location.city) {
      const pattern2 = `${baseSlug}-${slugify(location.city)}`;
      const ownership2 = await this.getSlugOwnership(pattern2, tenantId);
      patterns.push({
        pattern: 'business_name_city',
        slug: pattern2,
        isAvailable: ownership2.isAvailable,
        isOwnSlug: ownership2.isOwnSlug,
        description: `${businessName} in ${location.city}`,
      });
    }

    // Pattern 3: Business name + state abbreviation
    if (location.state) {
      const stateAbbr = this.getStateAbbreviation(location.state);
      const pattern3 = `${baseSlug}-${stateAbbr.toLowerCase()}`;
      const ownership3 = await this.getSlugOwnership(pattern3, tenantId);
      patterns.push({
        pattern: 'business_name_state',
        slug: pattern3,
        isAvailable: ownership3.isAvailable,
        isOwnSlug: ownership3.isOwnSlug,
        description: `${businessName} in ${location.state}`,
      });
    }

    // Pattern 4: Business name + city + state
    if (location.city && location.state) {
      const stateAbbr = this.getStateAbbreviation(location.state);
      const pattern4 = `${baseSlug}-${slugify(location.city)}-${stateAbbr.toLowerCase()}`;
      const ownership4 = await this.getSlugOwnership(pattern4, tenantId);
      patterns.push({
        pattern: 'business_name_city_state',
        slug: pattern4,
        isAvailable: ownership4.isAvailable,
        isOwnSlug: ownership4.isOwnSlug,
        description: `${businessName} in ${location.city}, ${location.state}`,
      });
    }

    // Pattern 5: Business name + city + state + country
    if (location.city && location.state && location.country) {
      const stateAbbr = this.getStateAbbreviation(location.state);
      const countryAbbr = this.getCountryAbbreviation(location.country);
      const pattern5 = `${baseSlug}-${slugify(location.city)}-${stateAbbr.toLowerCase()}-${countryAbbr.toLowerCase()}`;
      const ownership5 = await this.getSlugOwnership(pattern5, tenantId);
      patterns.push({
        pattern: 'business_name_city_state_country',
        slug: pattern5,
        isAvailable: ownership5.isAvailable,
        isOwnSlug: ownership5.isOwnSlug,
        description: `${businessName} in ${location.city}, ${location.state}, ${location.country}`,
      });
    }

    // Pattern 6: Business name + autoId (guaranteed unique)
    if (tenantId) {
      const autoId = this.generateAutoId(tenantId);
      const pattern6 = `${baseSlug}-${autoId.toLowerCase()}`;
      patterns.push({
        pattern: 'business_name_autoid',
        slug: pattern6,
        isAvailable: true, // Always available with autoId
        isOwnSlug: false, // New slug, not owned yet
        description: `${businessName} (unique ID)`,
      });
    }

    return patterns;
  }

  /**
   * Generate slug with specific pattern
   * Allows caller to choose exact pattern instead of auto-escalation
   * 
   * @param businessName - The business name
   * @param location - Location information
   * @param pattern - Desired pattern (business_name, business_name_city, etc.)
   * @param tenantId - Optional tenant ID
   * @returns The generated slug
   */
  async generateSlugWithPattern(
    businessName: string,
    location: LocationInfo = {},
    pattern: 'business_name' | 'business_name_city' | 'business_name_state' | 'business_name_city_state' | 'business_name_city_state_country' | 'business_name_autoid',
    tenantId?: string
  ): Promise<string> {
    const baseSlug = slugify(businessName);

    switch (pattern) {
      case 'business_name':
        return baseSlug;

      case 'business_name_city':
        if (!location.city) throw new Error('City required for business_name_city pattern');
        return `${baseSlug}-${slugify(location.city)}`;

      case 'business_name_state':
        if (!location.state) throw new Error('State required for business_name_state pattern');
        const stateAbbr = this.getStateAbbreviation(location.state);
        return `${baseSlug}-${stateAbbr.toLowerCase()}`;

      case 'business_name_city_state':
        if (!location.city || !location.state) throw new Error('City and state required for business_name_city_state pattern');
        const stateAbbr2 = this.getStateAbbreviation(location.state);
        return `${baseSlug}-${slugify(location.city)}-${stateAbbr2.toLowerCase()}`;

      case 'business_name_city_state_country':
        if (!location.city || !location.state || !location.country) {
          throw new Error('City, state, and country required for business_name_city_state_country pattern');
        }
        const stateAbbr3 = this.getStateAbbreviation(location.state);
        const countryAbbr = this.getCountryAbbreviation(location.country);
        return `${baseSlug}-${slugify(location.city)}-${stateAbbr3.toLowerCase()}-${countryAbbr.toLowerCase()}`;

      case 'business_name_autoid':
        if (!tenantId) throw new Error('Tenant ID required for business_name_autoid pattern');
        const autoId = this.generateAutoId(tenantId);
        return `${baseSlug}-${autoId.toLowerCase()}`;

      default:
        throw new Error(`Unknown pattern: ${pattern}`);
    }
  }

  /**
   * Get state abbreviation (2 characters)
   */
  private getStateAbbreviation(state: string): string {
    const stateAbbreviations: Record<string, string> = {
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
      'ontario': 'ON', 'quebec': 'QC', 'british columbia': 'BC', 'alberta': 'AB',
      'manitoba': 'MB', 'saskatchewan': 'SK', 'nova scotia': 'NS', 'new brunswick': 'NB',
      'newfoundland': 'NL', 'prince edward island': 'PE'
    };
    const normalized = state.toLowerCase().trim();
    return stateAbbreviations[normalized] || normalized.substring(0, 2).toUpperCase();
  }

  /**
   * Get country abbreviation (2 characters)
   */
  private getCountryAbbreviation(country: string): string {
    const countryAbbreviations: Record<string, string> = {
      'united states': 'US', 'canada': 'CA', 'united kingdom': 'UK', 'australia': 'AU',
      'germany': 'DE', 'france': 'FR', 'italy': 'IT', 'spain': 'ES', 'japan': 'JP',
      'china': 'CN', 'india': 'IN', 'brazil': 'BR', 'mexico': 'MX', 'netherlands': 'NL',
      'south korea': 'KR', 'russia': 'RU', 'argentina': 'AR', 'south africa': 'ZA',
      'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI', 'belgium': 'BE',
      'austria': 'AT', 'switzerland': 'CH', 'ireland': 'IE', 'portugal': 'PT', 'poland': 'PL',
      'new zealand': 'NZ', 'singapore': 'SG', 'hong kong': 'HK', 'israel': 'IL', 'uae': 'AE'
    };
    const normalized = country.toLowerCase().trim();
    return countryAbbreviations[normalized] || normalized.substring(0, 2).toUpperCase();
  }

  /**
   * Simple slugify function for non-unique slugs
   * Use this for product slugs, category slugs, etc.
   * 
   * @param text - The text to slugify
   * @returns URL-friendly slug
   */
  slugify(text: string): string {
    return slugify(text);
  }
}

// Export singleton instance
const slugSingletonService = new SlugSingletonService();
export default slugSingletonService;
