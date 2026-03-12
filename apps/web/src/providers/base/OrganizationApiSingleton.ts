/**
 * OrganizationApiSingleton - Next-Level Platform Security Validation
 * 
 * Features:
 * - Smart defaults for makeDefaultRequest
 * - Authorization groups (IS_/CAN_ patterns)
 * - Platform authority bypass mechanisms
 * - Contextual validation
 * - Backward compatibility with TenantApiSingleton
 */

import { RequestTarget, RequestType } from './EnhancedFlexibleApiSingleton';
import { TenantApiSingleton } from './TenantApiSingleton';

// Platform role hierarchy
export enum PlatformRole {
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  OWNER = 'OWNER',
  TENANT_ADMIN = 'TENANT_ADMIN',
  PLATFORM_SUPPORT = 'PLATFORM_SUPPORT',
  USER = 'USER',
  ANONYMOUS = 'ANONYMOUS'
}

// Authorization group patterns
export enum AuthorizationGroup {
  // IS_ patterns (Identity/Role-based)
  IS_PLATFORM_ADMIN = 'IS_PLATFORM_ADMIN',
  IS_PLATFORM_SUPPORT = 'IS_PLATFORM_SUPPORT', 
  IS_ORGANIZATION_OWNER = 'IS_ORGANIZATION_OWNER',
  IS_ORGANIZATION_ADMIN = 'IS_ORGANIZATION_ADMIN',
  IS_TENANT_MEMBER = 'IS_TENANT_MEMBER',
  
  // CAN_ patterns (Capability-based)
  CAN_VIEW_ORGANIZATION = 'CAN_VIEW_ORGANIZATION',
  CAN_MANAGE_ORGANIZATION = 'CAN_MANAGE_ORGANIZATION',
  CAN_PROPAGATE_ITEMS = 'CAN_PROPAGATE_ITEMS',
  CAN_MANAGE_MEMBERS = 'CAN_MANAGE_MEMBERS',
  CAN_TRANSFER_OWNERSHIP = 'CAN_TRANSFER_OWNERSHIP',
  CAN_DELETE_ORGANIZATION = 'CAN_DELETE_ORGANIZATION',
  CAN_SUPPORT_TENANTS = 'CAN_SUPPORT_TENANTS',
  CAN_TROUBLESHOOT = 'CAN_TROUBLESHOOT'
}

// Authorization group mapping to platform roles
const AUTHORIZATION_GROUPS = {
  // IS_ groups (Identity)
  [AuthorizationGroup.IS_PLATFORM_ADMIN]: [PlatformRole.PLATFORM_ADMIN],
  [AuthorizationGroup.IS_PLATFORM_SUPPORT]: [PlatformRole.PLATFORM_SUPPORT],
  [AuthorizationGroup.IS_ORGANIZATION_OWNER]: [PlatformRole.OWNER],
  [AuthorizationGroup.IS_ORGANIZATION_ADMIN]: [PlatformRole.OWNER, PlatformRole.TENANT_ADMIN],
  [AuthorizationGroup.IS_TENANT_MEMBER]: [PlatformRole.OWNER, PlatformRole.TENANT_ADMIN, PlatformRole.USER],
  
  // CAN_ groups (Capabilities)
  [AuthorizationGroup.CAN_VIEW_ORGANIZATION]: [
    PlatformRole.PLATFORM_ADMIN, PlatformRole.OWNER, PlatformRole.TENANT_ADMIN, PlatformRole.PLATFORM_SUPPORT
  ],
  [AuthorizationGroup.CAN_MANAGE_ORGANIZATION]: [
    PlatformRole.PLATFORM_ADMIN, PlatformRole.OWNER, PlatformRole.TENANT_ADMIN
  ],
  [AuthorizationGroup.CAN_PROPAGATE_ITEMS]: [
    PlatformRole.PLATFORM_ADMIN, PlatformRole.OWNER, PlatformRole.TENANT_ADMIN, PlatformRole.PLATFORM_SUPPORT
  ],
  [AuthorizationGroup.CAN_MANAGE_MEMBERS]: [
    PlatformRole.PLATFORM_ADMIN, PlatformRole.OWNER, PlatformRole.TENANT_ADMIN
  ],
  [AuthorizationGroup.CAN_TRANSFER_OWNERSHIP]: [
    PlatformRole.PLATFORM_ADMIN, PlatformRole.OWNER
  ],
  [AuthorizationGroup.CAN_DELETE_ORGANIZATION]: [
    PlatformRole.PLATFORM_ADMIN, PlatformRole.OWNER
  ],
  [AuthorizationGroup.CAN_SUPPORT_TENANTS]: [
    PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_SUPPORT
  ],
  [AuthorizationGroup.CAN_TROUBLESHOOT]: [
    PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_SUPPORT
  ]
};

// Platform role hierarchy
const PLATFORM_ROLE_HIERARCHY = {
  [PlatformRole.PLATFORM_ADMIN]: 5,
  [PlatformRole.OWNER]: 4,
  [PlatformRole.TENANT_ADMIN]: 3,
  [PlatformRole.PLATFORM_SUPPORT]: 2,
  [PlatformRole.USER]: 1,
  [PlatformRole.ANONYMOUS]: 0
};

// Validation interfaces
export interface OrganizationValidationOptions {
  // Authorization group-based (preferred)
  requireAuthorizationGroups?: AuthorizationGroup[];
  requireOneOfGroups?: AuthorizationGroup[][];
  
  // Legacy role-based (backward compatibility)
  requirePlatformRole?: PlatformRole[];
  minPlatformRole?: PlatformRole;
  
  // Membership and tenant validation
  requireMembership?: boolean;
  requireMultiLocation?: boolean;
  excludeCurrentTenant?: boolean;
  minTenantCount?: number;
  currentTenantId?: string;
  
  // Platform authority settings
  platformUsersBypassMembership?: boolean;
  platformUsersBypassTenantCount?: boolean;
  allowSupportOverride?: boolean;
}

// Propagation interfaces (moved here for shared use)
export interface PropagationRequest {
  sourceItemId: string;
  sourceTenantId: string;
  targetTenantIds: string[];
  mode: 'create_only' | 'update_only' | 'create_or_update';
}

export interface PropagationResult {
  success: boolean;
  summary: {
    total: number;
    created: number;
    updated: number;
    failed: number;
    skipped: number;
  };
  details: Array<{
    tenantId: string;
    tenantName: string;
    status: 'created' | 'updated' | 'failed' | 'skipped';
    error?: string;
  }>;
  message?: string;
}

export interface OrganizationTenant {
  id: string;
  name: string;
  metadata?: {
    businessName?: string;
  };
}

export interface OrganizationRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  params?: Record<string, any>;
  
  // Organization validation
  organizationValidation?: OrganizationValidationOptions;
  organizationId?: string;
  
  // Standard request options
  cacheKey?: string;
  cacheTTL?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  
  // Advanced options
  bypassCache?: boolean;
  customRetryLogic?: (error: any) => boolean;
  auditContext?: {
    operation: string;
    reason?: string;
  };
  includeMetadata?: boolean;
  transformResponse?: (data: any) => any;
}

export interface OrganizationValidationResult {
  valid: boolean;
  reason?: string;
  suggestions?: string[];
  userRole?: PlatformRole;
  userGroups?: AuthorizationGroup[];
  organization?: any;
  tenants?: any[];
  isPlatformUser?: boolean;
  bypassedMembership?: boolean;
  isSupportAccess?: boolean;
  requiredGroups?: AuthorizationGroup[];
}

export interface OrganizationServiceOptions {
  defaultOrganizationValidation: OrganizationValidationOptions;
  autoValidateOrganization: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  defaultRetryAttempts?: number;
  retryDelay?: number;
}

// Custom error class
export class OrganizationValidationError extends Error {
  constructor(
    message: string,
    public suggestions?: string[],
    public userRole?: PlatformRole,
    public requiredGroups?: AuthorizationGroup[],
    public userGroups?: AuthorizationGroup[]
  ) {
    super(message);
    this.name = 'OrganizationValidationError';
  }
}

export abstract class OrganizationApiSingleton extends TenantApiSingleton {
  protected defaultRequestType: RequestType = RequestType.TENANT;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
  protected options: OrganizationServiceOptions;

  /**
   * PILOT: Abstract cache contract for organization services
   * Each organization service MUST implement to declare its cache keys
   */
  public abstract getServiceCachePatterns(): string[];

  /**
   * PILOT: Abstract public cache invalidation method for organization services
   * Each organization service MUST implement to provide its invalidation contract
   */
  public abstract invalidateServiceCaches(organizationId?: string, ...params: any[]): Promise<void>;

  protected constructor(singletonKey: string, options?: Partial<OrganizationServiceOptions>) {
    // Create proper cache options for parent class
    const cacheOptions = {
      ttl: options?.cacheTTL || 10 * 60 * 1000, // 10 minutes default
      cacheEnabled: options?.cacheEnabled ?? true,
      defaultRetryAttempts: options?.defaultRetryAttempts || 2,
      retryDelay: options?.retryDelay || 1000
    };

    super(singletonKey, cacheOptions);
    
    // Store organization-specific options
    this.options = {
      defaultOrganizationValidation: {
        // Use authorization groups by default
        requireAuthorizationGroups: [AuthorizationGroup.CAN_VIEW_ORGANIZATION],
        
        // Membership validation
        requireMembership: true,
        requireMultiLocation: false,
        excludeCurrentTenant: false,
        minTenantCount: 1,
        
        // Platform authority
        platformUsersBypassMembership: true,
        platformUsersBypassTenantCount: false,
        allowSupportOverride: true,
        ...options?.defaultOrganizationValidation
      },
      autoValidateOrganization: true,
      cacheEnabled: options?.cacheEnabled ?? true,
      cacheTTL: options?.cacheTTL || 10 * 60 * 1000,
      defaultRetryAttempts: options?.defaultRetryAttempts || 2,
      retryDelay: options?.retryDelay || 1000,
      ...options
    };
  }

  // Enhanced makeDefaultRequest with smart organization validation
  protected async makeDefaultRequest<T>(
    endpoint: string,
    options: OrganizationRequestOptions = {},
    cacheKey?: string,
    cacheTTL: number = this.cacheTTL
  ): Promise<any> {
    // Auto-detect if this is an organization endpoint
    if (this.isOrganizationEndpoint(endpoint) && this.options.autoValidateOrganization) {
      return this.makeOrganizationValidatedRequest<T>(endpoint, {
        ...options,
        organizationValidation: {
          ...this.options.defaultOrganizationValidation,
          // Allow override through options
          ...options.organizationValidation
        },
        // Auto-extract organization ID from endpoint
        organizationId: this.extractOrganizationId(endpoint) || options.organizationId
      }, cacheKey, cacheTTL);
    }
    
    // Fall back to parent for non-organization endpoints
    return super.makeDefaultRequest<T>(endpoint, options, cacheKey, cacheTTL);
  }

  // New organization-aware request method
  protected async makeOrganizationRequest<T>(
    endpoint: string,
    options: OrganizationRequestOptions,
    cacheKey?: string,
    cacheTTL: number = this.cacheTTL
  ): Promise<any> {
    // Explicit organization validation with options
    return this.makeOrganizationValidatedRequest<T>(endpoint, options, cacheKey, cacheTTL);
  }

  // Core organization validation logic
  private async makeOrganizationValidatedRequest<T>(
    endpoint: string,
    options: OrganizationRequestOptions,
    cacheKey: string | undefined,
    cacheTTL: number
  ): Promise<any> {
    const currentUser = this.getCurrentUser();
    const validationOptions = { ...this.options.defaultOrganizationValidation, ...options.organizationValidation };
    const organizationId = options.organizationId || this.extractOrganizationId(endpoint);

    if (!organizationId) {
      throw new OrganizationValidationError(
        'Organization ID is required for organization operations',
        ['Provide organizationId in options or ensure endpoint contains organization ID']
      );
    }

    // 1. Authorization Group Validation (First Priority)
    const authValidation = await this.validateAuthorizationGroups(currentUser, validationOptions);
    if (!authValidation.valid) {
      throw new OrganizationValidationError(
        authValidation.reason || 'Authorization failed',
        authValidation.suggestions,
        authValidation.userRole,
        authValidation.requiredGroups,
        authValidation.userGroups
      );
    }

    // 2. Platform Role Validation (Backward Compatibility)
    if (validationOptions.requirePlatformRole || validationOptions.minPlatformRole) {
      const platformValidation = await this.validatePlatformRole(currentUser, validationOptions);
      if (!platformValidation.valid) {
        throw new OrganizationValidationError(
          platformValidation.reason || 'Platform role validation failed',
          platformValidation.suggestions,
          platformValidation.userRole
        );
      }
    }

    // 3. Skip Membership Validation for Platform Users
    if (this.isPlatformUser(currentUser) && validationOptions.platformUsersBypassMembership) {
      console.log(`[OrganizationApiSingleton] Platform user ${currentUser.role} bypassing membership validation for ${organizationId}`);
      
      // Still validate tenant count if required (for logical operations)
      if (validationOptions.platformUsersBypassTenantCount === false && validationOptions.minTenantCount && validationOptions.minTenantCount > 0) {
        const tenantResult = await this.validateTenantCount(organizationId, validationOptions.minTenantCount);
        if (!tenantResult.valid) {
          throw new OrganizationValidationError(
            tenantResult.reason || 'Tenant count validation failed',
            tenantResult.suggestions
          );
        }
      }

      return this.executeRequest<T>(endpoint, options, cacheTTL, cacheKey);
    }

    // 4. Regular Membership Validation (Non-Platform Users)
    if (validationOptions.requireMembership) {
      const membershipResult = await this.validateOrganizationMembership(organizationId);
      if (!membershipResult.valid) {
        throw new OrganizationValidationError(
          membershipResult.reason || 'Organization membership required',
          membershipResult.suggestions
        );
      }
    }

    // 5. Tenant Count Validation
    if (validationOptions.minTenantCount && validationOptions.minTenantCount > 0) {
      const tenantResult = await this.validateTenantCount(organizationId, validationOptions.minTenantCount);
      if (!tenantResult.valid) {
        throw new OrganizationValidationError(
          tenantResult.reason || 'Tenant count validation failed',
          tenantResult.suggestions
        );
      }
    }

    // 6. Multi-Location Validation
    if (validationOptions.requireMultiLocation) {
      const multiLocationResult = await this.validateMultiLocation(organizationId);
      if (!multiLocationResult.valid) {
        throw new OrganizationValidationError(
          multiLocationResult.reason || 'Multi-location organization required',
          multiLocationResult.suggestions
        );
      }
    }

    return this.executeRequest<T>(endpoint, options, cacheTTL, cacheKey);
  }

  // Authorization group validation
  private async validateAuthorizationGroups(
    currentUser: any,
    options: OrganizationValidationOptions
  ): Promise<OrganizationValidationResult> {
    if (!currentUser) {
      return {
        valid: false,
        reason: 'Authentication required',
        suggestions: ['Please log in to access organization features']
      };
    }

    const userGroups = this.getUserAuthorizationGroups(currentUser);

    // Check if user belongs to required authorization groups
    if (options.requireAuthorizationGroups && options.requireAuthorizationGroups.length > 0) {
      const hasRequiredGroups = options.requireAuthorizationGroups.every(group => 
        userGroups.includes(group)
      );
      
      if (!hasRequiredGroups) {
        return {
          valid: false,
          reason: `Insufficient permissions. Required authorization: ${options.requireAuthorizationGroups.join(' and ')}`,
          suggestions: ['Contact administrator for required permissions'],
          userRole: currentUser.role,
          userGroups,
          requiredGroups: options.requireAuthorizationGroups
        };
      }
    }

    // Check if user belongs to at least one of the specified group sets
    if (options.requireOneOfGroups && options.requireOneOfGroups.length > 0) {
      const hasAnyGroupSet = options.requireOneOfGroups.some(groupSet => 
        groupSet.every(group => userGroups.includes(group))
      );
      
      if (!hasAnyGroupSet) {
        return {
          valid: false,
          reason: `Insufficient permissions. Required one of: ${options.requireOneOfGroups.map(set => `(${set.join(' and ')})`).join(' or ')}`,
          suggestions: ['Contact administrator for required permissions'],
          userRole: currentUser.role,
          userGroups,
          requiredGroups: options.requireOneOfGroups.flat()
        };
      }
    }

    return {
      valid: true,
      userRole: currentUser.role,
      userGroups
    };
  }

  // Platform role validation (backward compatibility)
  private async validatePlatformRole(
    currentUser: any,
    options: OrganizationValidationOptions
  ): Promise<OrganizationValidationResult> {
    if (!currentUser) {
      return {
        valid: false,
        reason: 'Authentication required',
        suggestions: ['Please log in to access organization features']
      };
    }

    // PLATFORM_SUPPORT special handling
    if (currentUser.role === PlatformRole.PLATFORM_SUPPORT) {
      if (options.allowSupportOverride) {
        return {
          valid: true,
          userRole: currentUser.role,
          isSupportAccess: true,
          reason: 'Support access granted for troubleshooting'
        };
      }
      
      if (options.requirePlatformRole && !options.requirePlatformRole.includes(PlatformRole.PLATFORM_SUPPORT)) {
        return {
          valid: false,
          reason: `Support access not allowed for this operation. Required role: ${options.requirePlatformRole.join(' or ')}`,
          suggestions: ['Contact platform administrator for elevated access'],
          userRole: currentUser.role
        };
      }
    }

    // Check specific required platform roles
    if (options.requirePlatformRole && options.requirePlatformRole.length > 0) {
      if (!options.requirePlatformRole.includes(currentUser.role)) {
        return {
          valid: false,
          reason: `Insufficient permissions. Required role: ${options.requirePlatformRole.join(' or ')}`,
          suggestions: ['Contact organization owner or platform administrator'],
          userRole: currentUser.role
        };
      }
    }

    // Check minimum platform role level
    if (options.minPlatformRole) {
      const userRoleLevel = PLATFORM_ROLE_HIERARCHY[currentUser.role as PlatformRole] || 0;
      const minRoleLevel = PLATFORM_ROLE_HIERARCHY[options.minPlatformRole] || 0;
      
      if (userRoleLevel < minRoleLevel) {
        return {
          valid: false,
          reason: `Insufficient permissions. Minimum role required: ${options.minPlatformRole}`,
          suggestions: ['Contact organization owner or platform administrator'],
          userRole: currentUser.role
        };
      }
    }

    return {
      valid: true,
      userRole: currentUser.role
    };
  }

  // Helper methods (public for use by services)
  public getUserAuthorizationGroups(currentUser: any): AuthorizationGroup[] {
    const userRole = currentUser.role;
    const groups: AuthorizationGroup[] = [];

    Object.entries(AUTHORIZATION_GROUPS).forEach(([group, roles]) => {
      if (roles.includes(userRole)) {
        groups.push(group as AuthorizationGroup);
      }
    });

    return groups;
  }

  public getCurrentUser(): any {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.warn('[OrganizationApiSingleton] Cannot access auth token in server-side environment');
      return null;
    }
    
    // Use the same token sources as getAuthToken() in FlexibleApiSingleton
    const token = localStorage.getItem('access_token') || 
                 sessionStorage.getItem('access_token') ||
                 document.cookie.split(';').find(c => c.trim().startsWith('access_token='))?.split('=')[1] ||
                 localStorage.getItem('authToken') ||
                 sessionStorage.getItem('authToken') ||
                 document.cookie.split(';').find(c => c.trim().startsWith('authToken='))?.split('=')[1];
    
    if (!token) {
      console.warn('[OrganizationApiSingleton] No auth token found for getCurrentUser');
      return null;
    }
    
    // Validate token format (same as getAuthToken)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('[OrganizationApiSingleton] Invalid token format in getCurrentUser');
      return null;
    }
    
    try {
      // Parse JWT payload
      return JSON.parse(atob(parts[1]));
    } catch (error) {
      console.warn('[OrganizationApiSingleton] Failed to parse JWT in getCurrentUser:', error);
      return null;
    }
  }

  public logError(message: string, error: any): void {
    console.error(`[OrganizationApiSingleton] ${message}:`, error);
  }

  private decrypt(encrypted: string): string {
    // This should be implemented based on your encryption method
    // For now, return the encrypted string as-is (placeholder)
    return encrypted;
  }

  private isPlatformUser(currentUser: any): boolean {
    const platformRoles = [
      PlatformRole.PLATFORM_ADMIN,
      PlatformRole.PLATFORM_SUPPORT,
      PlatformRole.OWNER
    ];
    return platformRoles.includes(currentUser.role);
  }

  private isOrganizationEndpoint(endpoint: string): boolean {
    const organizationPatterns = [
      /\/api\/organizations\//,           // /api/organizations/{id}
      /\/api\/organizations\/[^\/]+\/items/, // /api/organizations/{id}/items
      /\/api\/organizations\/[^\/]+\/tenants/, // /api/organizations/{id}/tenants
      /\/api\/organizations\/[^\/]+\/members/, // /api/organizations/{id}/members
    ];
    
    return organizationPatterns.some(pattern => pattern.test(endpoint));
  }

  private extractOrganizationId(endpoint: string): string | null {
    const match = endpoint.match(/\/api\/organizations\/([^\/]+)/);
    return match ? match[1] : null;
  }

  // Validation methods (to be implemented based on your existing services)
  private async validateOrganizationMembership(organizationId: string): Promise<OrganizationValidationResult> {
    // This would call your existing organization service to validate membership
    try {
      // For now, assume validation passes
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: 'Unable to verify organization membership',
        suggestions: ['Contact organization administrator']
      };
    }
  }

  private async validateTenantCount(organizationId: string, minCount: number): Promise<OrganizationValidationResult> {
    // This would validate tenant count
    try {
      // For now, assume validation passes
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: `Organization requires at least ${minCount} location(s)`,
        suggestions: ['Add more locations to your organization']
      };
    }
  }

  private async validateMultiLocation(organizationId: string): Promise<OrganizationValidationResult> {
    // This would validate multi-location requirement
    try {
      // For now, assume validation passes
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: 'Multi-location organization required for this operation',
        suggestions: ['Add more locations to enable this feature']
      };
    }
  }

  // Execute request (delegates to parent implementation)
  private async executeRequest<T>(
    endpoint: string,
    options: OrganizationRequestOptions,
    cacheTTL: number,
    cacheKey?: string
  ): Promise<any> {
    // Get authentication token
    const token = await this.getAuthToken();
    
    // Add authentication to headers
    let enhancedOptions = {
      ...options,
      headers: {
        ...options.headers,
      }
    };

    if (token) {
      (enhancedOptions.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn('[OrganizationApiSingleton] No auth token available for organization request');
      // For organization requests, we might want to be more permissive or throw error
      // depending on the specific operation
    }

    // Add organization context to headers
    enhancedOptions.headers = {
      ...enhancedOptions.headers,
      'X-Request-Context': 'organization',
      'X-Organization-ID': (options.organizationId || this.extractOrganizationId(endpoint)) || '',
      'X-Organization-Validation': JSON.stringify({
        validationPassed: true,
        timestamp: Date.now(),
        userGroups: this.getUserAuthorizationGroups(this.getCurrentUser())
      })
    };

    // Add audit tracking for organization operations
    if (options.auditContext) {
      (enhancedOptions.headers as Record<string, string>)['X-Audit-Operation'] = options.auditContext.operation;
      (enhancedOptions.headers as Record<string, string>)['X-Audit-Reason'] = options.auditContext.reason || '';
      (enhancedOptions.headers as Record<string, string>)['X-Audit-ID'] = this.generateAuditId();
    }

    // Add service identification
    (enhancedOptions.headers as Record<string, string>)['X-Service'] = this.constructor.name.replace('Service', '');

    return super.makeDefaultRequest<T>(endpoint, enhancedOptions, cacheKey, cacheTTL);
  }

  // Get authentication token (delegate to base class for consistency)
  protected async getAuthToken(): Promise<string | null> {
    // Delegate to the base class which has the proper token retrieval logic
    return super.getAuthToken();
  }

  // Generate audit ID for tracking
  private generateAuditId(): string {
    return `org_audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
