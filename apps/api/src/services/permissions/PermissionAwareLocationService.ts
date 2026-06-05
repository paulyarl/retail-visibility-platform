/**
 * Permission-Aware Location Service
 * 
 * Demonstrates Phase 3 integration pattern for location management:
 * - Location creation limit enforcement
 * - Multi-location management permissions
 * - Geographic restriction permissions
 */

import { 
  RequireFeature, 
  RequireLimit, 
  RequireAccess,
  PermissionError 
} from './PermissionDecorators';
import { permissionServiceFactory } from './PermissionServiceFactory';

// Location creation input
export interface CreateLocationInput {
  tenantId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isPrimary?: boolean;
}

// Location update input
export interface UpdateLocationInput {
  locationId: string;
  tenantId: string;
  name?: string;
  address?: string;
  isPrimary?: boolean;
}

// Location result
export interface LocationResult {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Permission-Aware Location Service
 * 
 * Extends existing service patterns with permission integration
 */
export class PermissionAwareLocationService {
  private static instance: PermissionAwareLocationService;

  private constructor() {}

  static getInstance(): PermissionAwareLocationService {
    if (!PermissionAwareLocationService.instance) {
      PermissionAwareLocationService.instance = new PermissionAwareLocationService();
    }
    return PermissionAwareLocationService.instance;
  }

  // ==========================================
  // Location Creation with Limit Enforcement
  // ==========================================

  /**
   * Create a location with limit check
   */
  @RequireLimit({ limitType: 'locations', required: 1, consume: true })
  async createLocation(input: CreateLocationInput): Promise<LocationResult> {
    console.log(`[PermissionAwareLocationService] Creating location for tenant: ${input.tenantId}`);
    
    return {
      id: `location-${Date.now()}`,
      tenantId: input.tenantId,
      name: input.name,
      address: input.address,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      country: input.country,
      isPrimary: input.isPrimary ?? false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Create multiple locations with bulk limit check
   */
  @RequireFeature({ feature: 'bulkOperations' })
  async createLocationsBulk(tenantId: string, locations: CreateLocationInput[]): Promise<{
    success: number;
    failed: number;
    errors: Array<{ index: number; error: string }>;
  }> {
    const canCreate = !(await permissionServiceFactory.wouldExceedLimit(
      tenantId, 
      'locations', 
      locations.length
    ));

    if (!canCreate) {
      throw new PermissionError(
        `Insufficient location limit for bulk operation`,
        'LIMIT_EXCEEDED',
        { requested: locations.length }
      );
    }

    const results = { success: 0, failed: 0, errors: [] as Array<{ index: number; error: string }> };

    for (let i = 0; i < locations.length; i++) {
      try {
        await this.createLocation(locations[i]);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  // ==========================================
  // Location Management
  // ==========================================

  /**
   * Update location with access control
   */
  @RequireAccess({ resource: 'locations', action: 'update' })
  async updateLocation(input: UpdateLocationInput): Promise<LocationResult> {
    console.log(`[PermissionAwareLocationService] Updating location: ${input.locationId}`);
    
    return {
      id: input.locationId,
      tenantId: input.tenantId,
      name: input.name ?? 'Updated Location',
      address: input.address ?? 'Updated Address',
      city: 'City',
      state: 'State',
      zipCode: '00000',
      country: 'US',
      isPrimary: input.isPrimary ?? false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Delete location with access control
   */
  @RequireAccess({ resource: 'locations', action: 'delete' })
  async deleteLocation(tenantId: string, locationId: string): Promise<{ success: boolean }> {
    const limitsService = permissionServiceFactory.getLimitsService();
    await limitsService.trackUsage(tenantId, 'locations', -1);
    
    console.log(`[PermissionAwareLocationService] Deleting location: ${locationId}`);
    return { success: true };
  }

  /**
   * Set primary location
   */
  @RequireAccess({ resource: 'locations', action: 'update' })
  async setPrimaryLocation(tenantId: string, locationId: string): Promise<{ success: boolean }> {
    console.log(`[PermissionAwareLocationService] Setting primary location: ${locationId}`);
    return { success: true };
  }

  // ==========================================
  // Convenience Methods
  // ==========================================

  /**
   * Check if tenant can add more locations
   */
  async canAddLocations(tenantId: string, count: number = 1): Promise<boolean> {
    return !(await permissionServiceFactory.wouldExceedLimit(tenantId, 'locations', count));
  }

  /**
   * Get location limit status
   */
  async getLocationLimitStatus(tenantId: string) {
    return await permissionServiceFactory.getLimitStatus(tenantId, 'locations');
  }

  /**
   * Get remaining locations
   */
  async getRemainingLocations(tenantId: string): Promise<number> {
    const status = await this.getLocationLimitStatus(tenantId);
    return status.remaining;
  }
}

// Export singleton instance
export const permissionAwareLocationService = PermissionAwareLocationService.getInstance();
export default PermissionAwareLocationService;
