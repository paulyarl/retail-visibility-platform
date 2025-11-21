import { BusinessProfile, normalizePhoneInput } from '@/lib/validation/businessProfile';
import { api } from '@/lib/api';

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
      const [tenant, profile] = await Promise.all([
        this.fetchTenant(tenantId),
        this.fetchProfile(tenantId),
      ]);

      return this.mergeData(tenant, profile);
    } catch (error) {
      console.error('[OnboardingDataService] Failed to fetch tenant data:', error);
      return {};
    }
  }

  /**
   * Fetch tenant basic info
   */
  private async fetchTenant(tenantId: string): Promise<any> {
    try {
      const response = await api.get(`/api/tenants/${tenantId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('[OnboardingDataService] Failed to fetch tenant:', error);
    }
    return null;
  }

  /**
   * Fetch tenant profile
   */
  private async fetchProfile(tenantId: string): Promise<any> {
    try {
      const response = await api.get(`/api/tenant/profile?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        return data?.data || data || null;
      }
    } catch (error) {
      console.error('[OnboardingDataService] Failed to fetch profile:', error);
    }
    return null;
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
      ...data,
    };
  }

  /**
   * Save business profile
   */
  async saveProfile(tenantId: string, data: Partial<BusinessProfile>): Promise<void> {
    const response = await api.post('/api/tenant/profile', {
      tenantId: tenantId,
      ...data,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error || 'Failed to save business profile');
    }
  }
}

// Export singleton instance
export const onboardingDataService = new OnboardingDataService();
