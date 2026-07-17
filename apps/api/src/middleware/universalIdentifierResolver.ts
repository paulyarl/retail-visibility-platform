/**
 * Universal Identifier Resolver Middleware
 * 
 * Provides encrypted cache-based tenant identifier resolution
 * for all routes that need tenant context.
 */

import { Request, Response, NextFunction } from 'express';
import { UniversalIdentifierCache, ResolvedTenant } from '../services/UniversalIdentifierCache';
import { CacheMonitoringDashboard } from '../monitoring/CacheMetrics';
import { logger } from '../logger';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      resolvedTenant?: ResolvedTenant;
      identifierType?: 'tenant_id' | 'slug' | 'auto_id';
      identifierResolutionTime?: number;
    }
  }
}

/**
 * Universal Identifier Resolver Middleware
 * 
 * This middleware resolves any identifier (tenant-id, slug, auto-id) to a tenant
 * using the encrypted cache system. It attaches the resolved tenant to the request
 * object for downstream handlers to use.
 */
export async function resolveUniversalIdentifier(
  req: Request,
  res: Response,
  next?: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const { identifier } = req.params;
  
  // Validate identifier parameter
  if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'Invalid identifier',
      message: 'Identifier is required and must be a non-empty string'
    });
    return;
  }

  try {
    console.log(`[Identifier Resolver] Resolving: ${identifier}`);
    
    // Use the encrypted cache singleton for resolution
    const cache = UniversalIdentifierCache.getInstance();
    const resolvedTenant = await cache.resolveIdentifier(identifier);
    
    if (!resolvedTenant) {
      console.log(`[Identifier Resolver] Not found: ${identifier}`);
      
      // Record miss for metrics
      const dashboard = new CacheMonitoringDashboard();
      dashboard.getMetricsCollector().recordMiss();
      
      res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
      return;
    }
    
    // Success! Attach resolved data to request
    req.resolvedTenant = resolvedTenant;
    req.identifierType = resolvedTenant.type;
    req.identifierResolutionTime = Date.now() - startTime;
    
    // Record hit for metrics
    const dashboard = new CacheMonitoringDashboard();
    dashboard.getMetricsCollector().recordHit(
      req.identifierResolutionTime,
      resolvedTenant.type
    );
    
    console.log(`[Identifier Resolver] Resolved: ${identifier} -> ${resolvedTenant.id} (${resolvedTenant.type}) in ${req.identifierResolutionTime}ms`);
    
    // Add cache headers for response
    res.setHeader('X-Resolver-Cache', resolvedTenant.type);
    res.setHeader('X-Resolver-Time', req.identifierResolutionTime.toString());
    res.setHeader('X-Tenant-ID', resolvedTenant.id);
    
    next?.();
  } catch (error) {
    const resolutionTime = Date.now() - startTime;
    logger.error(`[Identifier Resolver] Error resolving ${identifier} (${resolutionTime}ms):`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    
    // Record error for metrics
    const dashboard = new CacheMonitoringDashboard();
    dashboard.getMetricsCollector().recordError();
    
    res.status(500).json({
      success: false,
      error: 'Resolution failed',
      message: 'Failed to resolve tenant identifier',
      identifier,
      resolutionTime
    });
  }
}

/**
 * Optional: Create a version that requires authentication
 */
export function resolveUniversalIdentifierWithAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // First check if user is authenticated
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'This endpoint requires authentication'
    });
    return;
  }
  
  // Then proceed with identifier resolution
  resolveUniversalIdentifier(req, res, next);
}

/**
 * Optional: Create a version that also checks tenant access
 */
export function resolveUniversalIdentifierWithAccess(
  req: Request,
  res: Response,
  next?: NextFunction
): void {
  // First resolve identifier
  resolveUniversalIdentifier(req, res, (err?: any) => {
    if (err) return next?.(err);
    
    // Check if user has access to this tenant
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'This endpoint requires authentication'
      });
    }
    
    // For now, allow all authenticated users (implement proper access control later)
    // In a real implementation, you'd check user_tenants table here
    
    console.log(`[Identifier Resolver] Access granted for user ${req.user.userId} to tenant ${req.resolvedTenant?.id}`);
    next?.();
  });
}

/**
 * Helper function to create route-specific resolvers
 */
export function createIdentifierResolver(options: {
  requireAuth?: boolean;
  requireAccess?: boolean;
  customValidation?: (identifier: string, req: Request) => string | null;
}) {
  const { requireAuth = false, requireAccess = false, customValidation } = options;
  
  return (req: Request, res: Response, next?: NextFunction): void => {
    // Custom validation
    if (customValidation) {
      const error = customValidation(req.params.identifier, req);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error
        });
        return;
      }
    }
    
    // Authentication check
    if (requireAuth && !req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'This endpoint requires authentication'
      });
      return;
    }
    
    // Choose resolver based on requirements
    if (requireAccess) {
      resolveUniversalIdentifierWithAccess(req, res, next);
    } else {
      resolveUniversalIdentifier(req, res, next);
    }
  };
}

/**
 * Batch resolver for testing multiple identifiers
 */
export async function resolveMultipleIdentifiers(identifiers: string[]): Promise<{
  successes: Array<{ identifier: string; tenant: ResolvedTenant; type: string; time: number }>;
  failures: Array<{ identifier: string; error: string; time: number }>;
}> {
  const results = {
    successes: [] as Array<{ identifier: string; tenant: ResolvedTenant; type: string; time: number }>,
    failures: [] as Array<{ identifier: string; error: string; time: number }>
  };
  
  const cache = UniversalIdentifierCache.getInstance();
  
  // Resolve all identifiers in parallel
  const promises = identifiers.map(async (identifier) => {
    const startTime = Date.now();
    
    try {
      const tenant = await cache.resolveIdentifier(identifier);
      const time = Date.now() - startTime;
      
      if (tenant) {
        results.successes.push({
          identifier,
          tenant: {
            id: tenant.id,
            slug: tenant.slug,
            name: tenant.name,
            subscriptionStatus: tenant.subscriptionStatus,
            metadata: tenant.metadata,
            type: 'tenant_id'
          },
          type: tenant.type,
          time
        });
      } else {
        results.failures.push({
          identifier,
          error: 'Tenant not found',
          time
        });
      }
    } catch (error) {
      results.failures.push({
        identifier,
        error: error instanceof Error ? error.message : 'Unknown error',
        time: Date.now() - startTime
      });
    }
  });
  
  await Promise.all(promises);
  
  return results;
}
