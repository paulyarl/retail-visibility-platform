/**
 * Tenant Singleton Service - Centralized Tenant Information Provider
 * 
 * Provides consistent tenant data including:
 * - Slug generation and caching
 * - AutoId generation and caching  
 * - Business profile information
 * - Tenant metadata
 * - URL generation
 * 
 * This is the single source of truth for all tenant-related data
 * that other services can depend on for consistency and security.
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { logger } from '../logger';
import { basePrisma } from '../prisma';
import slugSingletonService from './SlugSingletonService';
import { 
  generateUniqueDirectorySlug, 
  getTenantLocation, 
  slugify 
} from '../utils/slug-generator';

// Tenant Information Interface
export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  autoId: string;
  businessName?: string;
  description?: string;
  logo?: string;
  banner?: string;
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
  location?: {
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  urls: {
    slugUrl: string;
    tenantIdUrl: string;
    autoIdUrl: string;
    canonicalUrl: string;
  };
  metadata?: Record<string, any>;
  isDemo?: boolean;
  demoExpiresAt?: string | null;
}

// Tenant Identifiers Interface
export interface TenantIdentifiers {
  tenantId: string;
  slug: string;
  autoId: string;
}

// Cache options for tenant data
const TENANT_CACHE_OPTIONS: SingletonCacheOptions = {
  enableCache: true,
  defaultTTL: 300, // 5 minutes
  maxCacheSize: 1000,
  enableMetrics: true,
  enableLogging: true,
  enableEncryption: false, // Tenant data is not highly sensitive
  authenticationLevel: 'authenticated'
};

class TenantSingletonService extends UniversalSingleton {
  static instance: any;
  getInstance(): TenantSingletonService {
    if (!TenantSingletonService.instance) {
      TenantSingletonService.instance = new TenantSingletonService();
    }
    return TenantSingletonService.instance;
  }
  constructor() {
    super('TenantSingletonService', TENANT_CACHE_OPTIONS);
  }


  /**
   * Get complete tenant information including slug and autoId
   * This is the main method other services should call
   */
  async getTenantInfo(tenantId: string): Promise<TenantInfo> {
    const cacheKey = `tenant_info:${tenantId}`;
    
    // Check cache first
    const cached = await this.getFromCache<TenantInfo>(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    try {
      // Fetch tenant data from database
      const tenant = await basePrisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          metadata: true,
          created_at: true,
          is_demo: true,
          demo_expires_at: true
        }
      });

      if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      // Fetch business profile for additional information
      let businessProfile = null;
      try {
        const profileResults = await basePrisma.$queryRaw`
          SELECT business_name, logo_url, banner_url, business_description,
                 phone_number, email, website, social_links,
                 address_line1, city, state, postal_code, country_code
          FROM "tenant_business_profiles_list"
          WHERE tenant_id = ${tenantId}
        `;
        businessProfile = (profileResults as any[])[0] || null;
      } catch (error) {
        console.log('warn', `Failed to fetch business profile for ${tenantId}:`, error);
      }

      // Use SlugSingletonService for slug management (caching + persistence)
      const slug = await slugSingletonService.getOrCreateSlug(tenantId);
      const autoId = this.generateTenantAutoId(tenantId);
      
      console.log('[TenantSingletonService] Retrieved slug from SlugSingletonService:', slug);

      // Parse social links
      const socialLinks = this.parseSocialLinks(businessProfile?.social_links);

      // Build tenant info object
      const tenantInfo: TenantInfo = {
        id: tenant.id,
        name: tenant.name,
        slug: slug,
        autoId: autoId,
        businessName: businessProfile?.business_name || tenant.name,
        description: businessProfile?.business_description,
        logo: businessProfile?.logo_url,
        banner: businessProfile?.banner_url,
        contact: {
          email: businessProfile?.email,
          phone: businessProfile?.phone_number,
          website: businessProfile?.website
        },
        socialLinks: socialLinks,
        location: {
          address: businessProfile?.address_line1,
          city: businessProfile?.city,
          state: businessProfile?.state,
          postalCode: businessProfile?.postal_code,
          country: businessProfile?.country_code
        },
        urls: this.generateUrls(tenantId, slug, autoId),
        metadata: (tenant.metadata as Record<string, any>) || {},
        isDemo: tenant.is_demo || false,
        demoExpiresAt: tenant.demo_expires_at ? tenant.demo_expires_at.toISOString() : null,
      };

      // Cache the result
      await this.setCache(cacheKey, tenantInfo);
      this.metrics.cacheMisses++;

      return tenantInfo;

    } catch (error) {
      this.metrics.errors++;
      console.log('error', `Failed to get tenant info for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get just the tenant identifiers (tenantId, slug, autoId)
   * Synchronous version to match base class signature
   */
  getTenantIdentifiers(tenantId: string, slug?: string): {
    tenantId: string;
    slug?: string;
    autoId: string;
  } {
    return {
      tenantId,
      slug,
      autoId: this.generateTenantAutoId(tenantId)
    };
  }

  /**
   * Get just the tenant identifiers (tenantId, slug, autoId) with full data
   * Async version with caching and full tenant lookup
   */
  async getTenantIdentifiersAsync(tenantId: string, slug?: string): Promise<TenantIdentifiers> {
    const cacheKey = `tenant_identifiers:${tenantId}`;
    
    // Check cache first
    const cached = await this.getFromCache<TenantIdentifiers>(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    try {
      // For performance, we can get just what we need
      const tenant = await basePrisma.tenants.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true }
      });

      if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      // Get business name and location for slug generation if needed
      let businessName = tenant.name;
      let location: { city?: string; state?: string; country?: string } = {};
      
      try {
        const profileResults = await basePrisma.$queryRaw`
          SELECT business_name, city, state, country_code FROM "tenant_business_profiles_list"
          WHERE tenant_id = ${tenantId}
        `;
        const profile = (profileResults as any[])[0];
        if (profile?.business_name) {
          businessName = profile.business_name;
          location = {
            city: profile.city,
            state: profile.state,
            country: profile.country_code
          };
        }
      } catch (error) {
        // Continue with tenant name if profile fetch fails
      }

      const autoId = this.generateTenantAutoId(tenantId);
      const slug = await slugSingletonService.getOrCreateSlug(tenantId);

      const identifiers: TenantIdentifiers = {
        tenantId: tenant.id,
        slug: slug,
        autoId: autoId
      };

      // Cache the result
      await this.setCache(cacheKey, identifiers);
      this.metrics.cacheMisses++;

      return identifiers;

    } catch (error) {
      this.metrics.errors++;
      console.log('error', `Failed to get tenant identifiers for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get just the tenant slug
   * Delegates to SlugSingletonService for caching and persistence
   */
  async getTenantSlug(tenantId: string): Promise<string> {
    return await slugSingletonService.getOrCreateSlug(tenantId);
  }

  /**
   * Generate all 3 slug levels at once for escalating collision detection
   * Level 1: business-name
   * Level 2: business-name-state  
   * Level 3: business-name-state-autoId
   */
  private generateAllSlugLevels(businessName: string, location?: { city?: string; state?: string; country?: string }, autoId?: string): {
    level1: string;
    level2: string;
    level3: string;
  } {
    // Level 1: Business name only
    const level1 = this.generateSlug(businessName);
    
    // Level 2: Business name + state
    let level2 = level1;
    if (location?.state) {
      const stateAbbr = this.getStateAbbreviation(location.state);
      if (stateAbbr) {
        level2 = `${level1}-${stateAbbr}`;
      }
    } else if (location?.city) {
      const cityAbbr = this.getCityAbbreviation(location.city);
      if (cityAbbr) {
        level2 = `${level1}-${cityAbbr}`;
      }
    } else if (location?.country) {
      const countryAbbr = this.getCountryAbbreviation(location.country);
      if (countryAbbr) {
        level2 = `${level1}-${countryAbbr}`;
      }
    }
    
    // Level 3: Business name + state + autoId
    const level3 = autoId ? `${level2}-${autoId}` : level2;
    
    return { level1, level2, level3 };
  }

  /**
   * Check collision for all 3 slug levels
   * Returns the first non-colliding level
   */
  private async checkAllSlugCollisions(levels: { level1: string; level2: string; level3: string }, excludeTenantId: string): Promise<{
    level: number;
    slug: string;
    hasCollision: boolean;
  }> {
    // Check Level 1: Business name only
    const collision1 = await this.checkSlugCollision(levels.level1, excludeTenantId);
    if (!collision1) {
      return { level: 1, slug: levels.level1, hasCollision: false };
    }
    
    // Check Level 2: Business name + state
    const collision2 = await this.checkSlugCollision(levels.level2, excludeTenantId);
    if (!collision2) {
      return { level: 2, slug: levels.level2, hasCollision: false };
    }
    
    // Check Level 3: Business name + state + autoId (guaranteed unique)
    return { level: 3, slug: levels.level3, hasCollision: true };
  }
  /**
   * Get smart tenant slug with 3-level escalating collision detection
   * Level 1: business-name (most SEO-friendly)
   * Level 2: business-name-state (geo-disambiguated)  
   * Level 3: business-name-state-autoId (guaranteed unique)
   */
  async getTenantSlugSmart(tenantId: string): Promise<string> {
    const cacheKey = `tenant_slug_smart:${tenantId}`;
    
    // Check cache first
    const cached = await this.getFromCache<string>(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    // Check if tenant already has a slug
    const existingTenant = await basePrisma.tenants.findUnique({
      where: { id: tenantId },
      select: { slug: true }
    });
    
    let finalSlug: string;
    if (existingTenant && existingTenant.slug) {
      // Use existing persisted slug - no collision check needed
      finalSlug = existingTenant.slug;
      console.log('[TenantSingletonService] Using existing persisted slug:', finalSlug);
    } else {
      // Generate all 3 levels at once with escalating collision detection
      const autoId = await this.getTenantAutoId(tenantId);
      
      // Get business name and location
      const businessProfile = await this.getBusinessProfile(tenantId);
      const location = {
        city: businessProfile?.city,
        state: businessProfile?.state,
        country: businessProfile?.country_code
      };
      
      const businessName = businessProfile?.business_name || (await this.getTenantName(tenantId));
      
      // Generate unique slug with robust geographic disambiguation
      finalSlug = await generateUniqueDirectorySlug(businessName, location, tenantId, autoId);
      
      console.log('[TenantSingletonService] Generated unique slug with geographic disambiguation:', finalSlug);
      
      // Persist the chosen slug level
      await this.persistTenantSlug(tenantId, finalSlug);
    }
    
    // Cache the result
    await this.setCache(cacheKey, finalSlug);
    this.metrics.cacheMisses++;

    return finalSlug;
  }

  /**
   * Helper method to get business profile
   */
  private async getBusinessProfile(tenantId: string) {
    try {
      const profileResults = await basePrisma.$queryRaw`
        SELECT business_name, city, state, country_code FROM "tenant_business_profiles_list"
        WHERE tenant_id = ${tenantId}
      `;
      return (profileResults as any[])[0] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper method to get tenant name
   */
  private async getTenantName(tenantId: string) {
    try {
      const tenant = await basePrisma.tenants.findUnique({
        where: { id: tenantId },
        select: { name: true }
      });
      return tenant?.name || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Persist slug to tenant table
   * Ensures consistency across all services
   */
  private async persistTenantSlug(tenantId: string, slug: string): Promise<void> {
    try {
      // Check if tenant already has a slug stored
      const existingTenant = await basePrisma.tenants.findUnique({
        where: { id: tenantId },
        select: { slug: true }
      });
      
      if (existingTenant && existingTenant.slug !== slug) {
        // Update existing tenant with new slug
        await basePrisma.tenants.update({
          where: { id: tenantId },
          data: { slug: slug }
        });
        console.log('info', `Updated tenant ${tenantId} slug to: ${slug}`);
      } else if (!existingTenant) {
        // Tenant not found - this shouldn't happen but handle gracefully
        console.log('warn', `Tenant ${tenantId} not found for slug persistence`);
      }
      // If tenant already has this slug, no action needed
      
    } catch (error) {
      console.log('error', `Failed to persist slug for tenant ${tenantId}:`, error);
      // Don't throw error - slug generation should still work even if persistence fails
    }
  }

  /**
   * Force update tenant slug (for admin operations)
   * Updates slug regardless of collision detection
   */
  async updateTenantSlug(tenantId: string, newSlug: string): Promise<void> {
    try {
      // Validate slug format
      if (!newSlug || newSlug.trim().length === 0) {
        throw new Error('Slug cannot be empty');
      }
      
      // Update tenant table
      await basePrisma.tenants.update({
        where: { id: tenantId },
        data: { slug: newSlug.trim() }
      });
      
      // Update directory listings if they exist
      try {
        await basePrisma.$executeRaw`
          UPDATE "directory_listings_list"
          SET slug = ${newSlug.trim()}, updated_at = NOW()
          WHERE tenant_id = ${tenantId}
        `;
      } catch (error) {
        console.log('warn', `Failed to update directory listing slug for ${tenantId}:`, error);
      }
      
      // Clear all related cache entries
      await this.clearCache(`tenant_slug_smart:${tenantId}`);
      await this.clearCache(`tenant_slug:${tenantId}`);
      await this.clearCache(`tenant_slug_autoid:${tenantId}`);
      await this.clearCache(`tenant_business_name:${tenantId}`);
      await this.clearCache(`tenant_location:${tenantId}`);
      
      console.log('info', `Force updated slug for tenant ${tenantId} to: ${newSlug.trim()}`);
      
    } catch (error) {
      this.metrics.errors++;
      console.log('error', `Failed to force update slug for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a slug would collide with existing tenants
   * Returns true if collision is detected
   */
  private async checkSlugCollision(slug: string, excludeTenantId: string): Promise<boolean> {
    try {
      // Check directory listings for same slug
      const directoryResults = await basePrisma.$queryRaw`
        SELECT COUNT(*) as count FROM "directory_listings_list"
        WHERE slug = ${slug} AND tenant_id != ${excludeTenantId}
      `;
      
      const directoryCount = (directoryResults as any[])[0]?.count || 0;
      
      // Check tenant table for same slug
      const tenantResults = await basePrisma.$queryRaw`
        SELECT COUNT(*) as count FROM "tenants"
        WHERE slug = ${slug} AND id != ${excludeTenantId}
      `;
      
      const tenantCount = (tenantResults as any[])[0]?.count || 0;
      
      const totalCollisions = directoryCount + tenantCount;
      
      if (totalCollisions > 0) {
        console.log('info', `Collision detected for slug "${slug}": ${totalCollisions} existing entries`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.log('warn', `Failed to check slug collision for "${slug}":`, error);
      // Assume no collision on error to avoid blocking
      return false;
    }
  }

  /**
   * Get guaranteed unique tenant slug with autoId fallback
   * For edge cases where multiple businesses have same name in same location
   * Format: business-name-state-autoId (e.g., starbucks-CA-A1B2)
   */
  async getTenantSlugWithAutoId(tenantId: string): Promise<string> {
    const cacheKey = `tenant_slug_autoid:${tenantId}`;
    
    // Check cache first
    const cached = await this.getFromCache<string>(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    // Get the regular slug first
    const regularSlug = await this.getTenantSlug(tenantId);
    
    // Get the autoId
    const autoId = await this.getTenantAutoId(tenantId);
    
    // Combine for guaranteed uniqueness
    const uniqueSlug = `${regularSlug}-${autoId}`;
    
    // Cache the result
    await this.setCache(cacheKey, uniqueSlug);
    this.metrics.cacheMisses++;

    return uniqueSlug;
  }

  /**
   * Get tenant identifiers with both slug options
   * Returns both regular and autoId-enhanced slugs
   */
  async getTenantIdentifiersWithAutoId(tenantId: string): Promise<TenantIdentifiers & { slugWithAutoId: string }> {
    const identifiers = await this.getTenantIdentifiersAsync(tenantId);
    const slugWithAutoId = await this.getTenantSlugWithAutoId(tenantId);
    
    return {
      ...identifiers,
      slugWithAutoId
    };
  }

  /**
   * Generate URLs with both slug options
   */
  generateUrlsWithAutoId(tenantId: string, slug: string, autoId: string): TenantInfo['urls'] & { slugWithAutoIdUrl: string } {
    const slugWithAutoId = `${slug}-${autoId}`;
    
    return {
      slugUrl: slug ? `/shops/${slug}` : `/shops/${tenantId}`,
      tenantIdUrl: `/shops/${tenantId}`,
      autoIdUrl: `/shops/${autoId}`,
      canonicalUrl: slug ? `/shops/${slug}` : `/shops/${tenantId}`,
      slugWithAutoIdUrl: `/shops/${slugWithAutoId}`
    };
  }

  /**
   * Get just the tenant autoId
   * Used for short URLs and identifiers
   */
  async getTenantAutoId(tenantId: string): Promise<string> {
    const cacheKey = `tenant_auto_id:${tenantId}`;
    
    // Check cache first
    const cached = await this.getFromCache<string>(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    const autoId = this.generateTenantAutoId(tenantId);
    
    // Cache the result
    await this.setCache(cacheKey, autoId);
    this.metrics.cacheMisses++;

    return autoId;
  }

  /**
   * Generate slug from business name with minimal geographic disambiguation
   * Uses short abbreviations for SEO optimization and memorability
   */
  private generateSlug(businessName: string, location?: { city?: string; state?: string; country?: string }): string {
    let baseSlug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // If no location info, return base slug
    if (!location || (!location.city && !location.state && !location.country)) {
      return baseSlug;
    }

    // Add minimal geographic disambiguation for SEO
    let geoSlug = baseSlug;
    
    // Priority 1: Use 2-character state abbreviation (most SEO-friendly)
    if (location.state) {
      const stateAbbr = this.getStateAbbreviation(location.state);
      if (stateAbbr) {
        geoSlug = `${baseSlug}-${stateAbbr}`;
      }
    }
    // Priority 2: Use 3-character city abbreviation (if no state)
    else if (location.city) {
      const cityAbbr = this.getCityAbbreviation(location.city);
      if (cityAbbr) {
        geoSlug = `${baseSlug}-${cityAbbr}`;
      }
    }
    // Priority 3: Use 2-character country abbreviation (last resort)
    else if (location.country) {
      const countryAbbr = this.getCountryAbbreviation(location.country);
      if (countryAbbr) {
        geoSlug = `${baseSlug}-${countryAbbr}`;
      }
    }

    return geoSlug;
  }

  /**
   * Get 2-character state abbreviation
   */
  private getStateAbbreviation(state: string): string {
    const stateAbbreviations: Record<string, string> = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
      'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
      'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
      'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
      'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
      'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
      'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
      'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
      'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
      'wisconsin': 'WI', 'wyoming': 'WY',
      'ontario': 'ON', 'quebec': 'QC', 'british columbia': 'BC', 'alberta': 'AB',
      'manitoba': 'MB', 'saskatchewan': 'SK', 'nova scotia': 'NS', 'new brunswick': 'NB',
      'newfoundland': 'NL', 'prince edward island': 'PE'
    };
    
    const normalizedState = state.toLowerCase().trim();
    return stateAbbreviations[normalizedState] || normalizedState.substring(0, 2).toUpperCase();
  }

  /**
   * Get 3-character city abbreviation
   */
  private getCityAbbreviation(city: string): string {
    // Simple 3-character abbreviation for common cities
    const cityAbbreviations: Record<string, string> = {
      'new york': 'NYC', 'los angeles': 'LAX', 'chicago': 'CHI', 'houston': 'HOU',
      'philadelphia': 'PHL', 'phoenix': 'PHX', 'san antonio': 'SAT', 'san diego': 'SAN',
      'dallas': 'DFW', 'san jose': 'SJC', 'austin': 'AUS', 'jacksonville': 'JAX',
      'fort worth': 'FTW', 'columbus': 'CMH', 'charlotte': 'CLT', 'san francisco': 'SF',
      'indianapolis': 'IND', 'seattle': 'SEA', 'denver': 'DEN', 'washington': 'DC',
      'boston': 'BOS', 'el paso': 'ELP', 'nashville': 'BNA', 'detroit': 'DTW',
      'portland': 'PDX', 'memphis': 'MEM', 'oklahoma city': 'OKC', 'las vegas': 'LAS',
      'louisville': 'SDF', 'milwaukee': 'MKE', 'albuquerque': 'ABQ', 'tucson': 'TUS',
      'fresno': 'FAT', 'sacramento': 'SMF', 'kansas city': 'MCI', 'long beach': 'LGB',
      'mesa': 'AZA', 'atlanta': 'ATL', 'omaha': 'OMA', 'miami': 'MIA', 'toronto': 'YYZ',
      'montreal': 'YUL', 'vancouver': 'YVR', 'calgary': 'YYC', 'ottawa': 'YOW',
      'edmonton': 'YEG', 'pittsburgh': 'PIT', 'cincinnati': 'CVG', 'minneapolis': 'MSP'
    };
    
    const normalizedCity = city.toLowerCase().trim();
    return cityAbbreviations[normalizedCity] || normalizedCity.substring(0, 3).toUpperCase();
  }

  /**
   * Get 2-character country abbreviation
   */
  private getCountryAbbreviation(country: string): string {
    const countryAbbreviations: Record<string, string> = {
      'united states': 'US', 'canada': 'CA', 'united kingdom': 'UK', 'australia': 'AU',
      'germany': 'DE', 'france': 'FR', 'italy': 'IT', 'spain': 'ES', 'japan': 'JP',
      'china': 'CN', 'india': 'IN', 'brazil': 'BR', 'mexico': 'MX', 'netherlands': 'NL'
    };
    
    const normalizedCountry = country.toLowerCase().trim();
    return countryAbbreviations[normalizedCountry] || normalizedCountry.substring(0, 2).toUpperCase();
  }

  /**
   * Generate slug from tenant ID (deterministic fallback)
   * Creates a readable slug from tenant ID when no business name is available
   */
  private generateSlugFromTenantId(tenantId: string): string {
    if (!tenantId) return 'unknown';
    
    // Extract meaningful part from tenant ID (remove 'tid-' prefix)
    const cleanId = tenantId.replace(/^tid-/, '');
    
    // Create a readable slug from the ID
    // Mix of letters and numbers to make it readable but unique
    let slug = '';
    for (let i = 0; i < cleanId.length; i++) {
      const char = cleanId[i];
      // Insert hyphens for readability every 4 characters
      if (i > 0 && i % 4 === 0) {
        slug += '-';
      }
      slug += char.toLowerCase();
    }
    
    // Ensure it's a valid slug format
    return slug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'shop';
  }

  /**
   * Generate URLs for a tenant
   * Supports all URL formats used in the platform
   */
  generateUrls(tenantId: string, slug: string, autoId: string): TenantInfo['urls'] {
    return {
      slugUrl: slug ? `/shops/${slug}` : `/shops/${tenantId}`,
      tenantIdUrl: `/shops/${tenantId}`,
      autoIdUrl: `/shops/${autoId}`,
      canonicalUrl: slug ? `/shops/${slug}` : `/shops/${tenantId}`
    };
  }

  /**
   * Generate a 4-character alphanumeric auto ID from tenant ID
   * Uses the same algorithm as the SKU generator for consistency
   */
  public generateTenantAutoId(tenantId: string): string {
    if (!tenantId) return 'UNKN';
    
    // Use a simple hash to create consistent 4-char key from tenant ID
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash = ((hash << 5) - hash) + tenantId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert hash to 4-character alphanumeric key
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (0, O, 1, I)
    let tempHash = Math.abs(hash);
    let key = '';
    for (let i = 0; i < 4; i++) {
      key += chars[tempHash % chars.length];
      tempHash = Math.floor(tempHash / chars.length);
    }
    
    return key;
  }

  /**
   * Parse social links from database format
   * Handles both object and string formats
   */
  private parseSocialLinks(socialLinks: any): TenantInfo['socialLinks'] {
    if (!socialLinks) return {};
    
    // Handle case where social_links might be a JSON string
    if (typeof socialLinks === 'string') {
      try {
        return JSON.parse(socialLinks);
      } catch {
        return {};
      }
    }
    
    return socialLinks;
  }

  /**
   * Resolve tenant by any identifier (slug, tenantId, or autoId)
   * Useful for routing and lookup operations
   */
  async resolveTenantByIdentifier(identifier: string): Promise<{
    tenantId?: string;
    slug?: string;
    autoId?: string;
    found: boolean;
  }> {
    // Try tenantId first (most common)
    if (identifier.startsWith('tid-')) {
      try {
        const tenantInfo = await this.getTenantInfo(identifier);
        return {
          tenantId: tenantInfo.id,
          slug: tenantInfo.slug,
          autoId: tenantInfo.autoId,
          found: true
        };
      } catch {
        return { found: false };
      }
    }

    // Try autoId (4-character alphanumeric)
    if (/^[A-Z0-9]{4}$/.test(identifier)) {
      try {
        // Find tenant by autoId using reverse lookup
        // This would require an index or a more efficient method in production
        const tenants = await basePrisma.tenants.findMany({
          take: 100, // Limit for performance
          select: { id: true, name: true, slug: true }
        });

        for (const tenant of tenants) {
          const generatedAutoId = this.generateTenantAutoId(tenant.id);
          if (generatedAutoId === identifier) {
            const tenantInfo = await this.getTenantInfo(tenant.id);
            return {
              tenantId: tenantInfo.id,
              slug: tenantInfo.slug,
              autoId: tenantInfo.autoId,
              found: true
            };
          }
        }
      } catch {
        // Continue to slug lookup
      }
    }

    // Try slug lookup
    try {
      // Check directory listings first
      const directoryResult = await basePrisma.$queryRaw`
        SELECT tenant_id FROM "directory_listings_list"
        WHERE slug = ${identifier} AND is_published = true
        LIMIT 1
      `;

      if (directoryResult && (directoryResult as any[])[0]) {
        const tenantId = (directoryResult as any[])[0].tenant_id;
        const tenantInfo = await this.getTenantInfo(tenantId);
        return {
          tenantId: tenantInfo.id,
          slug: tenantInfo.slug,
          autoId: tenantInfo.autoId,
          found: true
        };
      }

      // Check tenant table
      const tenantResult = await basePrisma.tenants.findFirst({
        where: { slug: identifier },
        select: { id: true }
      });

      if (tenantResult) {
        const tenantInfo = await this.getTenantInfo(tenantResult.id);
        return {
          tenantId: tenantInfo.id,
          slug: tenantInfo.slug,
          autoId: tenantInfo.autoId,
          found: true
        };
      }

    } catch {
      // Return not found if all lookups fail
    }

    return { found: false };
  }

  /**
   * Get service metrics
   */
  getServiceMetrics() {
    return {
      ...this.getMetrics(),
      serviceName: 'TenantSingletonService',
      description: 'Centralized tenant information provider',
      features: [
        'Tenant information caching',
        'Slug generation and management',
        'AutoId generation',
        'URL generation',
        'Business profile integration',
        'Multi-identifier resolution'
      ]
    };
  }
}

// Export singleton instance
const tenantSingletonService = new TenantSingletonService();
export default tenantSingletonService;
