/**
 * PayPal Commerce Platform API Routes
 * 
 * Handles PayPal Connect operations:
 * - Merchant onboarding
 * - Order creation with platform fees
 * - Payment capture
 * - Status management
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth';
import { prisma } from '../prisma';
import { paypalConnectService } from '../services/payments/PayPalConnectService';

const router = Router();

// Auth: authenticateToken applied at mount level in admin.routes.ts
// Admin routes have requireAdmin per-route; tenant-facing routes (orders/capture) only need authenticateToken

/**
 * GET /api/admin/paypal-connect/status
 * Check if PayPal Commerce Platform is configured
 */
router.get('/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const isConfigured = await paypalConnectService.isConfigured();

    res.json({
      success: true,
      configured: isConfigured,
    });
  } catch (error) {
    console.error('[PayPalConnect] Error checking status:', error);
    res.status(500).json({
      success: false,
      error: 'status_check_failed',
      message: 'Failed to check PayPal status',
    });
  }
});

/**
 * GET /api/admin/paypal-connect/merchants
 * List all PayPal merchant connections
 */
router.get('/merchants', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    // Check if table exists
    const connections = await (prisma as any).merchant_paypal_connections?.findMany({
      where: status ? { onboarding_status: status } : undefined,
      include: {
        tenants: {
          select: { name: true, email: true },
        },
      },
      orderBy: { created_at: 'desc' },
    }) || [];

    const result = connections.map((c: any) => ({
      ...c,
      tenant_name: c.tenants?.name,
      tenant_email: c.tenants?.email,
      tenants: undefined,
    }));

    res.json({
      success: true,
      connections: result,
    });
  } catch (error) {
    console.error('[PayPalConnect] Error listing merchants:', error);
    res.status(500).json({
      success: false,
      error: 'list_failed',
      message: 'Failed to list PayPal connections',
    });
  }
});

/**
 * POST /api/admin/paypal-connect/merchants/:tenantId/onboarding
 * Create PayPal onboarding link for a merchant
 */
router.post('/merchants/:tenantId/onboarding', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { return_url, refresh_url } = req.body;

    const platformUrl = process.env.PLATFORM_URL || 'http://localhost:3000';
    const returnUrl = return_url || `${platformUrl}/settings/admin/platform-revenue/merchants/${tenantId}/paypal/complete`;
    const refreshUrl = refresh_url || `${platformUrl}/settings/admin/platform-revenue/merchants/${tenantId}/paypal/refresh`;

    const result = await paypalConnectService.createOnboardingLink(
      tenantId,
      returnUrl,
      refreshUrl
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'onboarding_failed',
        message: result.error || 'Failed to create onboarding link',
      });
    }

    res.json({
      success: true,
      onboarding_url: result.actionUrl,
      merchant_id: result.merchantId,
    });
  } catch (error: any) {
    console.error('[PayPalConnect] Error creating onboarding:', error);
    res.status(500).json({
      success: false,
      error: 'onboarding_failed',
      message: error.message || 'Failed to create onboarding link',
    });
  }
});

/**
 * POST /api/admin/paypal-connect/merchants/:tenantId/callback
 * Handle PayPal onboarding callback
 */
router.post('/merchants/:tenantId/callback', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { merchantId } = req.body;

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'merchant_id_required',
        message: 'PayPal merchant ID is required',
      });
    }

    const result = await paypalConnectService.handleOnboardingCallback(tenantId, merchantId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'callback_failed',
        message: result.error || 'Failed to process callback',
      });
    }

    res.json({
      success: true,
      message: 'PayPal onboarding completed',
    });
  } catch (error: any) {
    console.error('[PayPalConnect] Error handling callback:', error);
    res.status(500).json({
      success: false,
      error: 'callback_failed',
      message: error.message || 'Failed to process callback',
    });
  }
});

/**
 * POST /api/admin/paypal-connect/merchants/:tenantId/refresh
 * Refresh merchant PayPal status
 */
router.post('/merchants/:tenantId/refresh', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const result = await paypalConnectService.refreshMerchantStatus(tenantId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'refresh_failed',
        message: result.error || 'Failed to refresh status',
      });
    }

    res.json({
      success: true,
      status: result.status,
    });
  } catch (error: any) {
    console.error('[PayPalConnect] Error refreshing status:', error);
    res.status(500).json({
      success: false,
      error: 'refresh_failed',
      message: error.message || 'Failed to refresh merchant status',
    });
  }
});

/**
 * PUT /api/admin/paypal-connect/merchants/:tenantId/fee
 * Update merchant fee override
 */
router.put('/merchants/:tenantId/fee', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { platform_fee_override_percent } = req.body;

    const connection = await (prisma as any).merchant_paypal_connections?.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'connection_not_found',
        message: 'PayPal connection not found',
      });
    }

    const updated = await (prisma as any).merchant_paypal_connections?.update({
      where: { tenant_id: tenantId },
      data: {
        platform_fee_override_percent,
      },
    });

    res.json({
      success: true,
      connection: updated,
    });
  } catch (error) {
    console.error('[PayPalConnect] Error updating fee:', error);
    res.status(500).json({
      success: false,
      error: 'fee_update_failed',
      message: 'Failed to update merchant fee',
    });
  }
});

// ====================
// TENANT ROUTES (for checkout)
// ====================

/**
 * POST /api/tenants/:tenantId/paypal/orders
 * Create PayPal order with platform fee
 */
router.post('/tenants/:tenantId/paypal/orders', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { amount_cents, currency, return_url, cancel_url, metadata } = req.body;

    if (!amount_cents || !currency) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'amount_cents and currency are required',
      });
    }

    const result = await paypalConnectService.createOrderWithFee(
      tenantId,
      amount_cents,
      currency,
      return_url,
      cancel_url,
      metadata || {}
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'order_failed',
        message: result.error || 'Failed to create PayPal order',
      });
    }

    res.json({
      success: true,
      order_id: result.orderId,
      approval_url: result.approvalUrl,
      platform_fee_cents: result.platformFeeCents,
    });
  } catch (error: any) {
    console.error('[PayPalConnect] Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'order_failed',
      message: error.message || 'Failed to create PayPal order',
    });
  }
});

/**
 * POST /api/tenants/:tenantId/paypal/orders/:orderId/capture
 * Capture PayPal order
 */
router.post('/tenants/:tenantId/paypal/orders/:orderId/capture', async (req: Request, res: Response) => {
  try {
    const { tenantId, orderId } = req.params;

    const result = await paypalConnectService.captureOrder(orderId, tenantId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'capture_failed',
        message: result.error || 'Failed to capture payment',
      });
    }

    res.json({
      success: true,
      capture_id: result.captureId,
      platform_fee_cents: result.platformFeeCents,
      net_to_merchant_cents: result.netToMerchantCents,
    });
  } catch (error: any) {
    console.error('[PayPalConnect] Error capturing order:', error);
    res.status(500).json({
      success: false,
      error: 'capture_failed',
      message: error.message || 'Failed to capture payment',
    });
  }
});

export default router;
