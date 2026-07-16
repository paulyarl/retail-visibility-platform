/**
 * Shipment Routes
 *
 * Provides endpoints for shipment management:
 * - GET /api/tenants/:tenantId/shipments/:shipmentId — Get shipment detail with timeline
 * - PATCH /api/tenants/:tenantId/shipments/:shipmentId/status — Update shipment status
 * - GET /api/tenants/:tenantId/shipments/:shipmentId/events — Get tracking events
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../prisma';
import { getShipmentStatusService } from '../services/ShipmentStatusService';
import type { ShipmentStatus } from '../services/ShipmentStatusService';
import { checkTierAccessWithOverrides } from '../middleware/tier-access';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/tenants/:tenantId/shipments/:shipmentId
 * Get shipment detail with timeline
 */
router.get('/:shipmentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId, shipmentId } = req.params;

    const shipment = await prisma.shipments.findUnique({
      where: { id: shipmentId },
      include: {
        orders: {
          select: {
            id: true,
            order_number: true,
            customer_name: true,
            customer_email: true,
            fulfillment_status: true,
          },
        },
      },
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: 'shipment_not_found',
        message: 'Shipment not found',
      });
    }

    if (shipment.tenant_id !== tenantId) {
      return res.status(403).json({
        success: false,
        error: 'access_denied',
        message: 'Shipment does not belong to this tenant',
      });
    }

    // Build timeline
    const service = getShipmentStatusService();
    const timeline = await service.getShipmentTimeline(shipmentId);

    res.json({
      success: true,
      data: {
        id: shipment.id,
        orderId: shipment.order_id,
        tenantId: shipment.tenant_id,
        carrier: shipment.carrier,
        trackingNumber: shipment.tracking_number,
        trackingUrl: shipment.tracking_url,
        shipmentStatus: shipment.shipment_status,
        shippedAt: shipment.shipped_at,
        inTransitAt: shipment.in_transit_at,
        outForDeliveryAt: shipment.out_for_delivery_at,
        deliveredAt: shipment.delivered_at,
        failedDeliveryAt: shipment.failed_delivery_at,
        returnedAt: shipment.returned_at,
        estimatedDeliveryDate: shipment.estimated_delivery_date,
        timeline,
        order: shipment.orders,
        createdAt: shipment.created_at,
        updatedAt: shipment.updated_at,
      },
    });
  } catch (error) {
    logger.error('[Shipments API] Error fetching shipment:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch shipment',
    });
  }
});

/**
 * PATCH /api/tenants/:tenantId/shipments/:shipmentId/status
 * Update shipment status (gated by order_tracking capability)
 */
router.patch(
  '/:shipmentId/status',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { tenantId, shipmentId } = req.params;
      const { status, location, description } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'status_required',
          message: 'status is required',
        });
      }

      // Verify shipment belongs to tenant
      const shipment = await prisma.shipments.findUnique({
        where: { id: shipmentId },
      });

      if (!shipment) {
        return res.status(404).json({
          success: false,
          error: 'shipment_not_found',
          message: 'Shipment not found',
        });
      }

      if (shipment.tenant_id !== tenantId) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'Shipment does not belong to this tenant',
        });
      }

      // Gate behind order_tracking capability
      try {
        const access = await checkTierAccessWithOverrides(tenantId, 'order_tracking');
        if (!access.hasAccess) {
          return res.status(403).json({
            success: false,
            error: 'feature_not_available',
            message: 'Order tracking feature is not available for this tenant',
          });
        }
      } catch (err) {
        console.warn('[Shipments API] Tier access check failed, allowing status update:', err);
      }

      const service = getShipmentStatusService();
      const result = await service.transitionShipmentStatus({
        shipmentId,
        newStatus: status as ShipmentStatus,
        location,
        description,
        source: 'manual',
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          message: 'Failed to transition shipment status',
        });
      }

      res.json({
        success: true,
        data: {
          shipment: result.shipment,
          status: status,
        },
        message: 'Shipment status updated',
      });
    } catch (error) {
      logger.error('[Shipments API] Error updating shipment status:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      res.status(500).json({
        success: false,
        error: 'internal_error',
        message: 'Failed to update shipment status',
      });
    }
  }
);

/**
 * GET /api/tenants/:tenantId/shipments/:shipmentId/events
 * Get tracking events for a shipment
 */
router.get(
  '/:shipmentId/events',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { tenantId, shipmentId } = req.params;

      const shipment = await prisma.shipments.findUnique({
        where: { id: shipmentId },
        select: {
          tenant_id: true,
          tracking_events: true,
          shipment_status: true,
          created_at: true,
        },
      });

      if (!shipment) {
        return res.status(404).json({
          success: false,
          error: 'shipment_not_found',
          message: 'Shipment not found',
        });
      }

      if (shipment.tenant_id !== tenantId) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'Shipment does not belong to this tenant',
        });
      }

      const service = getShipmentStatusService();
      const timeline = await service.getShipmentTimeline(shipmentId);

      res.json({
        success: true,
        data: timeline,
      });
    } catch (error) {
      logger.error('[Shipments API] Error fetching tracking events:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      res.status(500).json({
        success: false,
        error: 'internal_error',
        message: 'Failed to fetch tracking events',
      });
    }
  }
);

export default router;
