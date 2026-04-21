/**
 * Tenant-Facing Stripe Connect Routes
 * 
 * Allows merchants to self-onboard to Stripe Connect for:
 * - Receiving payouts from platform revenue collection
 * - Automatic fee splitting on transactions
 * 
 * Integration points:
 * - Payment gateway settings page
 * - Subscription checkout flow
 */

import { Router, Request, Response } from 'express';
import { requireAuth, checkTenantAccess } from '../middleware/auth';
import { prisma } from '../prisma';
import Stripe from 'stripe';

const router = Router();

// Get Stripe client from Doppler env vars (same as webhook handler)
const getStripeClient = (): Stripe | null => {
  const secretKey = process.env.STRIPE_PLATFORM_SECRET_KEY;
  if (!secretKey) {
    return null;
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
  });
};

// ====================
// STRIPE CONNECT STATUS
// ====================

/**
 * GET /api/tenants/:tenantId/stripe-connect/status
 * Get tenant's Stripe Connect onboarding status
 */
router.get('/:tenantId/stripe-connect/status', requireAuth, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const connection = await prisma.merchant_stripe_connections.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!connection) {
      return res.json({
        connected: false,
        onboarding_status: null,
        stripe_account_id: null,
        payouts_enabled: false,
        payments_enabled: false,
      });
    }

    res.json({
      connected: connection.onboarding_status === 'completed',
      onboarding_status: connection.onboarding_status,
      stripe_account_id: connection.stripe_account_id,
      payouts_enabled: connection.stripe_payouts_enabled,
      payments_enabled: connection.stripe_payments_enabled,
      requirements: connection.stripe_requirements || [],
      platform_fee_percent: connection.platform_fee_override_percent,
    });
  } catch (error: any) {
    console.error('[TenantStripeConnect] Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'status_check_failed',
      message: 'Failed to check Stripe Connect status',
    });
  }
});

// ====================
// ONBOARDING
// ====================

/**
 * POST /api/tenants/:tenantId/stripe-connect/onboard
 * Initiate Stripe Connect onboarding for tenant
 * 
 * Returns onboarding link that tenant visits to complete setup
 */
router.post('/:tenantId/stripe-connect/onboard', requireAuth, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { return_url } = req.body;

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(400).json({
        success: false,
        error: 'stripe_not_configured',
        message: 'Stripe Connect is not configured for this platform',
      });
    }

    // Get tenant info for metadata
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    // Get or create merchant connection record
    let connection = await prisma.merchant_stripe_connections.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!connection) {
      connection = await prisma.merchant_stripe_connections.create({
        data: {
          id: `msc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: tenantId,
          onboarding_status: 'pending',
        },
      });
    }

    // Create Stripe Connect account if not exists
    let accountId = connection.stripe_account_id;
    
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        metadata: {
          tenant_id: tenantId,
          tenant_name: tenant?.name || 'Unknown',
        },
      });
      
      accountId = account.id;
      
      await prisma.merchant_stripe_connections.update({
        where: { id: connection.id },
        data: {
          stripe_account_id: accountId,
          stripe_account_type: 'express',
          onboarding_status: 'in_progress',
          onboarding_started_at: new Date(),
        },
      });
    }

    // Build return URL (tenant-facing, not admin)
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const defaultReturnUrl = `${webUrl}/t/${tenantId}/settings/payment-gateways?stripe_connect=complete`;
    const finalReturnUrl = return_url || defaultReturnUrl;

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${webUrl}/t/${tenantId}/settings/payment-gateways?stripe_connect=refresh`,
      return_url: finalReturnUrl,
      type: 'account_onboarding',
    });

    // Update connection with onboarding link
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await prisma.merchant_stripe_connections.update({
      where: { id: connection.id },
      data: {
        onboarding_link: accountLink.url,
        onboarding_expires_at: expiresAt,
      },
    });

    res.json({
      success: true,
      onboarding_url: accountLink.url,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error('[TenantStripeConnect] Onboarding error:', error);
    res.status(500).json({
      success: false,
      error: 'onboarding_failed',
      message: error.message || 'Failed to create onboarding link',
    });
  }
});

// ====================
// ACCOUNT STATUS REFRESH
// ====================

/**
 * POST /api/tenants/:tenantId/stripe-connect/refresh
 * Refresh Stripe Connect account status from Stripe
 */
router.post('/:tenantId/stripe-connect/refresh', requireAuth, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const connection = await prisma.merchant_stripe_connections.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!connection?.stripe_account_id) {
      return res.status(404).json({
        success: false,
        error: 'not_connected',
        message: 'No Stripe Connect account found for this tenant',
      });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(400).json({
        success: false,
        error: 'stripe_not_configured',
        message: 'Stripe is not configured',
      });
    }

    // Fetch latest account status from Stripe
    const account = await stripe.accounts.retrieve(connection.stripe_account_id);

    // Update connection with latest status
    const updated = await prisma.merchant_stripe_connections.update({
      where: { id: connection.id },
      data: {
        stripe_account_status: account.charges_enabled ? 'enabled' : 
                               account.payouts_enabled ? 'enabled' : 'restricted',
        stripe_payouts_enabled: account.payouts_enabled,
        stripe_payments_enabled: account.charges_enabled,
        stripe_requirements: account.requirements?.currently_due || [],
        onboarding_status: account.charges_enabled && account.payouts_enabled ? 'completed' : 
                          connection.onboarding_status,
        onboarding_completed_at: account.charges_enabled && account.payouts_enabled ? 
                                 new Date() : connection.onboarding_completed_at,
      },
    });

    res.json({
      success: true,
      status: {
        connected: updated.onboarding_status === 'completed',
        onboarding_status: updated.onboarding_status,
        payouts_enabled: updated.stripe_payouts_enabled,
        payments_enabled: updated.stripe_payments_enabled,
        requirements: updated.stripe_requirements,
      },
    });
  } catch (error: any) {
    console.error('[TenantStripeConnect] Refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'refresh_failed',
      message: 'Failed to refresh Stripe Connect status',
    });
  }
});

// ====================
// DASHBOARD LINK
// ====================

/**
 * POST /api/tenants/:tenantId/stripe-connect/dashboard
 * Generate Stripe Express dashboard link for tenant
 */
router.post('/:tenantId/stripe-connect/dashboard', requireAuth, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const connection = await prisma.merchant_stripe_connections.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!connection?.stripe_account_id) {
      return res.status(404).json({
        success: false,
        error: 'not_connected',
        message: 'No Stripe Connect account found',
      });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(400).json({
        success: false,
        error: 'stripe_not_configured',
        message: 'Stripe is not configured',
      });
    }

    // Create login link for Express account
    const loginLink = await stripe.accounts.createLoginLink(connection.stripe_account_id);

    res.json({
      success: true,
      dashboard_url: loginLink.url,
    });
  } catch (error: any) {
    console.error('[TenantStripeConnect] Dashboard link error:', error);
    res.status(500).json({
      success: false,
      error: 'dashboard_link_failed',
      message: 'Failed to create dashboard link',
    });
  }
});

// ====================
// DISCONNECT
// ====================

/**
 * DELETE /api/tenants/:tenantId/stripe-connect
 * Disconnect Stripe Connect account
 */
router.delete('/:tenantId/stripe-connect', requireAuth, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const connection = await prisma.merchant_stripe_connections.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!connection) {
      return res.json({
        success: true,
        message: 'No Stripe Connect account to disconnect',
      });
    }

    // Optionally: Delete Stripe account (not recommended - keep for records)
    // Instead, just mark as disconnected locally
    await prisma.merchant_stripe_connections.update({
      where: { id: connection.id },
      data: {
        onboarding_status: 'pending',
        stripe_account_status: null,
        stripe_payouts_enabled: false,
        stripe_payments_enabled: false,
        onboarding_link: null,
        onboarding_completed_at: null,
      },
    });

    res.json({
      success: true,
      message: 'Stripe Connect disconnected',
    });
  } catch (error: any) {
    console.error('[TenantStripeConnect] Disconnect error:', error);
    res.status(500).json({
      success: false,
      error: 'disconnect_failed',
      message: 'Failed to disconnect Stripe Connect',
    });
  }
});

export default router;
