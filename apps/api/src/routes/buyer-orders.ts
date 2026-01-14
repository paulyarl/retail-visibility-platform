import { Router } from 'express';
import { prisma } from '../prisma';
import { RefundService } from '../services/refunds/RefundService';

const router = Router();

// Get orders for a buyer by email or phone
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

    console.log('[Buyer Orders] Fetching orders for:', { email, phone });

    // Find orders by customer email or phone
    const orders = await prisma.orders.findMany({
      where: {
        OR: [
          email ? { customer_email: email as string } : {},
          phone ? { customer_phone: phone as string } : {},
        ],
        order_status: 'paid',
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
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantLogo: (tenant.metadata as any)?.logo_url || null,
          status: order.order_status,
          fulfillmentStatus: order.fulfillment_status,
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
          items: order.order_items.map((item) => ({
            id: item.id,
            name: item.inventory_items?.name || item.name || '',
            sku: item.inventory_items?.sku || item.sku || '',
            quantity: item.quantity,
            unitPrice: item.unit_price_cents,
            imageUrl: item.inventory_items?.image_url || item.image_url || null,
          })),
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
        };
      });

    console.log(`[Buyer Orders] Found ${ordersList.length} orders`);

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

// Get single order details by order ID
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { email, phone } = req.query;

    console.log('[Buyer Orders] Fetching order:', { orderId, email, phone });

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
      orderDate: order.created_at,
      paidAt: order.paid_at || order.created_at,
      total: order.total_cents,
      subtotal: order.subtotal_cents,
      platformFee: 0,
      fulfillmentFee: order.shipping_cents || 0,
      fulfillmentMethod: (order.metadata as any)?.fulfillment_method || null,
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
      items: order.order_items.map((item) => ({
        id: item.id,
        name: item.inventory_items?.name || item.name || '',
        sku: item.inventory_items?.sku || item.sku || '',
        quantity: item.quantity,
        unitPrice: item.unit_price_cents,
        imageUrl: item.inventory_items?.image_url || item.image_url || null,
      })),
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
      internalNotes: order.internal_notes,
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

    console.log('[Buyer Orders] Marking order as picked up:', { orderId, email, phone, tenantId });

    // Fetch the order
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customer_email: true,
        customer_phone: true,
        tenant_id: true,
        fulfillment_status: true,
        metadata: true,
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

    // Check if order is pickup
    const metadata = order.metadata as any;
    if (metadata?.fulfillment_method !== 'pickup') {
      return res.status(400).json({
        success: false,
        error: 'not_pickup_order',
        message: 'This order is not a pickup order',
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

    console.log('[Buyer Orders] Order marked as picked up:', orderId);

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

    console.log('[Buyer Orders] Cancelling order:', { orderId, email, phone, hasReason: !!cancellationReason });

    // Fetch the order
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customer_email: true,
        customer_phone: true,
        tenant_id: true,
        fulfillment_status: true,
        order_status: true,
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

    console.log('[Buyer Orders] Order cancelled:', orderId, cancellationReason ? `Reason: ${cancellationReason}` : 'No reason provided');

    // Process refund if order was paid
    if (order.order_status === 'paid') {
      console.log('[Buyer Orders] Order is paid, initiating refund for order:', orderId);
      
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
            console.log('[Buyer Orders] Refund processed successfully:', refundResult.refundId);
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
