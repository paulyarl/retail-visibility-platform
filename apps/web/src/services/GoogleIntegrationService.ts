/**
 * Google Integration Service
 * 
 * Handles Google OAuth and GBP (Google Business Profile) operations
 * Uses AuthenticatedApiSingleton for authenticated Google operations
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';

export interface GoogleCategory {
  id: string;
  name: string;
  displayName?: string;
}

export interface GoogleAuthStatus {
  isConnected: boolean;
  email?: string;
  businessName?: string;
  lastSyncAt?: string;
  error?: string;
}

export interface GoogleAuthUrl {
  authUrl: string;
  state: string;
}

class GoogleIntegrationService extends AuthenticatedApiSingleton {
  private static instance: GoogleIntegrationService;

  private constructor() {
    super('google-integration-service', {
      ttl: 15 * 60 * 1000 // 15 minutes for Google data
    });
  }

  public static getInstance(): GoogleIntegrationService {
    if (!GoogleIntegrationService.instance) {
      GoogleIntegrationService.instance = new GoogleIntegrationService();
    }
    return GoogleIntegrationService.instance;
  }

  /**
   * Search Google Business Profile categories
   */
  async getCategories(query: string, limit: number = 20, tenantId: string): Promise<GoogleCategory[]> {
    try {
      const result = await this.makeDefaultRequest<{ categories: GoogleCategory[] }>(
        `/api/gbp/categories?query=${encodeURIComponent(query)}&limit=${limit}&tenantId=${encodeURIComponent(tenantId)}`,
        {},
        `gbp-categories-${query}-${limit}`
      );
      
      return result.data?.categories || [];
    } catch (error) {
      console.error('[GoogleIntegrationService] Failed to get categories:', error);
      return [];
    }
  }

  /**
   * Get popular Google Business Profile categories
   */
  async getPopularCategories(limit: number = 10, tenantId: string): Promise<GoogleCategory[]> {
    try {
      const result = await this.makeDefaultRequest<{ categories: GoogleCategory[] }>(
        `/api/gbp/categories/popular?limit=${limit}&tenantId=${encodeURIComponent(tenantId)}`,
        {},
        `gbp-popular-categories-${limit}`
      );
      
      return result.data?.categories || [];
    } catch (error) {
      console.error('[GoogleIntegrationService] Failed to get popular categories:', error);
      return [];
    }
  }

  /**
   * Get Google OAuth authorization URL
   */
  async getAuthUrl(tenantId: string): Promise<GoogleAuthUrl> {
    try {
      const result = await this.makeDefaultRequest<GoogleAuthUrl>(
        `/api/google/auth?tenantId=${tenantId}`,
        {},
        `google-auth-${tenantId}`
      );
      
      if (!result.success || !result.data) {
        throw new Error('Failed to get Google auth URL');
      }
      
      return result.data;
    } catch (error) {
      console.error('[GoogleIntegrationService] Failed to get auth URL:', error);
      throw new Error('Failed to get Google authorization URL');
    }
  }

  /**
   * Disconnect Google integration
   */
  async disconnect(tenantId: string): Promise<void> {
    try {
      const result = await this.makeDefaultRequest<void>(
        `/api/google/disconnect?tenantId=${tenantId}`,
        { method: 'DELETE' },
        `google-disconnect-${tenantId}`
      );
      
      if (!result.success) {
        throw new Error('Failed to disconnect Google integration');
      }
      
      console.log(`[GoogleIntegrationService] Disconnected Google for tenant ${tenantId}`);
    } catch (error) {
      console.error('[GoogleIntegrationService] Failed to disconnect:', error);
      throw new Error('Failed to disconnect Google integration');
    }
  }

  /**
   * Get Google connection status
   */
  async getStatus(tenantId: string): Promise<GoogleAuthStatus> {
    try {
      const result = await this.makeDefaultRequest<GoogleAuthStatus>(
        `/api/google/status?tenantId=${tenantId}`,
        {},
        `google-status-${tenantId}`
      );
      
      return result.data || { isConnected: false };
    } catch (error) {
      console.error('[GoogleIntegrationService] Failed to get status:', error);
      return { isConnected: false, error: 'Failed to get connection status' };
    }
  }

  /**
   * Sync Google Business Profile data
   */
  async syncBusinessProfile(tenantId: string): Promise<void> {
    try {
      const result = await this.makeDefaultRequest<void>(
        `/api/gbp/sync?tenantId=${tenantId}`,
        { method: 'POST' },
        `gbp-sync-${tenantId}`
      );
      
      if (!result.success) {
        throw new Error('Failed to sync business profile');
      }
      
      console.log(`[GoogleIntegrationService] Synced business profile for tenant ${tenantId}`);
    } catch (error) {
      console.error('[GoogleIntegrationService] Failed to sync business profile:', error);
      throw new Error('Failed to sync Google Business Profile');
    }
  }

  /**
   * Get Google Business Profile insights
   */
  async getInsights(tenantId: string, dateRange?: { start: string; end: string }): Promise<any> {
    try {
      const queryParams = new URLSearchParams({ tenantId });
      if (dateRange) {
        queryParams.append('start', dateRange.start);
        queryParams.append('end', dateRange.end);
      }
      
      const result = await this.makeDefaultRequest<any>(
        `/api/gbp/insights?${queryParams.toString()}`,
        {},
        `gbp-insights-${tenantId}-${dateRange?.start || 'default'}`
      );
      
      return result.data || null;
    } catch (error) {
      console.error('[GoogleIntegrationService] Failed to get insights:', error);
      return null;
    }
  }

  /**
   * Update Google Business Profile information
   */
  async updateBusinessProfile(tenantId: string, profileData: any): Promise<void> {
    try {
      const result = await this.makeDefaultRequest<void>(
        `/api/gbp/profile?tenantId=${tenantId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(profileData)
        },
        `gbp-update-${tenantId}`
      );
      
      if (!result.success) {
        throw new Error('Failed to update business profile');
      }
      
      console.log(`[GoogleIntegrationService] Updated business profile for tenant ${tenantId}`);
    } catch (error) {
      console.error('[GoogleIntegrationService] Failed to update business profile:', error);
      throw new Error('Failed to update Google Business Profile');
    }
  }

  /**
   * Get Google Business Profile reviews
   */
  async getReviews(tenantId: string, limit: number = 50): Promise<any[]> {
    try {
      const result = await this.makeDefaultRequest<{ reviews: any[] }>(
        `/api/gbp/reviews?tenantId=${tenantId}&limit=${limit}`,
        {},
        `gbp-reviews-${tenantId}`
      );
      
      return result.data?.reviews || [];
    } catch (error) {
      console.error('[GoogleIntegrationService] Failed to get reviews:', error);
      return [];
    }
  }

  /**
   * Respond to Google Business Profile review
   */
  async respondToReview(tenantId: string, reviewId: string, response: string): Promise<void> {
    try {
      const result = await this.makeDefaultRequest<void>(
        `/api/gbp/reviews/${reviewId}/respond?tenantId=${tenantId}`,
        {
          method: 'POST',
          body: JSON.stringify({ response })
        },
        `gbp-respond-${reviewId}`
      );
      
      if (!result.success) {
        throw new Error('Failed to respond to review');
      }
      
      console.log(`[GoogleIntegrationService] Responded to review ${reviewId}`);
    } catch (error) {
      console.error('[GoogleIntegrationService] Failed to respond to review:', error);
      throw new Error('Failed to respond to Google review');
    }
  }
}

// Export the singleton instance
export const googleIntegrationService = GoogleIntegrationService.getInstance();
