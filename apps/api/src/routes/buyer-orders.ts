import { Router } from 'express';
import { prisma } from '../prisma';
import { RefundService } from '../services/refunds/RefundService';

const router = Router();

// Get orders for a buyer by email or phone
// api/orders/buyer?email=
router.get('/buyer', async (req, res) => {
  try {
    const { email, phone } = req.query;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        error: 'missing_identifier',
        message: 'Either email or phone is required',
      });
    }

    // console.log('[Buyer Orders] Fetching orders for:', { email, phone });

    // Find orders by customer email or phone
    // Include both paid and draft orders so customers can see/cancel incomplete orders
    const orders = await prisma.orders.findMany({
      where: {
        OR: [
          email ? { customer_email: email as string } : {},
          phone ? { customer_phone: phone as string } : {},
        ],
        order_status: { in: ['paid', 'draft'] },
      },
      include: {
        order_items: {
          include: {
            inventory_items: {
              select: {
                name: true,
                sku: true,
                image_url: true,
              },
            },
          },
        },
        tenants: true,
        payments: {
          take: 1,
        },
        refunds: {
          orderBy: {
            created_at: 'desc',
          },
        },
        shipments: {
          orderBy: {
            created_at: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Fetch variants for all orders by tenant and parent_item_id
    const parentItemIds = [...new Set(orders.flatMap(order => 
      order.order_items.map(item => item.inventory_item_id)
    ))];
    
    const variants = parentItemIds.length > 0 ? await prisma.product_variants.findMany({
      where: { 
        parent_item_id: { in: parentItemIds.filter(id => id !== null) as string[] },
        tenant_id: orders[0]?.tenant_id 
      },
      select: {
        id: true,
        sku: true,
        variant_name: true,
        image_url: true,
      },
    }) : [];
    
    // Create maps for both variant_id and sku lookup
    const variantMapById = new Map(variants.map(v => [v.id, v]));
    const variantMapBySku = new Map(variants.map(v => [v.sku, v]));

    // Transform to buyer-friendly format
    const ordersList = orders.map((order) => {
        const tenant = order.tenants;
        const payment = order.payments[0];
        const shipment = order.shipments?.[0];

        return {
          orderId: order.id,
          orderNumber: order.order_number,
          paymentId: payment?.id || null,
          gatewayTransactionId: payment?.gateway_transaction_id || null,
          gatewayType: payment?.gateway_type || null,
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantLogo: (tenant.metadata as any)?.logo_url || null,
          status: order.order_status,
          fulfillmentStatus: order.fulfillment_status,
          fulfilledAt: order.fulfilled_at,
          orderDate: order.created_at,
          paidAt: order.paid_at || order.created_at,
          total: order.total_cents,
          subtotal: order.subtotal_cents,
          platformFee: 0, // Platform fee not stored in orders table
          fulfillmentFee: order.shipping_cents || 0,
          fulfillmentMethod: (order.metadata as any)?.fulfillment_method || null,
          trackingNumber: shipment?.tracking_number || order.shipping_provider || undefined,
          shippingProvider: order.shipping_provider || undefined,
          customerInfo: {
            email: order.customer_email,
            phone: order.customer_phone || '',
            firstName: order.customer_name?.split(' ')[0] || '',
            lastName: order.customer_name?.split(' ').slice(1).join(' ') || '',
          },
          shippingAddress: order.shipping_address_line1 ? {
            addressLine1: order.shipping_address_line1,
            addressLine2: order.shipping_address_line2 || undefined,
            city: order.shipping_city || '',
            state: order.shipping_state || '',
            postalCode: order.shipping_postal_code || '',
            country: order.shipping_country || 'US',
          } : null,
          items: order.order_items.map((item) => {
            // Try to find variant by variant_id first, then by sku
            let variant = null;
            if (item.variant_id) {
              variant = variantMapById.get(item.variant_id);
            } else if (item.sku) {
              variant = variantMapBySku.get(item.sku);
            }
            
            return {
              id: item.id,
              name: variant ? 
                `${item.inventory_items?.name || item.name || ''} - ${variant.variant_name}` : 
                (item.inventory_items?.name || item.name || ''),
              sku: variant?.sku || item.inventory_items?.sku || item.sku || '',
              quantity: item.quantity,
              unitPrice: item.unit_price_cents,
              imageUrl: variant?.image_url || item.inventory_items?.image_url || item.image_url || null,
            };
          }),
          itemCount: order.order_items.reduce((sum: number, item) => sum + item.quantity, 0),
          refunds: order.refunds?.map(refund => ({
            id: refund.id,
            amount: refund.amount_cents,
            status: refund.refund_status,
            reason: refund.refund_reason,
            gatewayRefundId: refund.gateway_refund_id,
            createdAt: refund.created_at,
            completedAt: refund.completed_at,
          })) || [],
          internalNotes: order.internal_notes || undefined,
          // Extract cancellation reason from internal_notes
          cancellationReason: order.internal_notes?.match(/(?:STORE|BUYER) CANCELLATION: (.+?)(?:\n|$)/)?.[1] || undefined,
          // Deposit order fields
          checkoutMode: order.checkout_mode || undefined,
          depositCents: order.deposit_cents || undefined,
          remainingBalanceCents: order.remaining_balance_cents || undefined,
          pickupDeadline: order.pickup_deadline || undefined,
        };
      });

    // console.log(`[Buyer Orders] Found ${ordersList.length} orders`);

    res.json({
      success: true,
      orders: ordersList,
      count: ordersList.length,
    });
  } catch (error) {
    console.error('[Buyer Orders] Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'fetch_failed',
      message: 'Failed to fetch orders',
    });
  }
});

// Get orders for a customer by email (with pagination)
// api/orders/customer/:email
router.get('/customer/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // console.log('[Buyer Orders] Fetching orders for customer:', { email, page, limit });

    // Also check for customer_id from JWT token for logged-in users
    let customerId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { CustomerTokenService } = await import('../services/CustomerTokenService');
        const tokenService = CustomerTokenService.getInstance();
        const payload = tokenService.verifyAccessToken(authHeader.substring(7));
        if (payload) {
          customerId = payload.customerId;
        }
      } catch {}
    }

    const where: any = {
      OR: [
        { customer_email: email.toLowerCase() },
        ...(customerId ? [{ customer_id: customerId }] : []),
      ],
      order_status: { in: ['paid', 'draft', 'confirmed', 'processing', 'shipped', 'delivered'] },
    };

    const [orders, total] = await Promise.all([
      prisma.orders.findMany({
        where,
        include: {
          order_items: {
            include: {
              inventory_items: {
                select: { name: true, sku: true, image_url: true },
              },
            },
          },
          tenants: true,
          payments: { take: 1 },
          refunds: { orderBy: { created_at: 'desc' } },
          shipments: { orderBy: { created_at: 'desc' }, take: 1 },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.orders.count({ where }),
    ]);

    // Fetch variants for order items
    const parentItemIds = [...new Set(orders.flatMap(order =>
      order.order_items.map(item => item.inventory_item_id)
    ))];

    const variants = parentItemIds.length > 0 ? await prisma.product_variants.findMany({
      where: {
        parent_item_id: { in: parentItemIds.filter(id => id !== null) as string[] },
      },
      select: { id: true, sku: true, variant_name: true, image_url: true },
    }) : [];

    const variantMapById = new Map(variants.map(v => [v.id, v]));

    const ordersList = orders.map((order) => {
      const tenant = order.tenants;
      const payment = order.payments[0];
      const shipment = order.shipments?.[0];

      return {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentId: payment?.id || null,
        gatewayTransactionId: payment?.gateway_transaction_id || null,
        gatewayType: payment?.gateway_type || null,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantLogo: (tenant.metadata as any)?.logo_url || null,
        status: order.order_status,
        fulfillmentStatus: order.fulfillment_status,
        fulfilledAt: order.fulfilled_at,
        orderDate: order.created_at,
        paidAt: order.paid_at || order.created_at,
        total: order.total_cents,
        paymentAmount: payment?.amount_cents || undefined,
        subtotal: order.subtotal_cents,
        platformFee: 0,
        fulfillmentFee: order.shipping_cents || 0,
        fulfillmentMethod: (order.metadata as any)?.fulfillment_method || null,
        trackingNumber: shipment?.tracking_number || order.shipping_provider || undefined,
        shippingProvider: order.shipping_provider || undefined,
        customerInfo: {
          email: order.customer_email,
          phone: order.customer_phone || '',
          firstName: order.customer_name?.split(' ')[0] || '',
          lastName: order.customer_name?.split(' ').slice(1).join(' ') || '',
        },
        shippingAddress: order.shipping_address_line1 ? {
          addressLine1: order.shipping_address_line1,
          addressLine2: order.shipping_address_line2 || undefined,
          city: order.shipping_city || '',
          state: order.shipping_state || '',
          postalCode: order.shipping_postal_code || '',
          country: order.shipping_country || 'US',
        } : null,
        items: order.order_items.map((item) => {
          let variant = null;
          if (item.variant_id) {
            variant = variantMapById.get(item.variant_id);
          }
          return {
            id: item.id,
            name: variant ?
              `${item.inventory_items?.name || item.name || ''} - ${variant.variant_name}` :
              (item.inventory_items?.name || item.name || ''),
            sku: variant?.sku || item.inventory_items?.sku || item.sku || '',
            quantity: item.quantity,
            unitPrice: item.unit_price_cents,
            imageUrl: variant?.image_url || item.inventory_items?.image_url || item.image_url || null,
          };
        }),
        itemCount: order.order_items.reduce((sum: number, item) => sum + item.quantity, 0),
        refunds: order.refunds?.map(refund => ({
          id: refund.id,
          amount: refund.amount_cents,
          status: refund.refund_status,
          reason: refund.refund_reason,
          gatewayRefundId: refund.gateway_refund_id,
          createdAt: refund.created_at,
          completedAt: refund.completed_at,
        })) || [],
        checkoutMode: order.checkout_mode || undefined,
        depositCents: order.deposit_cents || undefined,
        remainingBalanceCents: order.remaining_balance_cents || undefined,
        pickupDeadline: order.pickup_deadline || undefined,
        depositPercentage: order.deposit_percentage || undefined,
      };
    });

    res.json({
      success: true,
      orders: ordersList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Buyer Orders] Error fetching customer orders:', error);
    res.status(500).json({
      success: false,
      error: 'fetch_failed',
      message: 'Failed to fetch customer orders',
    });
  }
});

// Get single order details by order ID
// api/orders/:orderId
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { email, phone } = req.query;

    // console.log('[Buyer Orders] Fetching order:', { orderId, email, phone });

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        order_items: {
          include: {
            inventory_items: {
              select: {
                name: true,
                sku: true,
                image_url: true,
              },
            },
          },
        },
        tenants: true,
        payments: {
          take: 1,
        },
        refunds: {
          orderBy: {
            created_at: 'desc',
          },
        },
        order_status_history: {
          orderBy: {
            created_at: 'desc',
          },
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

    // Verify order belongs to the buyer (if email/phone provided)
    if (email || phone) {
      const isOwner = 
        (email && order.customer_email === email) ||
        (phone && order.customer_phone === phone);

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: 'unauthorized',
          message: 'This order does not belong to you',
        });
      }
    }

    // Fetch variants for order by tenant and parent_item_id
    const parentItemIds = [...new Set(order.order_items.map(item => item.inventory_item_id))];
    
    const variants = parentItemIds.length > 0 ? await prisma.product_variants.findMany({
      where: { 
        parent_item_id: { in: parentItemIds.filter(id => id !== null) as string[] },
        tenant_id: order.tenant_id 
      },
      select: {
        id: true,
        sku: true,
        variant_name: true,
        image_url: true,
      },
    }) : [];
    
    // Create maps for both variant_id and sku lookup
    const variantMapById = new Map(variants.map(v => [v.id, v]));
    const variantMapBySku = new Map(variants.map(v => [v.sku, v]));

    const payment = order.payments[0];
    const tenant = order.tenants;

    const orderDetail = {
      orderId: order.id,
      orderNumber: order.order_number,
      paymentId: payment?.id || null,
      gatewayTransactionId: payment?.gateway_transaction_id || null,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantLogo: (tenant.metadata as any)?.logo_url || null,
      status: order.order_status,
      fulfillmentStatus: order.fulfillment_status,
      fulfilledAt: order.fulfilled_at,
      orderDate: order.created_at,
      paidAt: order.paid_at || order.created_at,
      total: order.total_cents,
      subtotal: order.subtotal_cents,
      platformFee: 0,
      fulfillmentFee: order.shipping_cents || 0,
      fulfillmentMethod: (order.metadata as any)?.fulfillment_method || null,
      // Deposit order fields
      checkoutMode: order.checkout_mode || 'full_payment',
      depositCents: order.deposit_cents || 0,
      remainingBalanceCents: order.remaining_balance_cents || 0,
      pickupDeadline: order.pickup_deadline || null,
      depositForfeitedAt: order.deposit_forfeited_at || null,
      depositPercentage: order.deposit_percentage || null,
      customerInfo: {
        email: order.customer_email,
        phone: order.customer_phone || '',
        firstName: order.customer_name?.split(' ')[0] || '',
        lastName: order.customer_name?.split(' ').slice(1).join(' ') || '',
      },
      shippingAddress: order.shipping_address_line1 ? {
        addressLine1: order.shipping_address_line1,
        addressLine2: order.shipping_address_line2 || undefined,
        city: order.shipping_city || '',
        state: order.shipping_state || '',
        postalCode: order.shipping_postal_code || '',
        country: order.shipping_country || 'US',
      } : null,
      items: order.order_items.map((item) => {
        // Try to find variant by variant_id first, then by sku
        let variant = null;
        if (item.variant_id) {
          variant = variantMapById.get(item.variant_id);
        } else if (item.sku) {
          variant = variantMapBySku.get(item.sku);
        }
        
        return {
          id: item.id,
          name: variant ? 
            `${item.inventory_items?.name || item.name || ''} - ${variant.variant_name}` : 
            (item.inventory_items?.name || item.name || ''),
          sku: variant?.sku || item.inventory_items?.sku || item.sku || '',
          quantity: item.quantity,
          unitPrice: item.unit_price_cents,
          imageUrl: variant?.image_url || item.inventory_items?.image_url || item.image_url || null,
        };
      }),
      itemCount: order.order_items.reduce((sum: number, item) => sum + item.quantity, 0),
      refunds: order.refunds?.map(refund => ({
        id: refund.id,
        amount: refund.amount_cents,
        status: refund.refund_status,
        reason: refund.refund_reason,
        gatewayRefundId: refund.gateway_refund_id,
        createdAt: refund.created_at,
        completedAt: refund.completed_at,
      })) || [],
      statusHistory: order.order_status_history?.map(entry => ({
        id: entry.id,
        from_status: entry.from_status,
        to_status: entry.to_status,
        changed_by_name: entry.changed_by_name,
        reason: entry.reason,
        notes: entry.notes,
        created_at: entry.created_at,
      })) || [],
      internalNotes: order.internal_notes,
      // Extract cancellation reason from internal_notes
      cancellationReason: order.internal_notes?.match(/(?:STORE|BUYER) CANCELLATION: (.+?)(?:\n|$)/)?.[1] || undefined,
    };

    res.json({
      success: true,
      order: orderDetail,
    });
  } catch (error) {
    console.error('[Buyer Orders] Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'fetch_failed',
      message: 'Failed to fetch order details',
    });
  }
});

// Mark order as picked up (buyer or store owner)
router.patch('/:orderId/pickup', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { email, phone, tenantId } = req.body;

    // console.log('[Buyer Orders] Marking order as picked up:', { orderId, email, phone, tenantId });

    // Fetch the order with payment info
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customer_email: true,
        customer_phone: true,
        customer_name: true,
        tenant_id: true,
        fulfillment_status: true,
        total_cents: true,
        checkout_mode: true,
        deposit_cents: true,
        metadata: true,
        payments: {
          where: { is_deposit_payment: true },
          select: {
            id: true,
            amount_cents: true,
            platform_fee_cents: true,
            payment_status: true,
          },
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

    // Verify authorization (buyer or store owner)
    const isBuyer = 
      (email && order.customer_email === email) ||
      (phone && order.customer_phone === phone);
    
    const isStoreOwner = tenantId && order.tenant_id === tenantId;

    if (!isBuyer && !isStoreOwner) {
      return res.status(403).json({
        success: false,
        error: 'unauthorized',
        message: 'You are not authorized to update this order',
      });
    }

    // Check if order is a fulfillable method (pickup, delivery, or shipping)
    const metadata = order.metadata as any;
    const allowedMethods = ['pickup', 'delivery', 'shipping'];
    if (!allowedMethods.includes(metadata?.fulfillment_method)) {
      return res.status(400).json({
        success: false,
        error: 'not_fulfillable_order',
        message: 'This order cannot be confirmed as fulfilled',
      });
    }

    // Update fulfillment status
    const updatedOrder = await prisma.orders.update({
      where: { id: orderId },
      data: {
        fulfillment_status: 'fulfilled',
        fulfilled_at: new Date(),
        updated_at: new Date(),
      },
    });

    // console.log('[Buyer Orders] Order marked as picked up:', orderId);

    // Record platform revenue for deposit fulfillment
    // For deposit orders, the platform fee is captured when the order is fulfilled
    const depositPayment = order?.payments?.[0];
    if (depositPayment && depositPayment.platform_fee_cents && depositPayment.platform_fee_cents > 0) {
      try {
        const { stripeConnectService } = await import('../services/payments/StripeConnectService');
        const isActive = await stripeConnectService.isRevenueCollectionActive();
        if (isActive) {
          await stripeConnectService.recordRevenueTransaction({
            tenantId: order.tenant_id,
            orderId: order.id,
            paymentId: depositPayment.id,
            transactionType: 'transaction_fee',
            grossAmountCents: depositPayment.amount_cents,
            platformFeeCents: depositPayment.platform_fee_cents,
            gatewayFeeCents: 0,
            netAmountCents: depositPayment.amount_cents - depositPayment.platform_fee_cents,
          });
          // console.log('[Buyer Orders] Recorded deposit revenue:', depositPayment.platform_fee_cents, 'cents');
        }
      } catch (revenueError) {
        console.error('[Buyer Orders] Failed to record deposit revenue:', revenueError);
        // Don't fail the fulfillment if revenue recording fails
      }
    }

    // Send order fulfilled notification (async, don't wait)
    const { getOrderNotificationService } = await import('../services/OrderNotificationService');
    getOrderNotificationService().notifyOrderFulfilled({
      tenantId: order.tenant_id,
      orderId: orderId,
      customerEmail: order.customer_email,
      customerName: order.customer_name || undefined,
      amount: order.total_cents,
    }).catch(err => console.error('[Buyer Orders] Failed to send fulfillment notification:', err));

    res.json({
      success: true,
      message: 'Order marked as picked up',
      order: {
        id: updatedOrder.id,
        fulfillmentStatus: updatedOrder.fulfillment_status,
        fulfilledAt: updatedOrder.fulfilled_at,
      },
    });
  } catch (error) {
    console.error('[Buyer Orders] Error marking order as picked up:', error);
    res.status(500).json({
      success: false,
      error: 'update_failed',
      message: 'Failed to update order status',
    });
  }
});

// Cancel order (buyer only - before fulfillment)
router.patch('/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { email, phone, cancellationReason } = req.body;

    // console.log('[Buyer Orders] Cancelling order:', { orderId, email, phone, hasReason: !!cancellationReason });

    // Fetch the order
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customer_email: true,
        customer_phone: true,
        customer_name: true,
        tenant_id: true,
        fulfillment_status: true,
        order_status: true,
        total_cents: true,
        internal_notes: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found',
        message: 'Order not found',
      });
    }

    // Verify buyer authorization
    const isBuyer = 
      (email && order.customer_email === email) ||
      (phone && order.customer_phone === phone);

    if (!isBuyer) {
      return res.status(403).json({
        success: false,
        error: 'unauthorized',
        message: 'You are not authorized to cancel this order',
      });
    }

    // Check if order can be cancelled
    if (order.fulfillment_status === 'fulfilled') {
      return res.status(400).json({
        success: false,
        error: 'already_fulfilled',
        message: 'Cannot cancel an order that has already been fulfilled',
      });
    }

    if (order.fulfillment_status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'already_cancelled',
        message: 'This order has already been cancelled',
      });
    }

    // Prepare cancellation note
    const timestamp = new Date().toISOString();
    const cancellationNote = cancellationReason 
      ? `[${timestamp}] BUYER CANCELLATION: ${cancellationReason}`
      : `[${timestamp}] BUYER CANCELLATION: No reason provided`;
    
    const existingNotes = order.internal_notes || '';
    const updatedNotes = existingNotes 
      ? `${existingNotes}\n\n${cancellationNote}`
      : cancellationNote;

    // Update order status to cancelled
    const updatedOrder = await prisma.orders.update({
      where: { id: orderId },
      data: {
        fulfillment_status: 'cancelled',
        cancelled_at: new Date(),
        internal_notes: updatedNotes,
        updated_at: new Date(),
      },
    });

    // console.log('[Buyer Orders] Order cancelled:', orderId, cancellationReason ? `Reason: ${cancellationReason}` : 'No reason provided');

    // Restore stock for cancelled orders (both paid and draft)
    try {
      const { getStockService } = await import('../services/StockService');
      const stockService = getStockService(prisma);
      await stockService.restoreStockForOrder(orderId);
      // console.log(`[Buyer Orders] Stock restored for cancelled order: ${orderId}`);
    } catch (stockError) {
      console.error(`[Buyer Orders] Failed to restore stock for cancelled order ${orderId}:`, stockError);
      // Don't fail the cancellation if stock restoration fails
    }

    // Send order cancelled notification (async, don't wait)
    const { getOrderNotificationService } = await import('../services/OrderNotificationService');
    getOrderNotificationService().notifyOrderCancelled({
      tenantId: order.tenant_id,
      orderId: orderId,
      customerEmail: order.customer_email,
      customerName: order.customer_name || undefined,
      amount: order.total_cents,
      reason: cancellationReason,
      cancelledBy: 'buyer',
    }).catch(err => console.error('[Buyer Orders] Failed to send cancellation notification:', err));

    // Process refund if order was paid
    if (order.order_status === 'paid') {
      // console.log('[Buyer Orders] Order is paid, initiating refund for order:', orderId);
      
      // Get payment record
      const payment = await prisma.payments.findFirst({
        where: { order_id: orderId },
        orderBy: { created_at: 'desc' },
      });

      if (payment) {
        // Process refund asynchronously
        const reason = cancellationReason || 'Buyer cancelled order';
        RefundService.processRefund({
          orderId: orderId,
          paymentId: payment.id,
          tenantId: order.tenant_id,
          reason: reason,
          initiatedBy: 'buyer',
        }).then(refundResult => {
          if (refundResult.success) {
            // console.log('[Buyer Orders] Refund processed successfully:', refundResult.refundId);
          } else {
            console.error('[Buyer Orders] Refund failed:', refundResult.error);
          }
        }).catch(error => {
          console.error('[Buyer Orders] Refund processing error:', error);
        });
      } else {
        console.warn('[Buyer Orders] No payment record found for paid order:', orderId);
      }
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        id: updatedOrder.id,
        fulfillmentStatus: updatedOrder.fulfillment_status,
        cancelledAt: updatedOrder.cancelled_at,
        cancellationReason: cancellationReason || 'No reason provided',
      },
    });
  } catch (error) {
    console.error('[Buyer Orders] Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'cancel_failed',
      message: 'Failed to cancel order',
    });
  }
});

export default router;
