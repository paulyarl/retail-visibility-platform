/**
 * Trial Service
 * 
 * Handles trial activation and management for tenants
 * Uses TenantApiSingleton for proper API routing and caching
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import type { TenantRequestOptions } from '@/providers/base/EnhancedFlexibleApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface TrialStatus {
  hasActiveTrial: boolean;
  trialTier?: string;
  trialEndsAt?: string;
  subscriptionStatus?: string;
  canStartTrial: boolean;
}

export interface TrialActivationRequest {
  trialTier: 'trial_google_only' | 'trial_starter' | 'trial_professional' | 'trial_chain_starter'| 'trial_discovery'| 'trial_commitment'| 'trial_storefront';
  paymentMethodId?: string;
}

export interface TrialActivationResponse {
  success: boolean;
  tenant: {
    id: string;
    subscriptionTier: string;
    subscriptionStatus: string;
    trialEndsAt: string;
  };
  message: string;
}

export class TrialService extends TenantApiSingleton {
  private static instance: TrialService;

  constructor() {
    super('TrialService');
  }

  static getInstance(): TrialService {
    if (!TrialService.instance) {
      TrialService.instance = new TrialService();
    }
    return TrialService.instance;
  }

  /**
   * Cache patterns for trial service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'trial-status:*',
      'trial-activation:*',
      'trial-eligibility:*'
    ];
  }

  /**
   * Cache invalidation for trial service
   */
  public async invalidateServiceCaches(tenantId?: string, ...params: any[]): Promise<void> {
    const patterns = this.getServiceCachePatterns();
    
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // Invalidate all matching cache keys
        await this.invalidateCachePattern(pattern.replace('*', tenantId || ''));
      } else {
        // Invalidate specific cache key
        await this.invalidateCache(pattern);
      }
    }
  }

  /**
   * Get trial status for a tenant
   */
  async getTrialStatus(tenantId: string): Promise<TrialStatus> {
    const cacheKey = `trial-status:${tenantId}`;
    
    const response = await this.makeWebRequest<TrialStatus>(
      `/api/tenants/${tenantId}/trial-setup`,
      {
        method: 'GET',
      },
      cacheKey,
      5 * 60 * 1000 // 5 minutes
    );
    
    return response.data;
  }

  /**
   * Activate trial for a tenant
   */
  async activateTrial(tenantId: string, request: TrialActivationRequest): Promise<TrialActivationResponse> {
    const cacheKey = `trial-activation:${tenantId}`;
    
    const response = await this.makeWebRequest<TrialActivationResponse>(
      `/api/tenants/${tenantId}/trial-setup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      },
      cacheKey,
      0 // No cache for mutations
    );

    // Invalidate trial status cache after activation
    await this.invalidateServiceCaches(tenantId);
    
    return response.data;
  }

  /**
   * Check if tenant can start trial
   */
  async canStartTrial(tenantId: string): Promise<boolean> {
    try {
      const status = await this.getTrialStatus(tenantId);
      return status.canStartTrial;
    } catch (error) {
      clientLogger.error('[TrialService] Failed to check trial eligibility:', { detail: error });
      return true; // Default to allowing trial if check fails
    }
  }
}

// Export singleton instance
export const trialService = TrialService.getInstance();
