/**
 * Universal Identifier Resolver Middleware
 * 
 * Provides consistent identifier resolution across multiple routes:
 * - /shops/:identifier
 * - /tenant/:identifier  
 * - /stores/:identifier
 * - /storefront/:identifier
 * 
 * Supported identifier types:
 * - tenant-id (e.g., "tid-m8ijkrnk")
 * - slug (e.g., "baraka-international-market-inc")
 * - auto-id (e.g., "ULCW")
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

export interface ResolvedTenant {
  id: string;
  slug: string | null;
  name: string;
  subscriptionStatus: string;
  metadata: any;
}

export interface IdentifierResolution {
  identifier: string;
  type: 'tenant_id' | 'slug' | 'auto_id';
  tenant: ResolvedTenant | null;
}

/**
 * Middleware to resolve identifier and attach to request
 */
export async function resolveIdentifier(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { identifier } = req.params;
  
  try {
    console.log(`[Identifier Resolver] Resolving: ${identifier}`);
    
    // Try to resolve by tenant_id first (most common)
    let tenant = await prisma.tenants.findFirst({
      where: { id: identifier },
      select: {
        id: true,
        slug: true,
        name: true,
        subscription_status: true,
        metadata: true
      }
    });
    
    if (tenant) {
      const resolution: IdentifierResolution = {
        identifier,
        type: 'tenant_id',
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          subscriptionStatus: tenant.subscription_status || 'unknown',
          metadata: tenant.metadata
        }
      };
      
      req.resolvedIdentifier = resolution;
      console.log(`[Identifier Resolver] Resolved as tenant_id: ${identifier}`);
      return next();
    }
    
    // Try to resolve by slug
    tenant = await prisma.tenants.findFirst({
      where: { slug: identifier },
      select: {
        id: true,
        slug: true,
        name: true,
        subscription_status: true,
        metadata: true
      }
    });
    
    if (tenant) {
      const resolution: IdentifierResolution = {
        identifier,
        type: 'slug',
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          subscriptionStatus: tenant.subscription_status || 'unknown',
          metadata: tenant.metadata
        }
      };
      
      req.resolvedIdentifier = resolution;
      console.log(`[Identifier Resolver] Resolved as slug: ${identifier}`);
      return next();
    }
    
    // Try to resolve by auto_id (from metadata)
    const tenantsWithAutoId = await prisma.tenants.findMany({
      where: {
        metadata: {
          path: ['autoId'],
          equals: identifier
        }
      },
      select: {
        id: true,
        slug: true,
        name: true,
        subscription_status: true,
        metadata: true
      }
    });
    
    if (tenantsWithAutoId.length > 0) {
      const tenant = tenantsWithAutoId[0];
      const resolution: IdentifierResolution = {
        identifier,
        type: 'auto_id',
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          subscriptionStatus: tenant.subscription_status || 'unknown',
          metadata: tenant.metadata
        }
      };
      
      req.resolvedIdentifier = resolution;
      console.log(`[Identifier Resolver] Resolved as auto_id: ${identifier}`);
      return next();
    }
    
    // Not found
    console.log(`[Identifier Resolver] Not found: ${identifier}`);
    return res.status(404).json({
      success: false,
      error: 'Not found',
      message: `No tenant found for identifier: ${identifier}`
    });
    
  } catch (error) {
    console.error(`[Identifier Resolver] Error resolving ${identifier}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Resolution failed',
      message: 'Failed to resolve identifier'
    });
  }
}

/**
 * Extend Express Request interface
 */
declare global {
  namespace Express {
    interface Request {
      resolvedIdentifier?: IdentifierResolution;
    }
  }
}
