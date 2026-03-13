/**
 * Permission Services Index
 * 
 * Exports all permission services following the platform singleton hierarchy:
 * - BasePermissionService (Layer 3: Base Permission Layer)
 * - TenantPermissionContext (Layer 4: Context Permission Layer)
 * - AdminPermissionContext (Layer 4: Context Permission Layer)
 * - PublicPermissionContext (Layer 4: Context Permission Layer)
 * - TenantFeatureService (Layer 5: Extended Context Layer)
 * - TenantLimitsService (Layer 5: Extended Context Layer)
 * - PermissionServiceFactory (Layer 4: Service Factory Layer)
 */

// Base Permission Service
export { 
  BasePermissionService,
  PermissionResult,
  FeaturePermission,
  LimitPermission,
  AccessPermission,
  PermissionCacheEntry,
  PermissionCheckOptions as BasePermissionCheckOptions
} from './BasePermissionService';

// Tenant Permission Context
export {
  tenantPermissionContext,
  TierFeatures,
  TierLimits,
  TenantPermissions
} from './TenantPermissionContext';

// Admin Permission Context
export {
  adminPermissionContext,
  AdminRole,
  AdminFeatures,
  AdminPermissions
} from './AdminPermissionContext';

// Public Permission Context
export {
  publicPermissionContext,
  PublicFeatures,
  PublicRateLimits,
  PublicPermissions
} from './PublicPermissionContext';

// Tenant Feature Service
export {
  tenantFeatureService,
  FeatureDefinition,
  FeatureToggle,
  FeatureUsageStats
} from './TenantFeatureService';

// Tenant Limits Service
export {
  tenantLimitsService,
  LimitDefinition,
  LimitStatus,
  UsageRecord
} from './TenantLimitsService';

// Permission Service Factory
export {
  permissionServiceFactory,
  PermissionContext,
  PermissionServices
} from './PermissionServiceFactory';

// Permission Middleware
export {
  requireFeature,
  requireLimit,
  requireAccess,
  requireAdmin,
  requirePlatformAdmin,
  requireTenantManagement,
  requirePermissions,
  withPermissions,
  PermissionMiddlewareOptions
} from './PermissionMiddleware';

// Organization Permission Context
export {
  organizationPermissionContext,
  OrganizationRole,
  OrganizationFeatures,
  OrganizationPermissions,
  OrganizationMember
} from './OrganizationPermissionContext';

// Permission Decorators
export {
  RequireFeature,
  RequireLimit,
  RequireRole,
  RequireAccess,
  RequireOrgRole,
  RequirePermissions,
  CachedPermission,
  PermissionError
} from './PermissionDecorators';

// Permission-Aware Services
export {
  permissionAwareProductService,
  PermissionAwareProductService,
  CreateProductInput,
  UpdateProductInput,
  BulkOperationResult
} from './PermissionAwareProductService';

export {
  permissionAwareLocationService,
  PermissionAwareLocationService,
  CreateLocationInput,
  UpdateLocationInput,
  LocationResult
} from './PermissionAwareLocationService';

export {
  permissionAwareAnalyticsService,
  PermissionAwareAnalyticsService,
  ReportType,
  ExportFormat,
  DateRange,
  AnalyticsResult,
  ExportResult
} from './PermissionAwareAnalyticsService';

// Permission-Enhanced Base Service
export {
  PermissionEnhancedBaseService,
  PermissionCheckOptions,
  PermissionCheckResult
} from './PermissionEnhancedBaseService';

// Permission-Protected Repository
export {
  PermissionProtectedRepository,
  RepositoryOperation,
  RepositoryContext,
  EnforcementOptions
} from './PermissionProtectedRepository';

// Controller Authorization
export {
  ControllerAuthorization,
  AuthorizationContext,
  AuthorizationOptions,
  AuthorizationResult,
  authorize,
  requireFeature as controllerRequireFeature,
  requireLimit as controllerRequireLimit,
  requireAccess as controllerRequireAccess
} from './ControllerAuthorization';

// Override Service
export {
  overrideService,
  GrantOverrideInput,
  BulkGrantOverrideInput,
  OverrideRecord,
  OverrideFilter,
  OverrideHistoryRecord
} from './OverrideService';
