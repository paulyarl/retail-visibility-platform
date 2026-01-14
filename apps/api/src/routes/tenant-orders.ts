import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { RefundService } from '../services/refunds/RefundService';

const router = Router();

// GET /api/tenants/:tenantId/orders - Get all orders for a tenant
router.get('/tenants/:tenantId/orders', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { 
      status, 
      fulfillmentStatus, 
      fulfillmentMethod,
      search,
      page = '1',
      limit = '20',
      sortBy = 'created_at',
      sortOrder = 'desc',
      archived
    } = req.query;

    // Build where clause
    const where: any = {
      tenant_id: tenantId
    };

    // Build AND conditions array for complex filtering
    const andConditions: any[] = [];

    // Filter by archived status
    // Note: We can only filter FOR archived orders in the query
    // Filtering OUT archived orders needs to be done in post-processing
    // because Prisma's NOT with JSON path doesn't handle null properly
    if (archived === 'true') {
      // Only show archived orders
      andConditions.push({
        metadata: {
          path: ['archived'],
          equals: true
        }
      });
    }

    // Filter by fulfillment status
    if (fulfillmentStatus && typeof fulfillmentStatus === 'string') {
      where.fulfillment_status = fulfillmentStatus;
    }

    // Filter by fulfillment method (stored in metadata)
    if (fulfillmentMethod && typeof fulfillmentMethod === 'string') {
      andConditions.push({
        metadata: {
          path: ['fulfillment_method'],
          equals: fulfillmentMethod
        }
      });
    }

    // Search by order number or customer email
    if (search && typeof search === 'string') {
      andConditions.push({
        OR: [
          { order_number: { contains: search, mode: 'insensitive' } },
          { customer_email: { contains: search, mode: 'insensitive' } },
          { customer_name: { contains: search, mode: 'insensitive' } }
        ]
      });
    }

    // Apply AND conditions if any exist
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const orderBy: any = {};
    if (sortBy === 'created_at' || sortBy === 'paid_at' || sortBy === 'total_cents') {
      orderBy[sortBy] = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.created_at = 'desc';
    }

    // Debug logging
    console.log('[Orders API] Query params:', { tenantId, page, limit, archived, fulfillmentStatus });
    console.log('[Orders API] AND conditions count:', andConditions.length);
    console.log('[Orders API] Where clause:', JSON.stringify(where, null, 2));
    console.log('[Orders API] Pagination:', { pageNum, limitNum, skip });

    // Fetch orders with related data
    const [orders, totalCount] = await Promise.all([
      prisma.orders.findMany({
        where,
        include: {
          tenants: {
            select: {
              name: true,
              metadata: true,
            },
          },
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
          payments: {
            select: {
              id: true,
              gateway_transaction_id: true,
              payment_method: true,
              amount_cents: true,
              payment_status: true,
            },
          },
          shipments: {
            select: {
              tracking_number: true,
              carrier: true,
              tracking_url: true,
            },
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
          },
        },
        orderBy,
        skip,
        take: limitNum
      }),
      prisma.orders.count({ where })
    ]);

    console.log('[Orders API] Found orders:', orders.length, 'Total count:', totalCount);

    // Filter out archived orders in post-processing if not explicitly requesting them
    let filteredOrders = orders;
    let adjustedTotalCount = totalCount;
    
    if (archived !== 'true') {
      // Count archived orders in the result set
      const archivedCount = orders.filter(order => {
        const metadata = order.metadata as any || {};
        return metadata.archived === true;
      }).length;
      
      // Filter out archived orders
      filteredOrders = orders.filter(order => {
        const metadata = order.metadata as any || {};
        return metadata.archived !== true;
      });
      
      // Adjust total count (this is approximate since we don't know total archived across all pages)
      // For better accuracy, we should do a separate count query, but this works for now
      if (archivedCount > 0) {
        console.log('[Orders API] Filtered out', archivedCount, 'archived orders from current page');
      }
    }

    console.log('[Orders API] After filtering:', filteredOrders.length, 'orders');

    // Transform orders to response format
    const ordersResponse = filteredOrders.map(order => {
      const payment = order.payments[0];
      const metadata = order.metadata as any || {};
      
      return {
        orderId: order.id,
        orderNumber: order.order_number,
        orderStatus: order.order_status,
        fulfillmentStatus: order.fulfillment_status,
        fulfillmentMethod: metadata.fulfillment_method || null,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        shippingAddress: order.shipping_address_line1 ? {
          addressLine1: order.shipping_address_line1,
          addressLine2: order.shipping_address_line2,
          city: order.shipping_city,
          state: order.shipping_state,
          postalCode: order.shipping_postal_code,
          country: order.shipping_country,
        } : null,
        billingAddress: order.billing_address_line1 ? {
          addressLine1: order.billing_address_line1,
          addressLine2: order.billing_address_line2,
          city: order.billing_city,
          state: order.billing_state,
          postalCode: order.billing_postal_code,
          country: order.billing_country,
        } : null,
        subtotal: order.subtotal_cents,
        shipping: order.shipping_cents,
        tax: order.tax_cents,
        total: order.total_cents,
        itemCount: order.order_items.length,
        items: order.order_items.map(item => ({
          id: item.id,
          name: item.inventory_items?.name || item.name,
          sku: item.inventory_items?.sku || item.sku,
          quantity: item.quantity,
          unitPrice: item.unit_price_cents,
          total: item.total_cents,
          imageUrl: item.inventory_items?.image_url || null
        })),
        payment: payment ? {
          id: payment.id,
          gatewayTransactionId: payment.gateway_transaction_id,
          method: payment.payment_method,
          amount: payment.amount_cents,
          status: payment.payment_status
        } : null,
        createdAt: order.created_at,
        paidAt: order.paid_at,
        notes: order.notes
      };
    });

    res.json({
      success: true,
      data: {
        orders: ordersResponse,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching tenant orders:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch orders'
    });
  }
});

// GET /api/tenants/:tenantId/orders/:orderId - Get single order detail
router.get('/tenants/:tenantId/orders/:orderId', authenticateToken, async (req, res) => {
  try {
    const { tenantId, orderId } = req.params;

    // Get order with all related data
    const order = await prisma.orders.findFirst({
      where: {
        id: orderId,
        tenant_id: tenantId
      },
      include: {
        order_items: {
          include: {
            inventory_items: {
              select: {
                name: true,
                sku: true,
                image_url: true
              }
            }
          }
        },
        payments: true,
        shipments: {
          select: {
            tracking_number: true,
            carrier: true,
            tracking_url: true
          },
          orderBy: {
            created_at: 'desc'
          },
          take: 1
        },
        refunds: {
          orderBy: {
            created_at: 'desc'
          }
        },
        tenants: {
          select: {
            name: true,
            metadata: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Order not found'
      });
    }

    const payment = order.payments[0];
    const metadata = order.metadata as any || {};
    const tenantMetadata = order.tenants.metadata as any || {};

    const orderDetail = {
      orderId: order.id,
      orderNumber: order.order_number,
      orderStatus: order.order_status,
      fulfillmentStatus: order.fulfillment_status,
      fulfillmentMethod: metadata.fulfillment_method || null,
      tenantName: order.tenants.name,
      tenantLogo: tenantMetadata.logo_url || null,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      shippingAddress: order.shipping_address_line1 ? {
        addressLine1: order.shipping_address_line1,
        addressLine2: order.shipping_address_line2,
        city: order.shipping_city,
        state: order.shipping_state,
        postalCode: order.shipping_postal_code,
        country: order.shipping_country,
      } : null,
      billingAddress: order.billing_address_line1 ? {
        addressLine1: order.billing_address_line1,
        addressLine2: order.billing_address_line2,
        city: order.billing_city,
        state: order.billing_state,
        postalCode: order.billing_postal_code,
        country: order.billing_country,
      } : null,
      subtotal: order.subtotal_cents,
      shipping: order.shipping_cents,
      tax: order.tax_cents,
      discount: order.discount_cents,
      total: order.total_cents,
      items: order.order_items.map(item => ({
        id: item.id,
        name: item.inventory_items?.name || item.name,
        sku: item.inventory_items?.sku || item.sku,
        quantity: item.quantity,
        unitPrice: item.unit_price_cents,
        total: item.total_cents,
        imageUrl: item.inventory_items?.image_url || null
      })),
      payment: payment ? {
        id: payment.id,
        gatewayTransactionId: payment.gateway_transaction_id,
        method: payment.payment_method,
        amount: payment.amount_cents,
        status: payment.payment_status
      } : null,
      createdAt: order.created_at,
      paidAt: order.paid_at,
      notes: order.notes,
      internalNotes: order.internal_notes,
      trackingNumber: order.shipments?.[0]?.tracking_number || null,
      refunds: order.refunds?.map(refund => ({
        id: refund.id,
        amount: refund.amount_cents,
        status: refund.refund_status,
        reason: refund.refund_reason,
        gatewayRefundId: refund.gateway_refund_id,
        createdAt: refund.created_at,
        completedAt: refund.completed_at
      })) || []
    };

    res.json({
      success: true,
      data: orderDetail
    });
  } catch (error) {
    console.error('Error fetching order detail:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch order detail'
    });
  }
});

// PUT /api/tenants/:tenantId/orders/:orderId/fulfillment - Update fulfillment status
router.put('/tenants/:tenantId/orders/:orderId/fulfillment', authenticateToken, async (req, res) => {
  try {
    const { tenantId, orderId } = req.params;
    const { fulfillmentStatus, trackingNumber, cancellationReason, shippingProvider } = req.body;

    // Validate fulfillment status
    const validStatuses = ['pending', 'processing', 'fulfilled', 'cancelled'];
    if (fulfillmentStatus && !validStatuses.includes(fulfillmentStatus)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_status',
        message: 'Invalid fulfillment status'
      });
    }

    // Check if order exists and belongs to tenant
    const existingOrder = await prisma.orders.findFirst({
      where: {
        id: orderId,
        tenant_id: tenantId
      }
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Order not found'
      });
    }

    // Update order fulfillment status
    const updateData: any = {};
    if (fulfillmentStatus) {
      updateData.fulfillment_status = fulfillmentStatus;
      if (fulfillmentStatus === 'fulfilled') {
        updateData.fulfilled_at = new Date();
        // Add shipping provider if provided
        if (shippingProvider) {
          updateData.shipping_provider = shippingProvider;
        }
      } else if (fulfillmentStatus === 'cancelled') {
        updateData.cancelled_at = new Date();
        // Add tenant cancellation note with reason
        const timestamp = new Date().toISOString();
        const reason = cancellationReason || 'No reason provided';
        const cancellationNote = `[${timestamp}] STORE CANCELLATION: ${reason}`;
        const existingNotes = existingOrder.internal_notes || '';
        updateData.internal_notes = existingNotes 
          ? `${existingNotes}\n\n${cancellationNote}`
          : cancellationNote;

        // Process refund if order was paid
        if (existingOrder.payment_status === 'paid') {
          console.log('[Tenant Orders] Order is paid, initiating refund for order:', orderId);
          
          // Get payment record
          const payment = await prisma.payments.findFirst({
            where: { order_id: orderId },
            orderBy: { created_at: 'desc' },
          });

          if (payment) {
            // Process refund asynchronously
            RefundService.processRefund({
              orderId: orderId,
              paymentId: payment.id,
              tenantId: tenantId,
              reason: reason,
              initiatedBy: (req as any).user?.userId || 'tenant',
            }).then(refundResult => {
              if (refundResult.success) {
                console.log('[Tenant Orders] Refund processed successfully:', refundResult.refundId);
              } else {
                console.error('[Tenant Orders] Refund failed:', refundResult.error);
              }
            }).catch(error => {
              console.error('[Tenant Orders] Refund processing error:', error);
            });
          } else {
            console.warn('[Tenant Orders] No payment record found for paid order:', orderId);
          }
        }
      }
    }

    const updatedOrder = await prisma.orders.update({
      where: { id: orderId },
      data: updateData
    });

    // Handle tracking number update (stored in shipments table)
    let shipmentTrackingNumber = null;
    if (trackingNumber !== undefined) {
      // Find or create shipment record
      const existingShipment = await prisma.shipments.findFirst({
        where: {
          order_id: orderId,
          tenant_id: tenantId
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      if (existingShipment) {
        // Update existing shipment
        const updatedShipment = await prisma.shipments.update({
          where: { id: existingShipment.id },
          data: { tracking_number: trackingNumber }
        });
        shipmentTrackingNumber = updatedShipment.tracking_number;
      } else if (trackingNumber) {
        // Create new shipment record with address from order
        const newShipment = await prisma.shipments.create({
          data: {
            id: `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            order_id: orderId,
            tenant_id: tenantId,
            tracking_number: trackingNumber,
            shipment_status: 'pending',
            address_line1: existingOrder.shipping_address_line1 || 'N/A',
            address_line2: existingOrder.shipping_address_line2,
            city: existingOrder.shipping_city || 'N/A',
            state: existingOrder.shipping_state || 'N/A',
            postal_code: existingOrder.shipping_postal_code || '00000',
            country: existingOrder.shipping_country || 'US',
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        shipmentTrackingNumber = newShipment.tracking_number;
      }
    }

    res.json({
      success: true,
      data: {
        orderId: updatedOrder.id,
        fulfillmentStatus: updatedOrder.fulfillment_status,
        trackingNumber: shipmentTrackingNumber
      }
    });
  } catch (error) {
    console.error('Error updating order fulfillment:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update order fulfillment'
    });
  }
});

// PUT /api/tenants/:tenantId/orders/:orderId/archive - Archive an order
router.put('/tenants/:tenantId/orders/:orderId/archive', authenticateToken, async (req, res) => {
  try {
    const { tenantId, orderId } = req.params;
    const { archived } = req.body;

    // Verify order exists and belongs to tenant
    const order = await prisma.orders.findFirst({
      where: {
        id: orderId,
        tenant_id: tenantId
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Order not found'
      });
    }

    // Only allow archiving fulfilled or cancelled orders
    if (order.fulfillment_status !== 'fulfilled' && order.fulfillment_status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'invalid_status',
        message: 'Only fulfilled or cancelled orders can be archived'
      });
    }

    // Update order metadata to mark as archived
    const metadata = (order.metadata as any) || {};
    metadata.archived = archived === true;

    const updatedOrder = await prisma.orders.update({
      where: { id: orderId },
      data: {
        metadata: metadata,
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        orderId: updatedOrder.id,
        archived: metadata.archived
      }
    });
  } catch (error) {
    console.error('Error archiving order:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to archive order'
    });
  }
});

export default router;
