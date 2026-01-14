/**
 * Guest Checkout API Routes
 * For testing checkout flow without authentication
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { generateOrderNumber, generateOrderItemId, generatePaymentId } from '../lib/id-generator';
import { calculateLineItem, calculateOrderTotals } from '../utils/order-calculations';
import { customAlphabet } from 'nanoid';

const router = Router();

/**
 * POST /api/checkout/orders
 * Create a new order without authentication (guest checkout)
 */
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const {
      customer,
      items,
      shipping_address,
      billing_address,
      notes,
      source = 'web',
      fulfillment_method,
    } = req.body;

    // Validation
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

    // Extract tenant_id from the first item (all items should be from same tenant)
    let tenant_id: string | null = null;
    
    // Try to get tenant_id from items
    for (const item of items) {
      if (item.id) {
        const inventoryItem = await prisma.inventory_items.findUnique({
          where: { id: item.id },
          select: { tenant_id: true },
        });
        if (inventoryItem?.tenant_id) {
          tenant_id = inventoryItem.tenant_id;
          break;
        }
      }
    }

    // Fallback to demo-tenant if no tenant found (for testing)
    if (!tenant_id) {
      tenant_id = 'demo-tenant';
      
      // Check if demo tenant exists, create if not
      const demoTenant = await prisma.tenants.findUnique({
        where: { id: tenant_id },
      });
      
      if (!demoTenant) {
        await prisma.tenants.create({
          data: {
            id: tenant_id,
            name: 'Demo Store',
            slug: 'demo-store',
            subscription_tier: 'starter',
            subscription_status: 'active',
          },
        });
      }
    }

    // Validate items and check stock availability
    for (const item of items) {
      if (!item.sku || !item.name || !item.quantity || !item.unit_price_cents) {
        return res.status(400).json({
          success: false,
          error: 'invalid_item',
          message: 'Each item must have sku, name, quantity, and unit_price_cents',
        });
      }

      // Check inventory stock if item has an ID
      if (item.id) {
        const inventoryItem = await prisma.inventory_items.findUnique({
          where: { id: item.id },
        });

        if (!inventoryItem) {
          return res.status(400).json({
            success: false,
            error: 'item_not_found',
            message: `Item ${item.name} not found in inventory`,
          });
        }

        if (inventoryItem.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            error: 'insufficient_stock',
            message: `Insufficient stock for ${item.name}. Available: ${inventoryItem.stock}, Requested: ${item.quantity}`,
            available_stock: inventoryItem.stock,
            requested_quantity: item.quantity,
          });
        }
      }
    }

    // Generate order number
    const order_number = await generateOrderNumber('demo-tenant');

    // Calculate totals
    const line_items = items.map((item: any) => {
      const calculation = calculateLineItem(item.quantity, item.unit_price_cents);
      return {
        ...calculation,
        sku: item.sku,
        name: item.name,
        description: item.description,
        image_url: item.image_url,
      };
    });
    const totals = calculateOrderTotals(line_items);

    // Generate order ID
    const generateOrderId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);
    
    // Create order
    const order = await prisma.orders.create({
      data: {
        id: `ord-${generateOrderId()}`,
        order_number,
        tenant_id,
        customer_email: customer.email,
        customer_name: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || null,
        customer_phone: customer.phone || null,
        shipping_address_line1: shipping_address?.addressLine1,
        shipping_address_line2: shipping_address?.addressLine2,
        shipping_city: shipping_address?.city,
        shipping_state: shipping_address?.state,
        shipping_postal_code: shipping_address?.postalCode,
        shipping_country: shipping_address?.country,
        billing_address_line1: billing_address?.addressLine1 || shipping_address?.addressLine1,
        billing_address_line2: billing_address?.addressLine2 || shipping_address?.addressLine2,
        billing_city: billing_address?.city || shipping_address?.city,
        billing_state: billing_address?.state || shipping_address?.state,
        billing_postal_code: billing_address?.postalCode || shipping_address?.postalCode,
        billing_country: billing_address?.country || shipping_address?.country,
        order_status: 'draft',
        source,
        notes,
        metadata: fulfillment_method ? { fulfillment_method } : {},
        updated_at: new Date(),
        // Order totals
        subtotal_cents: totals.subtotal_cents,
        tax_cents: totals.tax_cents,
        shipping_cents: totals.shipping_cents,
        total_cents: totals.total_cents,
        // Line items
        order_items: {
          create: line_items.map((item: any, index: number) => ({
            id: generateOrderItemId(),
            sku: item.sku,
            name: item.name,
            description: item.description,
            image_url: item.image_url,
            quantity: item.quantity,
            unit_price_cents: item.unit_price_cents,
            list_price_cents: items[index]?.list_price_cents || null, // Capture original price if on sale
            subtotal_cents: item.subtotal_cents,
            tax_cents: item.tax_cents || 0,
            discount_cents: item.discount_cents || 0,
            total_cents: item.total_cents,
            inventory_item_id: items[index]?.id, // Link to inventory item
            updated_at: new Date(),
          })),
        },
      },
      include: {
        order_items: true,
      },
    });

    // Create payment record for the order
    const payment = await prisma.payments.create({
      data: {
        id: generatePaymentId(),
        tenant_id: order.tenant_id,
        order_id: order.id,
        gateway_type: 'paypal',
        payment_method: 'paypal',
        amount_cents: order.total_cents,
        platform_fee_cents: Math.round(order.total_cents * 0.03), // 3% platform fee
        gateway_fee_cents: 0,
        net_amount_cents: order.total_cents,
        payment_status: 'pending',
        updated_at: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        total_cents: order.total_cents,
        created_at: order.created_at,
        order_items: (order as any).order_items,
      },
      payment: {
        id: payment.id,
        status: payment.payment_status,
        amount_cents: payment.amount_cents,
      },
    });
  } catch (error) {
    console.error('Checkout order creation error:', error);
    res.status(500).json({
      success: false,
      error: 'order_creation_failed',
      message: 'Failed to create order',
    });
  }
});

/**
 * GET /api/checkout/orders/:id
 * Get order details without authentication
 */
router.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.orders.findUnique({
      where: { id },
      include: {
        order_items: true,
        payments: true,
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
  } catch (error) {
    console.error('Checkout order retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'order_retrieval_failed',
      message: 'Failed to retrieve order',
    });
  }
});

export default router;
