import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { PaymentGatewayFactory } from '../services/payments/PaymentGatewayFactory';
import { PlatformFeeCalculator } from '../services/payments/PlatformFeeCalculator';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/orders/:orderId/payments/authorize
 * Authorize payment (hold funds without capturing)
 */
router.post('/:orderId/payments/authorize', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod, gatewayType = 'stripe', metadata = {} } = req.body;

    if (!paymentMethod?.token) {
      return res.status(400).json({
        success: false,
        error: 'payment_method_required',
        message: 'Payment method token is required',
      });
    }

    // Get order
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: { tenants: true },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found',
        message: 'Order not found',
      });
    }

    // Check authorization
    const user = (req as any).user;
    if (order.tenant_id !== user.tenantId && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'unauthorized',
        message: 'Not authorized to process payment for this order',
      });
    }

    // Get payment gateway
    const gateway = await PaymentGatewayFactory.createFromTenant(
      order.tenant_id,
      gatewayType
    );

    // Authorize payment
    const result = await gateway.authorize(
      order.total_cents,
      order.currency,
      paymentMethod,
      {
        orderId: order.id,
        orderNumber: order.order_number,
        tenantId: order.tenant_id,
        ...metadata,
      }
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'authorization_failed',
        message: result.error || 'Payment authorization failed',
        details: result.gatewayResponse,
      });
    }

    // Calculate platform fees
    const fees = await PlatformFeeCalculator.calculateFees(
      order.tenant_id,
      order.total_cents,
      result.gatewayFeeCents || 0
    );

    // Create payment record
    const payment = await prisma.payments.create({
      data: {
        id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order_id: order.id,
        tenant_id: order.tenant_id,
        amount_cents: order.total_cents,
        currency: order.currency,
        payment_method: paymentMethod.type === 'card' ? 'credit_card' : paymentMethod.type,
        payment_status: 'authorized',
        gateway_type: gatewayType,
        gateway_transaction_id: result.transactionId,
        gateway_authorization_id: result.authorizationId,
        gateway_fee_cents: result.gatewayFeeCents || 0,
        platform_fee_cents: fees.platformFeeCents,
        platform_fee_percentage: fees.platformFeePercentage,
        platform_fee_fixed_cents: fees.platformFeeFixedCents,
        total_fees_cents: fees.totalFeesCents,
        net_amount_cents: fees.netAmountCents,
        fee_waived: fees.feeWaived,
        fee_waived_reason: fees.feeWaivedReason,
        gateway_response: result.gatewayResponse,
        authorized_at: new Date(),
        authorization_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        metadata: metadata,
        ip_address: req.ip,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Update order payment status
    await prisma.orders.update({
      where: { id: orderId },
      data: {
        payment_status: 'authorized',
        updated_at: new Date(),
      },
    });

    res.json({
      success: true,
      payment: payment,
      fees: {
        gateway: fees.gatewayFeeCents,
        platform: fees.platformFeeCents,
        total: fees.totalFeesCents,
        net: fees.netAmountCents,
        waived: fees.feeWaived,
      },
    });
  } catch (error: any) {
    console.error('[Payments] Authorization error:', error);
    res.status(500).json({
      success: false,
      error: 'authorization_error',
      message: error.message || 'Failed to authorize payment',
    });
  }
});

/**
 * POST /api/orders/:orderId/payments/capture
 * Capture previously authorized payment
 */
router.post('/:orderId/payments/capture', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { paymentId, amount } = req.body;

    // Get order and payment
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: paymentId ? { id: paymentId } : { payment_status: 'authorized' },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    if (!order || !order.payments.length) {
      return res.status(404).json({
        success: false,
        error: 'payment_not_found',
        message: 'No authorized payment found for this order',
      });
    }

    const payment = order.payments[0];

    // Check authorization
    const user = (req as any).user;
    if (order.tenant_id !== user.tenantId && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'unauthorized',
        message: 'Not authorized to capture payment for this order',
      });
    }

    // Check if authorization expired
    if (payment.authorization_expires_at && new Date() > payment.authorization_expires_at) {
      return res.status(400).json({
        success: false,
        error: 'authorization_expired',
        message: 'Payment authorization has expired',
      });
    }

    // Get payment gateway
    const gateway = await PaymentGatewayFactory.createFromTenant(
      order.tenant_id,
      (payment.gateway_type as any) || 'stripe'
    );

    // Capture payment
    const captureAmount = amount || payment.amount_cents;
    const result = await gateway.capture(
      payment.gateway_authorization_id!,
      captureAmount
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'capture_failed',
        message: result.error || 'Payment capture failed',
        details: result.gatewayResponse,
      });
    }

    // Update payment record
    const updatedPayment = await prisma.payments.update({
      where: { id: payment.id },
      data: {
        payment_status: 'paid',
        amount_cents: captureAmount,
        captured_at: new Date(),
        gateway_response: result.gatewayResponse,
        updated_at: new Date(),
      },
    });

    // Update order payment status
    await prisma.orders.update({
      where: { id: orderId },
      data: {
        payment_status: 'paid',
        paid_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Create status history entry
    await prisma.order_status_history.create({
      data: {
        id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order_id: orderId,
        from_status: order.order_status,
        to_status: order.order_status,
        changed_by_user_id: user.userId,
        changed_by_name: user.email,
        reason: 'Payment captured',
        notes: `Payment ${payment.id} captured for ${(captureAmount / 100).toFixed(2)} ${order.currency}`,
        metadata: {},
        created_at: new Date(),
      },
    });

    res.json({
      success: true,
      payment: updatedPayment,
      captured_amount: captureAmount,
    });
  } catch (error: any) {
    console.error('[Payments] Capture error:', error);
    res.status(500).json({
      success: false,
      error: 'capture_error',
      message: error.message || 'Failed to capture payment',
    });
  }
});

/**
 * POST /api/orders/:orderId/payments/charge
 * Direct charge (authorize + capture in one step)
 */
router.post('/:orderId/payments/charge', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod, gatewayType = 'stripe', metadata = {} } = req.body;

    if (!paymentMethod?.token) {
      return res.status(400).json({
        success: false,
        error: 'payment_method_required',
        message: 'Payment method token is required',
      });
    }

    // Get order
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: { tenants: true },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found',
        message: 'Order not found',
      });
    }

    // Check authorization
    const user = (req as any).user;
    if (order.tenant_id !== user.tenantId && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'unauthorized',
        message: 'Not authorized to process payment for this order',
      });
    }

    // Get payment gateway
    const gateway = await PaymentGatewayFactory.createFromTenant(
      order.tenant_id,
      gatewayType
    );

    // Charge payment
    const result = await gateway.charge(
      order.total_cents,
      order.currency,
      paymentMethod,
      {
        orderId: order.id,
        orderNumber: order.order_number,
        tenantId: order.tenant_id,
        ...metadata,
      }
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'charge_failed',
        message: result.error || 'Payment charge failed',
        details: result.gatewayResponse,
      });
    }

    // Calculate platform fees
    const fees = await PlatformFeeCalculator.calculateFees(
      order.tenant_id,
      order.total_cents,
      result.gatewayFeeCents || 0
    );

    // Create payment record
    const payment = await prisma.payments.create({
      data: {
        id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order_id: order.id,
        tenant_id: order.tenant_id,
        amount_cents: order.total_cents,
        currency: order.currency,
        payment_method: paymentMethod.type === 'card' ? 'credit_card' : paymentMethod.type,
        payment_status: 'paid',
        gateway_type: gatewayType,
        gateway_transaction_id: result.transactionId,
        gateway_fee_cents: result.gatewayFeeCents || 0,
        platform_fee_cents: fees.platformFeeCents,
        platform_fee_percentage: fees.platformFeePercentage,
        platform_fee_fixed_cents: fees.platformFeeFixedCents,
        total_fees_cents: fees.totalFeesCents,
        net_amount_cents: fees.netAmountCents,
        fee_waived: fees.feeWaived,
        fee_waived_reason: fees.feeWaivedReason,
        gateway_response: result.gatewayResponse,
        authorized_at: new Date(),
        captured_at: new Date(),
        metadata: metadata,
        ip_address: req.ip,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Update order payment status
    await prisma.orders.update({
      where: { id: orderId },
      data: {
        payment_status: 'paid',
        paid_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Create status history entry
    await prisma.order_status_history.create({
      data: {
        id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order_id: orderId,
        from_status: order.order_status,
        to_status: order.order_status,
        changed_by_user_id: user.userId,
        changed_by_name: user.email,
        reason: 'Payment completed',
        notes: `Payment ${payment.id} charged for ${(order.total_cents / 100).toFixed(2)} ${order.currency}`,
        metadata: {},
        created_at: new Date(),
      },
    });

    res.json({
      success: true,
      payment: payment,
      fees: {
        gateway: fees.gatewayFeeCents,
        platform: fees.platformFeeCents,
        total: fees.totalFeesCents,
        net: fees.netAmountCents,
        waived: fees.feeWaived,
      },
    });
  } catch (error: any) {
    console.error('[Payments] Charge error:', error);
    res.status(500).json({
      success: false,
      error: 'charge_error',
      message: error.message || 'Failed to charge payment',
    });
  }
});

/**
 * POST /api/payments/:paymentId/refund
 * Process refund (full or partial)
 */
router.post('/:paymentId/refund', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    // Get payment
    const payment = await prisma.payments.findUnique({
      where: { id: paymentId },
      include: {
        orders: true,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'payment_not_found',
        message: 'Payment not found',
      });
    }

    // Check authorization
    const user = (req as any).user;
    if (payment.tenant_id !== user.tenantId && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'unauthorized',
        message: 'Not authorized to refund this payment',
      });
    }

    // Check if payment can be refunded
    if (payment.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        error: 'payment_not_paid',
        message: 'Only paid payments can be refunded',
      });
    }

    // Get payment gateway
    const gateway = await PaymentGatewayFactory.createFromTenant(
      payment.tenant_id,
      (payment.gateway_type as any) || 'stripe'
    );

    // Process refund
    const refundAmount = amount || payment.amount_cents;
    const result = await gateway.refund(
      payment.gateway_transaction_id!,
      refundAmount,
      reason
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'refund_failed',
        message: result.error || 'Refund failed',
        details: result.gatewayResponse,
      });
    }

    // Determine new payment status
    const isPartialRefund = refundAmount < payment.amount_cents;
    const newStatus = isPartialRefund ? 'partially_refunded' : 'refunded';

    // Update payment record
    const updatedPayment = await prisma.payments.update({
      where: { id: paymentId },
      data: {
        payment_status: newStatus,
        gateway_response: result.gatewayResponse,
        updated_at: new Date(),
      },
    });

    // Update order payment status
    await prisma.orders.update({
      where: { id: payment.order_id },
      data: {
        payment_status: newStatus,
        updated_at: new Date(),
      },
    });

    // Create status history entry
    await prisma.order_status_history.create({
      data: {
        id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order_id: payment.order_id,
        from_status: payment.orders.order_status,
        to_status: payment.orders.order_status,
        changed_by_user_id: user.userId,
        changed_by_name: user.email,
        reason: reason || 'Payment refunded',
        notes: `${isPartialRefund ? 'Partial refund' : 'Full refund'} of ${(refundAmount / 100).toFixed(2)} ${payment.currency}`,
        metadata: { refund_id: result.refundId },
        created_at: new Date(),
      },
    });

    res.json({
      success: true,
      payment: updatedPayment,
      refund: {
        id: result.refundId,
        amount: refundAmount,
        currency: result.currency,
        status: result.status,
        is_partial: isPartialRefund,
      },
    });
  } catch (error: any) {
    console.error('[Payments] Refund error:', error);
    res.status(500).json({
      success: false,
      error: 'refund_error',
      message: error.message || 'Failed to process refund',
    });
  }
});

/**
 * GET /api/payments/:paymentId
 * Get payment details
 */
router.get('/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    const payment = await prisma.payments.findUnique({
      where: { id: paymentId },
      include: {
        orders: {
          select: {
            id: true,
            order_number: true,
            order_status: true,
            total_cents: true,
            currency: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'payment_not_found',
        message: 'Payment not found',
      });
    }

    // Check authorization
    const user = (req as any).user;
    if (payment.tenant_id !== user.tenantId && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'unauthorized',
        message: 'Not authorized to view this payment',
      });
    }

    res.json({
      success: true,
      payment: payment,
    });
  } catch (error: any) {
    console.error('[Payments] Get payment error:', error);
    res.status(500).json({
      success: false,
      error: 'get_payment_error',
      message: error.message || 'Failed to get payment',
    });
  }
});

/**
 * GET /api/orders/:orderId/payments
 * Get all payments for an order
 */
router.get('/:orderId/payments', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        payments: {
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

    // Check authorization
    const user = (req as any).user;
    if (order.tenant_id !== user.tenantId && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'unauthorized',
        message: 'Not authorized to view payments for this order',
      });
    }

    res.json({
      success: true,
      payments: order.payments,
      order: {
        id: order.id,
        order_number: order.order_number,
        total_cents: order.total_cents,
        currency: order.currency,
        payment_status: order.payment_status,
      },
    });
  } catch (error: any) {
    console.error('[Payments] Get order payments error:', error);
    res.status(500).json({
      success: false,
      error: 'get_payments_error',
      message: error.message || 'Failed to get payments',
    });
  }
});

export default router;
