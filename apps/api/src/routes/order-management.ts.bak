/**
 * Order Management API Routes
 * 
 * Provides endpoints for multi-location order management:
 * - Get orders by location
 * - Location-specific order statistics
 * - Order status updates with location tracking
 * - Organization-wide order analytics
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { OrderManagementService } from '../services/OrderManagementService';
import { authenticateToken } from '../middleware/auth';
import { canPerformSupportActions } from '../utils/platform-admin';
import { z } from 'zod';

const router = Router();

// Get singleton instance
const orderManagementService = OrderManagementService.getInstance();

// Validation schemas
const updateOrderStatusSchema = z.object({
  status: z.string().min(1),
  notes: z.string().optional(),
});

const getOrdersSchema = z.object({
  status: z.string().optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * GET /api/order-management/location/:tenantId/orders
 * Get orders for a specific location
 * Permission: Tenant members or platform admin
 */
router.get('/location/:tenantId/orders', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const user = (req as any).user;
    const query = getOrdersSchema.safeParse(req.query);

    if (!query.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_query',
        details: query.error.flatten()
      });
    }

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
      status: query.data.status,
      limit: query.data.limit,
      offset: query.data.offset,
      startDate: query.data.startDate ? new Date(query.data.startDate) : undefined,
      endDate: query.data.endDate ? new Date(query.data.endDate) : undefined,
    };

    const result = await orderManagementService.getOrdersForLocation(tenantId, options);

    res.json({
      success: true,
      orders: result.orders,
      total: result.total,
      hasMore: (options.offset || 0) + (options.limit || 50) < result.total,
    });
  } catch (error: any) {
    console.error('[Order Management] Get location orders error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_orders',
      message: error.message
    });
  }
});

/**
 * GET /api/order-management/location/:tenantId/stats
 * Get order statistics for a specific location
 * Permission: Tenant members or platform admin
 */
router.get('/location/:tenantId/stats', authenticateToken, async (req: Request, res: Response) => {
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

    const stats = await orderManagementService.getLocationOrderStats(tenantId);

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('[Order Management] Get location stats error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_stats',
      message: error.message
    });
  }
});

/**
 * GET /api/order-management/location/:tenantId/attention
 * Get orders needing attention at a location
 * Permission: Tenant members or platform admin
 */
router.get('/location/:tenantId/attention', authenticateToken, async (req: Request, res: Response) => {
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

    const attentionOrders = await orderManagementService.getLocationOrdersNeedingAttention(tenantId);

    res.json({
      success: true,
      ...attentionOrders,
    });
  } catch (error: any) {
    console.error('[Order Management] Get attention orders error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_attention_orders',
      message: error.message
    });
  }
});

/**
 * GET /api/order-management/organization/:organizationId/stats
 * Get order statistics for an entire organization
 * Permission: Organization members or platform admin
 */
router.get('/organization/:organizationId/stats', authenticateToken, async (req: Request, res: Response) => {
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

    const stats = await orderManagementService.getOrganizationOrderStats(organizationId);

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('[Order Management] Get organization stats error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_organization_stats',
      message: error.message
    });
  }
});

/**
 * PUT /api/order-management/orders/:orderId/status
 * Update order status with location tracking
 * Permission: Tenant members for pickup location, platform admin
 */
router.put('/orders/:orderId/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const user = (req as any).user;
    const parsed = updateOrderStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten()
      });
    }

    const { status, notes } = parsed.data;

    // Get the order to determine pickup location
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
          } // Viewers cannot update order status
        }
      });

      if (!userTenant) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'You do not have permission to update orders at this location'
        });
      }
    }

    const updatedOrder = await orderManagementService.updateOrderStatus(
      orderId,
      status,
      user.userId,
      notes
    );

    res.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error('[Order Management] Update order status error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_update_status',
      message: error.message
    });
  }
});

/**
 * GET /api/order-management/orders/:orderId
 * Get detailed order information with location tracking
 * Permission: Tenant members for pickup location, platform admin
 */
router.get('/orders/:orderId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const user = (req as any).user;

    // Get the order to determine pickup location
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
          }
        },
        order_items: true,
        payments: true,
        shipments: {
          select: {
            id: true,
            tracking_number: true,
            carrier: true,
            tracking_url: true,
            shipment_status: true,
            shipped_at: true,
          },
          orderBy: {
            created_at: 'desc',
          },
        },
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found',
        message: 'Order not found'
      });
    }

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
            in: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']
          }
        }
      });

      if (!userTenant) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'You do not have access to this order'
        });
      }
    }

    // Format order response with location information
    const formattedOrder = {
      id: order.id,
      orderNumber: order.order_number,
      pickupTenantId,
      pickupTenantName: metadata.is_multi_location_order 
        ? (metadata.pickup_tenant_name || order.tenants?.name || 'Unknown')
        : (order.tenants?.name || 'Unknown'),
      paymentTenantId: metadata.is_hero_payment ? metadata.payment_tenant_id : order.tenant_id,
      paymentTenantName: metadata.is_hero_payment 
        ? (metadata.payment_tenant_name || order.tenants?.name || 'Unknown')
        : (order.tenants?.name || 'Unknown'),
      isHeroPayment: !!metadata.is_hero_payment,
      isMultiLocationOrder: !!metadata.is_multi_location_order,
      orderStatus: order.order_status,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      shippingAddress: {
        line1: order.shipping_address_line1,
        line2: order.shipping_address_line2,
        city: order.shipping_city,
        state: order.shipping_state,
        postalCode: order.shipping_postal_code,
        country: order.shipping_country,
      },
      billingAddress: {
        line1: order.billing_address_line1,
        line2: order.billing_address_line2,
        city: order.billing_city,
        state: order.billing_state,
        postalCode: order.billing_postal_code,
        country: order.billing_country,
      },
      fulfillmentMethod: metadata.fulfillment_method,
      trackingNumber: order.shipments?.[0]?.tracking_number || null,
      trackingUrl: order.shipments?.[0]?.tracking_url || null,
      carrier: order.shipments?.[0]?.carrier || null,
      shipmentStatus: order.shipments?.[0]?.shipment_status || null,
      shippedAt: order.shipments?.[0]?.shipped_at || null,
      source: order.source,
      notes: order.notes,
      totals: {
        subtotal: order.subtotal_cents,
        tax: order.tax_cents,
        shipping: order.shipping_cents,
        total: order.total_cents,
        depositCents: order.deposit_cents,
        remainingBalance: order.remaining_balance_cents,
        checkoutMode: order.checkout_mode,
        depositPercentage: order.deposit_percentage,
      },
      items: order.order_items,
      payments: order.payments,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      metadata: order.metadata,
    };

    res.json({
      success: true,
      order: formattedOrder,
    });
  } catch (error: any) {
    console.error('[Order Management] Get order error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_order',
      message: error.message
    });
  }
});

export default router;
