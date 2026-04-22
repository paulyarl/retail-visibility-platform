/**
 * Guest Checkout API Routes
 * For testing checkout flow without authentication
 * 
 * Tier 3 Commitment: Collects 10-15% deposit at checkout, remaining balance at pickup
 * Tier 4 Enterprise: Full payment or deposit option (shopper choice)
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { generateOrderNumber, generateOrderItemId, generatePaymentId,generateOrderId } from '../lib/id-generator';
import { calculateLineItem, calculateOrderTotals } from '../utils/order-calculations';
import { customAlphabet } from 'nanoid';
import {
  getCheckoutModeForTier,
  calculateDeposit,
  getDepositPercentageForTenant,
  CheckoutMode,
} from '../utils/deposit-calculator';

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
            subscription_tier: 'commitment', // Changed to commitment for testing
            subscription_status: 'active',
          },
        });
      }
    }

    // Get tenant subscription tier to determine checkout mode
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id },
      select: { subscription_tier: true },
    });
    
    const tenantTier = tenant?.subscription_tier || 'starter';
    
    // Tier validation: Only commitment, professional, and enterprise tiers can use checkout
    // Storefront (tier 2) and discovery (tier 1) can display products but cannot process orders
    const effectiveTier = tenantTier.startsWith('trial_') ? tenantTier.replace('trial_', '') : tenantTier;
    const hasCheckoutAccess = effectiveTier === 'commitment' || 
                              effectiveTier === 'professional' || 
                              effectiveTier === 'enterprise';
    
    if (!hasCheckoutAccess) {
      return res.status(403).json({
        success: false,
        error: 'checkout_not_available',
        message: 'This store does not have checkout enabled. Please contact the store directly.',
        tier: tenantTier,
      });
    }
    
    const checkoutMode: CheckoutMode = getCheckoutModeForTier(tenantTier);

    // Validate items and check stock availability
    // Fetch item details from database - frontend only needs to send id and quantity
    const validatedItems: Array<{
      id: string;
      sku: string;
      name: string;
      quantity: number;
      unit_price_cents: number;
      list_price_cents?: number;
      description?: string;
      image_url?: string;
    }> = [];

    for (const item of items) {
      // Only id and quantity are required from frontend
      if (!item.id || !item.quantity) {
        return res.status(400).json({
          success: false,
          error: 'invalid_item',
          message: 'Each item must have id and quantity',
        });
      }

      // Fetch item details from inventory
      const inventoryItem = await prisma.inventory_items.findUnique({
        where: { id: item.id },
      });

      if (!inventoryItem) {
        return res.status(400).json({
          success: false,
          error: 'item_not_found',
          message: `Item with id ${item.id} not found in inventory`,
        });
      }

      if (inventoryItem.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: 'insufficient_stock',
          message: `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.stock}, Requested: ${item.quantity}`,
          available_stock: inventoryItem.stock,
          requested_quantity: item.quantity,
        });
      }

      // Use database values for the order
      // If item is on sale (sale_price_cents is not null), use sale price; otherwise use regular price
      const isOnSale = inventoryItem.sale_price_cents !== null && inventoryItem.sale_price_cents !== undefined;
      const unitPriceCents = isOnSale ? inventoryItem.sale_price_cents! : inventoryItem.price_cents;
      const listPriceCents = inventoryItem.price_cents; // Always store original price

      validatedItems.push({
        id: item.id,
        sku: inventoryItem.sku || item.id,
        name: inventoryItem.name,
        quantity: item.quantity,
        unit_price_cents: unitPriceCents,
        list_price_cents: listPriceCents,
        description: inventoryItem.description || undefined,
        image_url: inventoryItem.image_url || undefined,
      });
    }

    // Generate order number
    const order_number = await generateOrderNumber(tenant_id);

    // Calculate totals using validated items from database
    const line_items = validatedItems.map((item) => {
      const calculation = calculateLineItem(item.quantity, item.unit_price_cents);
      return {
        ...calculation,
        sku: item.sku,
        name: item.name,
        description: item.description,
        image_url: item.image_url,
        list_price_cents: item.list_price_cents,
      };
    });
    const totals = calculateOrderTotals(line_items);

    // Calculate deposit for Tier 3 commitment checkout
    let depositCalculation = null;
    let paymentAmount = totals.total_cents; // Default to full payment
    
    if (checkoutMode === 'deposit') {
      const depositPercentage = await getDepositPercentageForTenant(tenant_id, prisma);
      depositCalculation = calculateDeposit(totals.total_cents, depositPercentage);
      paymentAmount = depositCalculation.depositCents;
      
      console.log('[Checkout] Tier 3 deposit calculation:', {
        total: totals.total_cents,
        depositPercentage: depositCalculation.depositPercentage,
        depositCents: depositCalculation.depositCents,
        remainingBalance: depositCalculation.remainingBalanceCents,
        pickupDeadline: depositCalculation.pickupDeadline,
      });
    }

    // Generate order ID
    // Generate order ID first to avoid circular reference
    const orderId = generateOrderId(tenant_id);
    
    // Create order
    const order = await prisma.orders.create({
      data: {
        id: orderId,
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
        // Tier 3 deposit fields
        checkout_mode: checkoutMode,
        deposit_percentage: depositCalculation?.depositPercentage || null,
        deposit_cents: depositCalculation?.depositCents || 0,
        remaining_balance_cents: depositCalculation?.remainingBalanceCents || 0,
        pickup_deadline: depositCalculation?.pickupDeadline || null,
        // Line items
        order_items: {
          create: line_items.map((item, index) => ({
            id: generateOrderItemId(orderId),
            sku: item.sku,
            name: item.name,
            description: item.description,
            image_url: item.image_url,
            quantity: item.quantity,
            unit_price_cents: item.unit_price_cents,
            list_price_cents: validatedItems[index]?.list_price_cents || null, // Capture original price if on sale
            subtotal_cents: item.subtotal_cents,
            tax_cents: item.tax_cents || 0,
            discount_cents: item.discount_cents || 0,
            total_cents: item.total_cents,
            inventory_item_id: validatedItems[index]?.id, // Link to inventory item
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
        id: generatePaymentId(order.tenant_id),
        tenant_id: order.tenant_id,
        order_id: order.id,
        gateway_type: 'paypal',
        payment_method: 'paypal',
        // For deposit orders, collect deposit amount; for full payment, collect total
        amount_cents: paymentAmount,
        platform_fee_cents: Math.round(paymentAmount * 0.03), // 3% platform fee
        gateway_fee_cents: 0,
        net_amount_cents: paymentAmount,
        payment_status: 'pending',
        updated_at: new Date(),
        // Tier 3 deposit payment fields
        is_deposit_payment: checkoutMode === 'deposit',
        deposit_percentage: depositCalculation?.depositPercentage || null,
      },
    });

    // Send order placed notification (async, don't wait)
    const { getOrderNotificationService } = await import('../services/OrderNotificationService');
    getOrderNotificationService().notifyOrderPlaced({
      tenantId: order.tenant_id,
      orderId: order.id,
      orderNumber: order.order_number,
      customerEmail: customer.email,
      customerName: customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || undefined,
      amount: paymentAmount,
    }).catch(err => console.error('[Checkout] Failed to send order notification:', err));

    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        total_cents: order.total_cents,
        created_at: order.created_at,
        order_items: (order as any).order_items,
        // Include deposit info for frontend
        checkout_mode: checkoutMode,
        deposit_cents: order.deposit_cents,
        remaining_balance_cents: order.remaining_balance_cents,
        pickup_deadline: order.pickup_deadline,
      },
      payment: {
        id: payment.id,
        status: payment.payment_status,
        amount_cents: payment.amount_cents,
        is_deposit_payment: payment.is_deposit_payment,
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
