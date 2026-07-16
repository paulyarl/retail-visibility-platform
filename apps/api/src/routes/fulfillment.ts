/**
 * Fulfillment API Routes
 * 
 * Provides endpoints for fulfillment coordination:
 * - Time slot management
 * - Pickup scheduling
 * - Fulfillment notifications
 * - Location fulfillment statistics
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { FulfillmentService } from '../services/FulfillmentService';
import { authenticateToken } from '../middleware/auth';
import { canPerformSupportActions } from '../utils/platform-admin';
import { z } from 'zod';
import { logger } from '../logger';

const router = Router();

// Get singleton instance
const fulfillmentService = FulfillmentService.getInstance();

// Validation schemas
const createTimeSlotsSchema = z.object({
  timeSlots: z.array(z.object({
    date: z.string().datetime(),
    startTime: z.string(),
    endTime: z.string(),
    maxOrders: z.number().min(1),
    isActive: z.boolean(),
    fulfillmentMethod: z.enum(['pickup', 'delivery']),
  }))
});

const scheduleFulfillmentSchema = z.object({
  scheduledDate: z.string().datetime(),
  scheduledTime: z.string(),
  fulfillmentMethod: z.enum(['pickup', 'delivery']).optional(),
  notes: z.string().optional(),
});

const createNotificationSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  type: z.enum(['order_confirmed', 'ready_for_pickup', 'pickup_reminder', 'order_completed', 'order_cancelled']),
  channel: z.enum(['email', 'sms', 'push']),
  content: z.string(),
  scheduledAt: z.string().datetime().optional(),
});

/**
 * POST /api/fulfillment/time-slots/:tenantId
 * Create time slots for a location
 * Permission: Tenant admin/owner or platform admin
 */
router.post('/time-slots/:tenantId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const user = (req as any).user;
    const parsed = createTimeSlotsSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten()
      });
    }

    // Verify user has access to this tenant
    if (!canPerformSupportActions(user)) {
      const userTenant = await prisma.user_tenants.findFirst({
        where: {
          user_id: user.userId,
          tenant_id: tenantId,
          role: {
            in: ['OWNER', 'ADMIN']
          }
        }
      });

      if (!userTenant) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'You do not have permission to manage time slots for this location'
        });
      }
    }

    const timeSlots = await fulfillmentService.createTimeSlots(
      tenantId,
      parsed.data.timeSlots.map(slot => ({
        ...slot,
        tenantId,
        date: new Date(slot.date)
      }))
    );

    res.json({
      success: true,
      timeSlots,
    });
  } catch (error: any) {
    logger.error('[Fulfillment] Create time slots error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_create_time_slots',
      message: error.message
    });
  }
});

/**
 * GET /api/fulfillment/time-slots/:tenantId
 * Get available time slots for a location
 * Permission: Tenant members or platform admin
 */
router.get('/time-slots/:tenantId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const user = (req as any).user;
    const { date, fulfillmentMethod } = req.query;

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
          message: 'You do not have access to this location'
        });
      }
    }

    const timeSlots = await fulfillmentService.getAvailableTimeSlots(
      tenantId,
      date ? new Date(date as string) : new Date(),
      fulfillmentMethod as 'pickup' | 'delivery' || 'pickup'
    );

    res.json({
      success: true,
      timeSlots,
    });
  } catch (error: any) {
    logger.error('[Fulfillment] Get time slots error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_get_time_slots',
      message: error.message
    });
  }
});

/**
 * POST /api/fulfillment/schedule/:orderId
 * Schedule order fulfillment
 * Permission: Tenant members or platform admin
 */
router.post('/schedule/:orderId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const user = (req as any).user;
    const parsed = scheduleFulfillmentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten()
      });
    }

    // Get order to determine tenant
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        tenant_id: true,
        metadata: true,
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found',
        message: 'Order not found'
      });
    }

    // Determine pickup tenant for multi-location orders
    const metadata = order.metadata as any || {};
    const pickupTenantId = metadata.is_multi_location_order 
      ? metadata.pickup_tenant_id 
      : order.tenant_id;

    // Verify user has access to the pickup location
    if (!canPerformSupportActions(user)) {
      const userTenant = await prisma.user_tenants.findFirst({
        where: {
          user_id: user.userId,
          tenant_id: pickupTenantId,
          role: {
            in: ['OWNER', 'ADMIN', 'MEMBER']
          }
        }
      });

      if (!userTenant) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'You do not have permission to schedule fulfillment for this order'
        });
      }
    }

    const schedule = await fulfillmentService.scheduleFulfillment(
      orderId,
      pickupTenantId,
      new Date(parsed.data.scheduledDate),
      parsed.data.scheduledTime,
      parsed.data.fulfillmentMethod || 'pickup',
      parsed.data.notes
    );

    res.json({
      success: true,
      schedule,
    });
  } catch (error: any) {
    logger.error('[Fulfillment] Schedule fulfillment error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_schedule_fulfillment',
      message: error.message
    });
  }
});

/**
 * GET /api/fulfillment/schedules/:tenantId
 * Get fulfillment schedules for a location
 * Permission: Tenant members or platform admin
 */
router.get('/schedules/:tenantId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const user = (req as any).user;
    const { date, fulfillmentMethod, status, limit, offset } = req.query;

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
          message: 'You do not have access to this location'
        });
      }
    }

    const options = {
      date: date ? new Date(date as string) : undefined,
      fulfillmentMethod: fulfillmentMethod as 'pickup' | 'delivery' | undefined,
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const result = await fulfillmentService.getLocationSchedules(tenantId, options);

    res.json({
      success: true,
      schedules: result.schedules,
      total: result.total,
    });
  } catch (error: any) {
    logger.error('[Fulfillment] Get schedules error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_get_schedules',
      message: error.message
    });
  }
});

/**
 * POST /api/fulfillment/notifications
 * Create fulfillment notification
 * Permission: Tenant admin/owner or platform admin
 */
router.post('/notifications', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const parsed = createNotificationSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten()
      });
    }

    const { orderId, customerId, type, channel, content, scheduledAt } = parsed.data;

    // Get order to verify tenant access
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: { tenant_id: true, metadata: true }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found',
        message: 'Order not found'
      });
    }

    // Determine pickup tenant for multi-location orders
    const metadata = order.metadata as any || {};
    const pickupTenantId = metadata.is_multi_location_order 
      ? metadata.pickup_tenant_id 
      : order.tenant_id;

    // Verify user has access to the pickup location
    if (!canPerformSupportActions(user)) {
      const userTenant = await prisma.user_tenants.findFirst({
        where: {
          user_id: user.userId,
          tenant_id: pickupTenantId,
          role: {
            in: ['OWNER', 'ADMIN']
          }
        }
      });

      if (!userTenant) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'You do not have permission to create notifications for this order'
        });
      }
    }

    const notification = await fulfillmentService.createNotification(
      orderId,
      pickupTenantId,
      customerId,
      type,
      channel,
      content,
      scheduledAt ? new Date(scheduledAt) : undefined
    );

    res.json({
      success: true,
      notification,
    });
  } catch (error: any) {
    logger.error('[Fulfillment] Create notification error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_create_notification',
      message: error.message
    });
  }
});

/**
 * GET /api/fulfillment/stats/:tenantId
 * Get location fulfillment statistics
 * Permission: Tenant members or platform admin
 */
router.get('/stats/:tenantId', authenticateToken, async (req: Request, res: Response) => {
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
          message: 'You do not have access to this location'
        });
      }
    }

    const stats = await fulfillmentService.getLocationFulfillmentStats(tenantId);

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    logger.error('[Fulfillment] Get stats error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_get_stats',
      message: error.message
    });
  }
});

/**
 * PUT /api/fulfillment/schedule/:orderId/status
 * Update fulfillment schedule status
 * Permission: Tenant members for pickup location, platform admin
 */
router.put('/schedule/:orderId/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const user = (req as any).user;
    const { status, notes } = req.body;

    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'invalid_status',
        message: 'Status is required and must be a string'
      });
    }

    // Get order to determine pickup location
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        tenant_id: true,
        metadata: true,
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found',
        message: 'Order not found'
      });
    }

    // Determine pickup tenant for multi-location orders
    const metadata = order.metadata as any || {};
    const pickupTenantId = metadata.is_multi_location_order 
      ? metadata.pickup_tenant_id 
      : order.tenant_id;

    // Verify user has access to the pickup location
    if (!canPerformSupportActions(user)) {
      const userTenant = await prisma.user_tenants.findFirst({
        where: {
          user_id: user.userId,
          tenant_id: pickupTenantId,
          role: {
            in: ['OWNER', 'ADMIN', 'MEMBER']
          }
        }
      });

      if (!userTenant) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'You do not have permission to update fulfillment status for this order'
        });
      }
    }

    const schedule = await fulfillmentService.updateScheduleStatus(orderId, status, notes);

    res.json({
      success: true,
      schedule,
    });
  } catch (error: any) {
    logger.error('[Fulfillment] Update schedule status error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_update_status',
      message: error.message
    });
  }
});

export default router;
