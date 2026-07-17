/**
 * Hero Location API Routes
 * 
 * Provides endpoints for hero location operations:
 * - Get hero location for organization
 * - Get payment configuration
 * - Route payments through hero location
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { HeroLocationService } from '../services/HeroLocationService';
import { authenticateToken } from '../middleware/auth';
import { canPerformSupportActions } from '../utils/platform-admin';
import { logger } from '../logger';

const router = Router();

// Get singleton instance
const heroLocationService = HeroLocationService.getInstance();

/**
 * GET /api/hero-location/organization/:organizationId
 * Get hero location information for an organization
 * Permission: Organization members or platform admin
 */
router.get('/organization/:organizationId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.params.organizationId;
    const user = (req as any).user;

    // Verify user has access to this organization
    if (!canPerformSupportActions(user)) {
      // For non-admin users, verify they belong to this organization
      const organization = await prisma.organizations_list.findUnique({
        where: { id: organizationId },
        include: {
          tenants: {
            where: {
              user_tenants: {
                some: {
                  user_id: user.userId,
                  role: {
                    in: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']
                  }
                }
              }
            }
          }
        }
      });

      if (!organization || organization.tenants.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'You do not have access to this organization'
        });
      }
    }

    const heroLocation = await heroLocationService.getHeroLocation(organizationId);

    if (!heroLocation) {
      return res.json({
        success: true,
        heroLocation: null,
        message: 'No hero location set for this organization'
      });
    }

    res.json({
      success: true,
      heroLocation: {
        tenantId: heroLocation.tenantId,
        tenantName: heroLocation.tenantName,
        organizationId: heroLocation.organizationId,
        hasPaymentGateway: !!heroLocation.paymentGatewayId,
        paymentGatewayType: heroLocation.paymentGatewayType,
        businessProfile: heroLocation.businessProfile,
      }
    });
  } catch (error: any) {
    logger.error('[Hero Location] Get hero location error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_get_hero_location',
      message: error.message
    });
  }
});

/**
 * GET /api/hero-location/tenant/:tenantId
 * Get hero location for a tenant's organization
 * Permission: Tenant admin or platform admin
 */
router.get('/tenant/:tenantId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const user = (req as any).user;

    // Verify user has access to this tenant
    if (!canPerformSupportActions(user)) {
      const userTenant = await prisma.user_tenants.findFirst({
        where: {
          user_id: user.userId,
          tenant_id: tenantId,
          role: {
            in: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']
          }
        }
      });

      if (!userTenant) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'You do not have access to this tenant'
        });
      }
    }

    const heroLocation = await heroLocationService.getHeroLocationForTenant(tenantId);

    if (!heroLocation) {
      return res.json({
        success: true,
        heroLocation: null,
        message: 'No hero location set for this organization'
      });
    }

    res.json({
      success: true,
      heroLocation: {
        tenantId: heroLocation.tenantId,
        tenantName: heroLocation.tenantName,
        organizationId: heroLocation.organizationId,
        hasPaymentGateway: !!heroLocation.paymentGatewayId,
        paymentGatewayType: heroLocation.paymentGatewayType,
        businessProfile: heroLocation.businessProfile,
      }
    });
  } catch (error: any) {
    logger.error('[Hero Location] Get hero location for tenant error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_get_hero_location',
      message: error.message
    });
  }
});

/**
 * POST /api/hero-location/route-payment
 * Route payment through hero location
 * Permission: Authenticated users (for checkout)
 */
router.post('/route-payment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pickupTenantId } = req.body;

    if (!pickupTenantId) {
      return res.status(400).json({
        success: false,
        error: 'pickup_tenant_id_required',
        message: 'Pickup tenant ID is required'
      });
    }

    const paymentTenantId = await heroLocationService.routeOrderPayment(pickupTenantId);

    // Get payment configuration for the payment tenant
    const paymentConfig = await heroLocationService.getHeroPaymentConfig(
      // We need to find the organization ID first
      (await prisma.tenants.findUnique({
        where: { id: pickupTenantId },
        select: { organization_id: true }
      }))?.organization_id || ''
    );

    res.json({
      success: true,
      paymentRouting: {
        pickupTenantId,
        paymentTenantId,
        isHeroPayment: paymentTenantId !== pickupTenantId,
        paymentConfig: paymentConfig ? {
          paymentGatewayId: paymentConfig.paymentGatewayId,
          paymentGatewayType: paymentConfig.paymentGatewayType,
        } : null,
      }
    });
  } catch (error: any) {
    logger.error('[Hero Location] Route payment error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_route_payment',
      message: error.message
    });
  }
});

/**
 * GET /api/hero-location/organization/:organizationId/tenants
 * Get all tenants in organization with hero status
 * Permission: Organization members or platform admin
 */
router.get('/organization/:organizationId/tenants', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = req.params.organizationId;
    const user = (req as any).user;

    // Verify user has access to this organization
    if (!canPerformSupportActions(user)) {
      const organization = await prisma.organizations_list.findUnique({
        where: { id: organizationId },
        include: {
          tenants: {
            where: {
              user_tenants: {
                some: {
                  user_id: user.userId,
                  role: {
                    in: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']
                  }
                }
              }
            }
          }
        }
      });

      if (!organization || organization.tenants.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'You do not have access to this organization'
        });
      }
    }

    const tenants = await heroLocationService.getOrganizationTenantsWithHeroStatus(organizationId);

    res.json({
      success: true,
      tenants,
      heroCount: tenants.filter(t => t.isHero).length,
    });
  } catch (error: any) {
    logger.error('[Hero Location] Get organization tenants error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_get_tenants',
      message: error.message
    });
  }
});

export default router;
