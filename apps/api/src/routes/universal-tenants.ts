/**
 * Universal Tenant Routes
 * 
 * New tenant routes using the universal identifier resolver middleware
 * with encrypted cache and service layer abstraction.
 */

import { Router } from 'express';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { TenantService } from '../services/TenantService';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/tenants/:identifier/profile
 * Get tenant profile by any identifier (tenant-id, slug, auto-id)
 * 
 * Replaces: GET /api/tenants/:id
 */
router.get('/tenants/:identifier/profile', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log(`[Universal Tenants] Getting profile for: ${identifier}`);
    
    // Use the universal identifier resolver
    const { UniversalIdentifierCache } = await import('../services/UniversalIdentifierCache');
    const cache = UniversalIdentifierCache.getInstance();
    const resolvedTenant = await cache.resolveIdentifier(identifier);
    
    if (!resolvedTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }
    
    const tenantService = TenantService.getInstance();
    const profile = await tenantService.getTenantProfile(resolvedTenant.id);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Tenant profile not found',
        message: 'Unable to retrieve tenant profile'
      });
    }
    
    res.json({
      success: true,
      data: profile,
      metadata: {
        tenant: {
          id: resolvedTenant.id,
          name: resolvedTenant.name,
          slug: resolvedTenant.slug,
          type: resolvedTenant.type
        },
        identifierType: resolvedTenant.type
      }
    });
  } catch (error) {
    logger.error('[Universal Tenants] Error getting profile:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/tenants/:identifier/complete
 * Get complete tenant data (profile + usage + tier + subscription)
 * 
 * Replaces: GET /api/tenants/:id/complete
 */
router.get('/tenants/:identifier/complete', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Use the universal identifier resolver
    const { UniversalIdentifierCache } = await import('../services/UniversalIdentifierCache');
    const cache = UniversalIdentifierCache.getInstance();
    const resolvedTenant = await cache.resolveIdentifier(identifier);
    
    if (!resolvedTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }
    
    const tenantService = TenantService.getInstance();
    const completeData = await tenantService.getTenantComplete(resolvedTenant.id);
    
    if (!completeData) {
      return res.status(404).json({
        success: false,
        error: 'Tenant data not found',
        message: 'Unable to retrieve complete tenant data'
      });
    }
    
    res.json({
      success: true,
      data: completeData,
      metadata: {
        tenant: {
          id: resolvedTenant.id,
          name: resolvedTenant.name,
          slug: resolvedTenant.slug,
          type: resolvedTenant.type
        },
        identifierType: resolvedTenant.type
      }
    });
  } catch (error) {
    logger.error('[Universal Tenants] Error getting complete data:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/tenants/:identifier/stats
 * Get tenant statistics
 * 
 * Replaces: GET /api/tenants/:id/stats
 */
router.get('/tenants/:identifier/stats', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Use the universal identifier resolver
    const { UniversalIdentifierCache } = await import('../services/UniversalIdentifierCache');
    const cache = UniversalIdentifierCache.getInstance();
    const resolvedTenant = await cache.resolveIdentifier(identifier);
    
    if (!resolvedTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }
    
    const tenantService = TenantService.getInstance();
    const completeData = await tenantService.getTenantComplete(resolvedTenant.id);
    
    if (!completeData) {
      return res.status(404).json({
        success: false,
        error: 'Tenant stats not found',
        message: 'Unable to retrieve tenant statistics'
      });
    }
    
    res.json({
      success: true,
      data: {
        usage: completeData.usage,
        tier: completeData.tier,
        subscription: completeData.subscription
      },
      metadata: {
        tenant: {
          id: resolvedTenant.id,
          name: resolvedTenant.name,
          slug: resolvedTenant.slug,
          type: resolvedTenant.type
        },
        identifierType: resolvedTenant.type
      }
    });
  } catch (error) {
    logger.error('[Universal Tenants] Error getting stats:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
