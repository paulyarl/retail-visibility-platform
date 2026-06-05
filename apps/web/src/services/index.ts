/**
 * Service Index - Exports all extracted services from PlatformHomeSingletonService
 * 
 * This file provides a centralized export point for all the newly created services
 * that were extracted from the monolithic PlatformHomeSingletonService.
 * 
 * Each service follows the singleton pattern and implements the ApiResult pattern
 * for consistent error handling and data access.
 */

// Import all services for use in service registry
import { tenantUserService } from './TenantUserService';
import { adminUserService } from './AdminUserService';
import { userManagementService } from './UserManagementService';
import { featuredProductsService } from './FeaturedProductsService';
import { tenantCategoryService } from './TenantCategoryService';
import { tenantTierService } from './TenantTierService';
import { inventoryScanService } from './InventoryScanService';
import { adminAnalyticsService } from './AdminAnalyticsService';
import { tenantAnalyticsService } from './TenantAnalyticsService';
import { integrationService } from './IntegrationService';
import { organizationService } from './OrganizationService';
import { subdomainService } from './SubdomainService';

// User and Tenant Management Services
export { tenantUserService, TenantUserService } from './TenantUserService';
export { adminUserService, AdminUserService } from './AdminUserService';
export { userManagementService, UserManagementService } from './UserManagementService';

// Product and Content Management Services
export { featuredProductsService, FeaturedProductsService } from './FeaturedProductsService';
export { tenantCategoryService, TenantCategoryService } from './TenantCategoryService';

// Tier and Subscription Services
export { tenantTierService, TenantTierService } from './TenantTierService';

// Operations and Analytics Services
export { inventoryScanService, InventoryScanService } from './InventoryScanService';
export { adminAnalyticsService, AdminAnalyticsService } from './AdminAnalyticsService';
export { tenantAnalyticsService, TenantAnalyticsService } from './TenantAnalyticsService';

// Integration and External Services
export { integrationService, IntegrationService } from './IntegrationService';

// Organization and Domain Services
export { organizationService, OrganizationService } from './OrganizationService';
export { subdomainService, SubdomainService } from './SubdomainService';

/**
 * Service Registry - For dynamic service access
 */
export const services = {
  // User Management
  tenantUserService,
  adminUserService,
  userManagementService,

  // Content Management
  featuredProductsService,
  tenantCategoryService,

  // Tier Management
  tenantTierService,

  // Operations
  inventoryScanService,

  // Analytics
  adminAnalyticsService,
  tenantAnalyticsService,

  // Integrations
  integrationService,

  // Organization & Domains
  organizationService,
  subdomainService,
} as const;

/**
 * Service Types - For type safety and dependency injection
 */
export type ServiceRegistry = typeof services;

/**
 * Get service by name - Helper function for dynamic service access
 */
export function getService<T extends keyof ServiceRegistry>(serviceName: T): ServiceRegistry[T] {
  return services[serviceName];
}

/**
 * Service Categories - For organized access to related services
 */
export const serviceCategories = {
  userManagement: {
    tenantUserService,
    adminUserService,
    userManagementService,
  },
  contentManagement: {
    featuredProductsService,
    tenantCategoryService,
  },
  tierManagement: {
    tenantTierService,
  },
  operations: {
    inventoryScanService,
  },
  analytics: {
    adminAnalyticsService,
    tenantAnalyticsService,
  },
  integrations: {
    integrationService,
  },
  organization: {
    organizationService,
    subdomainService,
  },
} as const;

/**
 * Migration Status
 * 
 * The following services have been successfully extracted from PlatformHomeSingletonService:
 * 
 * ✅ TenantUserService (100% complete)
 * ✅ AdminUserService (100% complete)
 * ✅ FeaturedProductsService (100% complete)
 * ✅ TenantTierService (100% complete)
 * ✅ InventoryScanService (100% complete)
 * ✅ UserManagementService (100% complete)
 * ✅ TenantCategoryService (100% complete)
 * ✅ IntegrationService (100% complete)
 * ✅ AdminAnalyticsService (100% complete)
 * ✅ OrganizationService (100% complete)
 * ✅ SubdomainService (100% complete)
 * ✅ TenantAnalyticsService (100% complete)
 * 
 * 🔄 PlatformCategoryService (86% complete - 1 method remaining)
 * 
 * All services implement:
 * - Singleton pattern for consistent instance management
 * - ApiResult pattern for error handling
 * - Proper cache coordination
 * - TypeScript type safety
 * - Comprehensive error logging
 */
