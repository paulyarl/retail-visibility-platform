/**
 * Orders API Routes
 * Phase 3A: Order Management Foundation
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { generateOrderNumber } from '../utils/order-number-generator';
import { calculateLineItem, calculateOrderTotals } from '../utils/order-calculations';

const router = Router();

/**
 * POST /api/orders
 * Create a new order (cart checkout)
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      tenant_id,
      customer,
      items,
      shipping_address,
      billing_address,
      notes,
      source = 'web',
    } = req.body;

    // Validation
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id_required',
        message: 'Tenant ID is required',
      });
    }

    if (!customer?.email) {
      return res.status(400).json({
        success: false,
        error: 'customer_email_required',
        message: 'Customer email is required',
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'items_required',
        message: 'At least one item is required',
      });
    }

    // Verify tenant exists and user has access
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    // Generate unique order number
    const order_number = await generateOrderNumber(tenant_id);

    // Calculate line item totals
    const calculatedItems = await Promise.all(
      items.map(async (item: any) => {
        // Optionally fetch inventory item for current price
        let unit_price_cents = item.unit_price_cents;
        let sku = item.sku;
        let name = item.name;
        let description = item.description;
        let image_url = item.image_url;

        // If variant is specified, fetch variant data
        if (item.variant_id) {
          const variant = await prisma.product_variants.findUnique({
            where: { id: item.variant_id },
          });

          if (variant) {
            unit_price_cents = unit_price_cents || variant.sale_price_cents || variant.price_cents || 0;
            sku = sku || variant.sku;
            // Append variant name to product name
            name = item.variant_name ? `${name} (${item.variant_name})` : name;
          }
        } else if (item.inventory_item_id) {
          const inventoryItem = await prisma.inventory_items.findUnique({
            where: { id: item.inventory_item_id },
          });

          if (inventoryItem) {
            unit_price_cents = unit_price_cents || inventoryItem.price_cents || 0;
            sku = sku || inventoryItem.sku;
            name = name || inventoryItem.name;
            description = description || inventoryItem.description;
            image_url = image_url || inventoryItem.image_url;
          }
        }

        const calculation = calculateLineItem(
          item.quantity || 1,
          unit_price_cents,
          0, // Tax rate (can be configured per tenant)
          item.discount_cents || 0
        );

        return {
          inventory_item_id: item.inventory_item_id || null,
          sku,
          name,
          description,
          image_url,
          variant_id: item.variant_id || null,
          variant_name: item.variant_name || null,
          variant_attributes: item.variant_attributes || null,
          ...calculation,
        };
      })
    );

    // Calculate order totals
    const totals = calculateOrderTotals(
      calculatedItems,
      req.body.shipping_cents || 0,
      req.body.discount_cents || 0
    );

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.orders.create({
        data: {
          id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tenant_id,
          order_number,
          order_status: 'draft',
          payment_status: 'pending',
          fulfillment_status: 'unfulfilled',
          
          // Customer info
          customer_email: customer.email,
          customer_name: customer.name || null,
          customer_phone: customer.phone || null,
          
          // Addresses
          shipping_address_line1: shipping_address?.line1 || null,
          shipping_address_line2: shipping_address?.line2 || null,
          shipping_city: shipping_address?.city || null,
          shipping_state: shipping_address?.state || null,
          shipping_postal_code: shipping_address?.postal_code || null,
          shipping_country: shipping_address?.country || 'US',
          
          billing_address_line1: billing_address?.line1 || shipping_address?.line1 || null,
          billing_address_line2: billing_address?.line2 || shipping_address?.line2 || null,
          billing_city: billing_address?.city || shipping_address?.city || null,
          billing_state: billing_address?.state || shipping_address?.state || null,
          billing_postal_code: billing_address?.postal_code || shipping_address?.postal_code || null,
          billing_country: billing_address?.country || shipping_address?.country || 'US',
          
          // Totals
          subtotal_cents: totals.subtotal_cents,
          tax_cents: totals.tax_cents,
          shipping_cents: totals.shipping_cents,
          discount_cents: totals.discount_cents,
          total_cents: totals.total_cents,
          currency: 'USD',
          
          // Metadata
          notes: notes || null,
          source,
          metadata: req.body.metadata || {},
          ip_address: req.ip || null,
          user_agent: req.get('user-agent') || null,
          
          // Required fields
          updated_at: new Date(),
        },
      });

      // Create order items
      await tx.order_items.createMany({
        data: calculatedItems.map((item) => ({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          order_id: newOrder.id,
          ...item,
          updated_at: new Date(),
        })),
      });

      // Create initial status history
      await tx.order_status_history.create({
        data: {
          id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          order_id: newOrder.id,
          from_status: null,
          to_status: 'draft',
          changed_by_user_id: user.userId || null,
          changed_by_name: user.name || user.email || null,
          reason: 'Order created',
          metadata: {},
        },
      });

      return newOrder;
    });

    // Fetch complete order with items
    const completeOrder = await prisma.orders.findUnique({
      where: { id: order.id },
      include: {
        order_items: true,
        order_status_history: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    res.status(201).json({
      success: true,
      order: completeOrder,
    });
  } catch (error: any) {
    console.error('[Orders] Create error:', error);
    res.status(500).json({
      success: false,
      error: 'order_creation_failed',
      message: 'Failed to create order',
      details: error.message,
    });
  }
});

/**
 * GET /api/orders
 * List orders with filtering and pagination
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      tenant_id,
      status,
      payment_status,
      customer_email,
      from_date,
      to_date,
      page = '1',
      limit = '20',
    } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id_required',
        message: 'Tenant ID is required',
      });
    }

    // Build where clause
    const where: any = {
      tenant_id: tenant_id as string,
    };

    if (status) {
      where.order_status = status;
    }

    if (payment_status) {
      where.payment_status = payment_status;
    }

    if (customer_email) {
      where.customer_email = {
        contains: customer_email as string,
        mode: 'insensitive',
      };
    }

    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) {
        where.created_at.gte = new Date(from_date as string);
      }
      if (to_date) {
        where.created_at.lte = new Date(to_date as string);
      }
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch orders
    const [orders, total] = await Promise.all([
      prisma.orders.findMany({
        where,
        include: {
          order_items: true,
        },
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.orders.count({ where }),
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('[Orders] List error:', error);
    res.status(500).json({
      success: false,
      error: 'order_list_failed',
      message: 'Failed to fetch orders',
      details: error.message,
    });
  }
});

/**
 * GET /api/orders/:id
 * Get order details
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.orders.findUnique({
      where: { id },
      include: {
        order_items: true,
        payments: true,
        shipments: true,
        order_status_history: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found',
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error: any) {
    console.error('[Orders] Get error:', error);
    res.status(500).json({
      success: false,
      error: 'order_fetch_failed',
      message: 'Failed to fetch order',
      details: error.message,
    });
  }
});

/**
 * PATCH /api/orders/:id
 * Update order status
 */
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { order_status, notes, internal_notes } = req.body;

    // Fetch current order
    const currentOrder = await prisma.orders.findUnique({
      where: { id },
    });

    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found',
        message: 'Order not found',
      });
    }

    // Update order in transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order
      const order = await tx.orders.update({
        where: { id },
        data: {
          order_status: order_status || currentOrder.order_status,
          notes: notes !== undefined ? notes : currentOrder.notes,
          internal_notes: internal_notes !== undefined ? internal_notes : currentOrder.internal_notes,
          
          // Update status timestamps
          ...(order_status === 'confirmed' && !currentOrder.confirmed_at && {
            confirmed_at: new Date(),
          }),
          ...(order_status === 'paid' && !currentOrder.paid_at && {
            paid_at: new Date(),
          }),
          ...(order_status === 'delivered' && !currentOrder.fulfilled_at && {
            fulfilled_at: new Date(),
          }),
          ...(order_status === 'cancelled' && !currentOrder.cancelled_at && {
            cancelled_at: new Date(),
          }),
        },
      });

      // Create status history if status changed
      if (order_status && order_status !== currentOrder.order_status) {
        await tx.order_status_history.create({
          data: {
            id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            order_id: id,
            from_status: currentOrder.order_status,
            to_status: order_status,
            changed_by_user_id: user.userId || null,
            changed_by_name: user.name || user.email || null,
            reason: req.body.reason || 'Status updated',
            notes: notes || null,
            metadata: {},
          },
        });
      }

      return order;
    });

    res.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error('[Orders] Update error:', error);
    res.status(500).json({
      success: false,
      error: 'order_update_failed',
      message: 'Failed to update order',
      details: error.message,
    });
  }
});

export default router;
