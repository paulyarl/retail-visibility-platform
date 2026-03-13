/**
 * Permission Service Factory
 * 
 * Provides access to concrete permission services
 * Ensures singleton pattern and proper initialization
 */

import { TenantFeatureService } from './TenantFeatureService';
import { TenantLimitsService } from './TenantLimitsService';

// Singleton instances
let tenantFeatureService: TenantFeatureService | null = null;
let tenantLimitsService: TenantLimitsService | null = null;

/**
 * Permission Service Factory
 * 
 * Provides access to concrete permission services with singleton pattern
 */
export class PermissionServiceFactory {
  
  /**
   * Get tenant feature service
   */
  static getTenantFeatureService(): TenantFeatureService {
    if (!tenantFeatureService) {
      tenantFeatureService = new TenantFeatureService('tenant-feature-service');
    }
    return tenantFeatureService;
  }
  
  /**
   * Get tenant limits service
   */
  static getTenantLimitsService(): TenantLimitsService {
    if (!tenantLimitsService) {
      tenantLimitsService = new TenantLimitsService('tenant-limits-service');
    }
    return tenantLimitsService;
  }
  
  /**
   * Get all tenant permission services
   */
  static getTenantServices() {
    return {
      features: this.getTenantFeatureService(),
      limits: this.getTenantLimitsService()
    };
  }
  
  /**
   * Reset all services (useful for testing or cache invalidation)
   */
  static reset(): void {
    tenantFeatureService = null;
    tenantLimitsService = null;
  }
}

// Export convenience functions for direct access
export const tenantFeatures = () => PermissionServiceFactory.getTenantFeatureService();
export const tenantLimits = () => PermissionServiceFactory.getTenantLimitsService();
