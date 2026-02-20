/**
 * Request Flow Example - Clarifying defaultRequestType Usage
 * 
 * Shows how defaultRequestType fits into the request flow
 * and when to use explicit vs default request methods
 */

import { FlexibleApiSingleton, RequestType, SingletonCacheOptions } from '@/providers/base/FlexibleApiSingleton';

export interface TenantData {
  id: string;
  name: string;
  analytics: any;
}

export interface PlatformData {
  totalTenants: number;
  systemStatus: string;
}

/**
 * Admin Service Example showing complete request flow
 */
class AdminServiceExample extends FlexibleApiSingleton {
  private static instance: AdminServiceExample;
  
  // STEP 1: Define default request type for this service
  protected defaultRequestType: RequestType.ADMIN = RequestType.ADMIN;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 5 * 60 * 1000, // 5 minutes cache
      ...cacheOptions
    });
  }

  static getInstance(): AdminServiceExample {
    if (!AdminServiceExample.instance) {
      AdminServiceExample.instance = new AdminServiceExample('admin-service-example');
    }
    return AdminServiceExample.instance;
  }

  // ====================
  // FLOW 1: USING DEFAULT REQUEST TYPE
  // ====================

  /**
   * Uses defaultRequestType automatically via makeDefaultRequest()
   * This is the "standard" flow for most operations
   */
  async getPlatformStats(): Promise<PlatformData | null> {
    console.log('🔄 Using defaultRequestType:', this.defaultRequestType);
    
    try {
      // makeDefaultRequest() internally calls makeAdminRequest()
      // because defaultRequestType = RequestType.ADMIN
      const response = await this.makeDefaultRequest<PlatformData>(
        '/api/admin/platform/stats',
        {},
        'platform-stats',
        this.cacheTTL
      );

      console.log('✅ Default request completed with admin privileges');
      return response.data || null;
    } catch (error) {
      console.error('❌ Default request failed:', error);
      return null;
    }
  }

  /**
   * Explicitly using the default method type
   * Same result as above, but more explicit
   */
  async getPlatformStatsExplicit(): Promise<PlatformData | null> {
    console.log('🔄 Explicitly using admin request (same as default)');
    
    try {
      // Explicitly calling makeAdminRequest()
      // Same result as makeDefaultRequest() in this case
      const response = await this.makeAdminRequest<PlatformData>(
        '/api/admin/platform/stats',
        {},
        'platform-stats',
        this.cacheTTL,
        { requireAdminContext: true, validateAdminAccess: true }
      );

      console.log('✅ Explicit admin request completed');
      return response.data || null;
    } catch (error) {
      console.error('❌ Explicit admin request failed:', error);
      return null;
    }
  }

  // ====================
  // FLOW 2: OVERRIDING DEFAULT REQUEST TYPE
  // ====================

  /**
   * This is the key example - admin service using tenant request
   * defaultRequestType is IGNORED here because we explicitly call makeTenantRequest()
   */
  async getTenantAnalyticsAsAdmin(tenantId: string): Promise<TenantData | null> {
    console.log('🔄 Overriding defaultRequestType:', this.defaultRequestType, '→ using TENANT');
    
    try {
      // ❌ NOT using defaultRequestType
      // ✅ EXPLICITLY using makeTenantRequest() for this specific operation
      const response = await this.makeTenantRequest<TenantData>(
        `/api/tenant/${tenantId}/analytics`,
        {},
        `tenant-analytics-${tenantId}`,
        this.cacheTTL,
        {
          requireTenantContext: true,
          validateTenantAccess: false, // Admin bypasses tenant validation
          tenantId: tenantId
        }
      );

      console.log('✅ Tenant request completed with admin bypass');
      return response.data || null;
    } catch (error) {
      console.error('❌ Tenant request failed:', error);
      return null;
    }
  }

  /**
   * Another override example - admin service using public request
   */
  async getPublicConfig(): Promise<any> {
    console.log('🔄 Overriding defaultRequestType:', this.defaultRequestType, '→ using PUBLIC');
    
    try {
      // Explicitly using makePublicRequest()
      const response = await this.makePublicRequest<any>(
        '/api/public/config',
        {},
        'public-config',
        this.cacheTTL
      );

      console.log('✅ Public request completed');
      return response.data;
    } catch (error) {
      console.error('❌ Public request failed:', error);
      return null;
    }
  }

  // ====================
  // FLOW 3: MIXED SECURITY OPERATIONS
  // ====================

  /**
   * Complex operation using multiple request types
   * Shows how defaultRequestType fits into mixed operations
   */
  async generateHybridReport(tenantId: string): Promise<any> {
    console.log('🔄 Mixed security operation - using multiple request types');
    
    try {
      // Step 1: Use default (admin) for platform data
      console.log('  📊 Step 1: Using defaultRequestType (ADMIN)');
      const platformStats = await this.makeDefaultRequest<PlatformData>(
        '/api/admin/platform/stats',
        {},
        'platform-stats',
        this.cacheTTL
      );

      // Step 2: Override to tenant for tenant-specific data
      console.log('  📊 Step 2: Overriding to TENANT request');
      const tenantData = await this.makeTenantRequest<TenantData>(
        `/api/tenant/${tenantId}/analytics`,
        {},
        `tenant-analytics-${tenantId}`,
        this.cacheTTL,
        { requireTenantContext: true, validateTenantAccess: false, tenantId }
      );

      // Step 3: Override to public for public configuration
      console.log('  📊 Step 3: Overriding to PUBLIC request');
      const publicConfig = await this.makePublicRequest<any>(
        '/api/public/config',
        {},
        'public-config',
        this.cacheTTL
      );

      return {
        platform: platformStats.data,
        tenant: tenantData.data,
        config: publicConfig.data,
        requestFlow: {
          step1: 'defaultRequestType (ADMIN)',
          step2: 'explicit TENANT request',
          step3: 'explicit PUBLIC request'
        },
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Hybrid report generation failed:', error);
      throw error;
    }
  }

  // ====================
  // FLOW 4: CONDITIONAL REQUEST TYPE SELECTION
  // ====================

  /**
   * Dynamic request type selection based on context
   * Shows advanced usage of defaultRequestType concept
   */
  async getDataWithContext(
    dataType: 'platform' | 'tenant' | 'public',
    tenantId?: string
  ): Promise<any> {
    console.log('🔄 Dynamic request type selection');
    
    try {
      switch (dataType) {
        case 'platform':
          // Use default (admin) for platform data
          console.log('  📊 Using defaultRequestType (ADMIN) for platform data');
          return await this.makeDefaultRequest<any>('/api/admin/platform/data');
          
        case 'tenant':
          // Override to tenant for tenant data
          console.log('  📊 Overriding to TENANT for tenant data');
          return await this.makeTenantRequest<any>(
            `/api/tenant/${tenantId}/data`,
            {},
            undefined,
            undefined,
            { requireTenantContext: true, validateTenantAccess: false, tenantId }
          );
          
        case 'public':
          // Override to public for public data
          console.log('  📊 Overriding to PUBLIC for public data');
          return await this.makePublicRequest<any>('/api/public/data');
          
        default:
          throw new Error(`Unknown data type: ${dataType}`);
      }
    } catch (error) {
      console.error('❌ Context-based data retrieval failed:', error);
      throw error;
    }
  }
}

/**
 * DEMONSTRATION OF REQUEST FLOW
 */
export async function demonstrateRequestFlow() {
  const adminService = AdminServiceExample.getInstance();

  console.log('🚀 Starting Request Flow Demonstration\n');

  // Flow 1: Using default request type
  console.log('=== FLOW 1: Using defaultRequestType ===');
  await adminService.getPlatformStats();
  console.log('');

  // Flow 2: Overriding default request type
  console.log('=== FLOW 2: Overriding defaultRequestType ===');
  await adminService.getTenantAnalyticsAsAdmin('tenant-123');
  console.log('');

  // Flow 3: Mixed security operations
  console.log('=== FLOW 3: Mixed Security Operations ===');
  await adminService.generateHybridReport('tenant-123');
  console.log('');

  // Flow 4: Conditional request type selection
  console.log('=== FLOW 4: Conditional Request Type Selection ===');
  await adminService.getDataWithContext('platform');
  await adminService.getDataWithContext('tenant', 'tenant-123');
  await adminService.getDataWithContext('public');
  console.log('');

  console.log('✅ Request Flow Demonstration Complete');
}

export const adminServiceExample = AdminServiceExample.getInstance();
