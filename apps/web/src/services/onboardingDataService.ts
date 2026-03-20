import { BusinessProfile, normalizePhoneInput } from '@/lib/validation/businessProfile';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';

/**
 * Service for handling onboarding data operations
 * Centralizes all data fetching, merging, and transformation logic
 */
export class OnboardingDataService {
  /**
   * Fetch and merge all tenant data from multiple sources
   */
  async fetchTenantData(tenantId: string): Promise<Partial<BusinessProfile>> {
    try {
      const mergedData = await platformHomeService.getOnboardingTenantData(tenantId);
      return mergedData;
    } catch (error) {
      console.error('[OnboardingDataService] Failed to fetch tenant data:', error);
      return {};
    }
  }

  /**
   * Merge data from tenant and profile sources
   * Priority: profile > tenant.metadata > tenant.name
   */
  private mergeData(tenant: any, profile: any): Partial<BusinessProfile> {
    const metadata = tenant?.metadata || {};
    
    return {
      business_name: profile?.business_name || metadata.business_name || tenant?.name || '',
      address_line1: profile?.address_line1 || metadata.address_line1 || '',
      address_line2: profile?.address_line2 || metadata.address_line2 || '',
      city: profile?.city || metadata.city || '',
      state: profile?.state || metadata.state || '',
      postal_code: profile?.postal_code || metadata.postal_code || '',
      country_code: profile?.country_code || metadata.country_code || '',
      phone_number: normalizePhoneInput(
        profile?.phone_number || profile?.phone || metadata.phone_number || metadata.phone || ''
      ),
      email: profile?.email || metadata.email || '',
      website: profile?.website || metadata.website || '',
      contact_person: profile?.contact_person || metadata.contact_person || '',
    };
  }

  /**
   * Sanitize data - treat whitespace-only strings as empty
   */
  sanitizeData(data: Partial<BusinessProfile>): Partial<BusinessProfile> {
    const sanitized: Partial<BusinessProfile> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.trim() === '') {
        sanitized[key as keyof BusinessProfile] = '' as any;
      } else {
        sanitized[key as keyof BusinessProfile] = value as any;
      }
    }
    
    return sanitized;
  }

  /**
   * Normalize data with defaults
   */
  normalizeData(data: Partial<BusinessProfile>): Partial<BusinessProfile> {
    return {
      business_name: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country_code: 'US',
      phone_number: '',
      email: '',
      website: '',
      contact_person: '',
      slug: '',
      logo_url: '',
      business_description: '',
      hours: null,
      social_links: {},
      seo_tags: [],
      latitude: null,
      longitude: null,
      admin_email: '',
      ...data,
    };
  }

  /**
   * Save business profile
   */
  async saveProfile(tenantId: string, data: Partial<BusinessProfile>): Promise<Partial<BusinessProfile>> {
    try {
      const result = await platformHomeService.saveOnboardingProfile(tenantId, data);
      return result as Partial<BusinessProfile>;
    } catch (error) {
      // Error will be caught and displayed in UI
      throw error;
    }
  }
}

// Export singleton instance
export const onboardingDataService = new OnboardingDataService();
