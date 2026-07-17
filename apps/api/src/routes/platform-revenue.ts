/**
 * Platform Revenue API Routes
 * 
 * Handles platform revenue collection via Stripe Connect:
 * - Platform payment configuration
 * - Merchant Stripe Connect onboarding
 * - Revenue tracking and reporting
 * - Payout management
 * 
 * All routes require platform admin authentication.
 */

import { Request, Response, Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { unifiedConfig } from '../config/unifiedConfig';

// Utility function to convert BigInt values to strings for JSON serialization
const serializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = serializeBigInt(obj[key]);
      }
    }
    return result;
  }
  
  return obj;
};

import Stripe from 'stripe';
import { logger } from '../logger';

const router = Router();

// Initialize Stripe with platform secret key (if configured)
const getStripeClient = async (): Promise<Stripe | null> => {
  const config = await prisma.platform_payment_config.findUnique({
    where: { id: 'platform_main' },
  });

  if (!config?.stripe_platform_secret_key_encrypted) {
    return null;
  }

  // TODO: Decrypt the secret key
  const secretKey = config.stripe_platform_secret_key_encrypted;
  
  return new Stripe(secretKey, {
    apiVersion: '2026-06-24.dahlia',
  });
};

// ====================
// PLATFORM CONFIG
// ====================

/**
 * GET /api/admin/platform-revenue/config
 * Get platform payment configuration
 */
router.get('/config', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });

    if (!config) {
      // Create default config if doesn't exist
      const newConfig = await prisma.platform_payment_config.create({
        data: {
          id: 'platform_main',
        },
      });
      
      return res.json({
        success: true,
        config: {
          ...newConfig,
          total_payout_cents: newConfig.total_payout_cents?.toString() || '0',
        },
      });
    }

    // Return config without sensitive fields, convert BigInt to string
    const safeConfig = {
      ...config,
      total_payout_cents: config.total_payout_cents?.toString() || '0',
      stripe_platform_secret_key_encrypted: undefined,
      stripe_webhook_secret_encrypted: undefined,
      stripe_connect_secret_encrypted: undefined,
    };

    res.json({
      success: true,
      config: safeConfig,
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error getting config:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'config_fetch_failed',
      message: 'Failed to fetch platform configuration',
    });
  }
});

/**
 * PUT /api/admin/platform-revenue/config
 * Update platform payment configuration
 */
router.put('/config', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      stripe_platform_public_key,
      stripe_platform_secret_key,
      stripe_webhook_secret,
      stripe_connect_client_id,
      stripe_connect_secret,
      default_platform_fee_percent,
      deposit_forfeit_fee_percent,
      subscription_fee_percent,
      platform_payout_schedule,
      platform_payout_minimum_cents,
    } = req.body;

    // TODO: Encrypt sensitive fields before storing
    const updateData: any = {};
    
    if (stripe_platform_public_key !== undefined) {
      updateData.stripe_platform_public_key = stripe_platform_public_key;
    }
    if (stripe_platform_secret_key !== undefined) {
      updateData.stripe_platform_secret_key_encrypted = stripe_platform_secret_key; // TODO: Encrypt
    }
    if (stripe_webhook_secret !== undefined) {
      updateData.stripe_webhook_secret_encrypted = stripe_webhook_secret; // TODO: Encrypt
    }
    if (stripe_connect_client_id !== undefined) {
      updateData.stripe_connect_client_id = stripe_connect_client_id;
    }
    if (stripe_connect_secret !== undefined) {
      updateData.stripe_connect_secret_encrypted = stripe_connect_secret; // TODO: Encrypt
    }
    if (default_platform_fee_percent !== undefined) {
      updateData.default_platform_fee_percent = default_platform_fee_percent;
    }
    if (deposit_forfeit_fee_percent !== undefined) {
      updateData.deposit_forfeit_fee_percent = deposit_forfeit_fee_percent;
    }
    if (subscription_fee_percent !== undefined) {
      updateData.subscription_fee_percent = subscription_fee_percent;
    }
    if (platform_payout_schedule !== undefined) {
      updateData.platform_payout_schedule = platform_payout_schedule;
    }
    if (platform_payout_minimum_cents !== undefined) {
      updateData.platform_payout_minimum_cents = platform_payout_minimum_cents;
    }

    const config = await prisma.platform_payment_config.upsert({
      where: { id: 'platform_main' },
      update: updateData,
      create: {
        id: 'platform_main',
        ...updateData,
      },
    });

    // Return config without sensitive fields
    const safeConfig = {
      ...config,
      stripe_platform_secret_key_encrypted: undefined,
      stripe_webhook_secret_encrypted: undefined,
      stripe_connect_secret_encrypted: undefined,
    };

    res.json({
      success: true,
      config: safeConfig,
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error updating config:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'config_update_failed',
      message: 'Failed to update platform configuration',
    });
  }
});

/**
 * POST /api/admin/platform-revenue/onboarding/init
 * Initialize Stripe Connect onboarding for the platform
 */
router.post('/onboarding/init', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stripe = await getStripeClient();
    
    if (!stripe) {
      return res.status(400).json({
        success: false,
        error: 'stripe_not_configured',
        message: 'Stripe is not configured for the platform',
      });
    }

    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });

    if (!config?.stripe_connect_client_id) {
      return res.status(400).json({
        success: false,
        error: 'connect_not_configured',
        message: 'Stripe Connect client ID is not configured',
      });
    }

    // Generate onboarding link for platform account
    // Note: This would typically be done through Stripe Dashboard for the platform account
    // For now, we'll return a placeholder
    
    res.json({
      success: true,
      onboarding_link: `https://dashboard.stripe.com/connect/accounts/apply`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error initializing onboarding:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'onboarding_init_failed',
      message: 'Failed to initialize platform onboarding',
    });
  }
});

// ====================
// MERCHANT CONNECTIONS
// ====================

/**
 * GET /api/admin/platform-revenue/merchants
 * Get all merchant Stripe connections
 */
router.get('/merchants', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;

    const where: any = {};
    
    if (status && status !== 'all') {
      where.onboarding_status = status;
    }

    const connections = await prisma.merchant_stripe_connections.findMany({
      where,
      include: {
        tenants: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Filter by search if provided
    let filtered = connections;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = connections.filter((c: any) => 
        c.tenants?.name?.toLowerCase().includes(searchLower) ||
        c.stripe_account_id?.toLowerCase().includes(searchLower) ||
        c.tenant_id?.toLowerCase().includes(searchLower)
      );
    }

    const result = filtered.map((c: any) => ({
      ...c,
      tenant_name: c.tenants?.name,
      tenants: undefined,
    }));

    res.json({
      success: true,
      connections: serializeBigInt(result),
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error getting merchants:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'merchants_fetch_failed',
      message: 'Failed to fetch merchant connections',
    });
  }
});

/**
 * GET /api/admin/platform-revenue/merchants/:tenantId
 * Get a specific merchant's Stripe connection
 */
router.get('/merchants/:tenantId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const connection = await prisma.merchant_stripe_connections.findUnique({
      where: { tenant_id: tenantId },
      include: {
        tenants: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'connection_not_found',
        message: 'Merchant Stripe connection not found',
      });
    }

    res.json({
      success: true,
      connection: {
        ...connection,
        tenant_name: connection.tenants?.name,
        tenants: undefined,
      },
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error getting merchant connection:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'connection_fetch_failed',
      message: 'Failed to fetch merchant connection',
    });
  }
});

/**
 * POST /api/admin/platform-revenue/merchants/:tenantId/onboarding
 * Create Stripe Connect onboarding link for a merchant
 */
router.post('/merchants/:tenantId/onboarding', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const stripe = await getStripeClient();

    if (!stripe) {
      return res.status(400).json({
        success: false,
        error: 'stripe_not_configured',
        message: 'Stripe is not configured for the platform',
      });
    }

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

    // Create account link for onboarding
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${unifiedConfig.platformUrl}/settings/admin/platform-revenue/merchants/${tenantId}/refresh`,
      return_url: `${unifiedConfig.platformUrl}/settings/admin/platform-revenue/merchants/${tenantId}/complete`,
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
      onboarding_link: accountLink.url,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error: any) {
    logger.error('[PlatformRevenue] Error creating onboarding link:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'onboarding_link_failed',
      message: error.message || 'Failed to create onboarding link',
    });
  }
});

/**
 * PUT /api/admin/platform-revenue/merchants/:tenantId/fee
 * Update merchant fee override
 */
router.put('/merchants/:tenantId/fee', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { platform_fee_override_percent } = req.body;

    const connection = await prisma.merchant_stripe_connections.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'connection_not_found',
        message: 'Merchant Stripe connection not found',
      });
    }

    const updated = await prisma.merchant_stripe_connections.update({
      where: { tenant_id: tenantId },
      data: {
        platform_fee_override_percent: platform_fee_override_percent,
      },
    });

    res.json({
      success: true,
      connection: updated,
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error updating merchant fee:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'fee_update_failed',
      message: 'Failed to update merchant fee',
    });
  }
});

/**
 * POST /api/admin/platform-revenue/merchants/:tenantId/refresh
 * Refresh merchant Stripe account status
 */
router.post('/merchants/:tenantId/refresh', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const stripe = await getStripeClient();

    if (!stripe) {
      return res.status(400).json({
        success: false,
        error: 'stripe_not_configured',
        message: 'Stripe is not configured for the platform',
      });
    }

    const connection = await prisma.merchant_stripe_connections.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!connection || !connection.stripe_account_id) {
      return res.status(404).json({
        success: false,
        error: 'connection_not_found',
        message: 'Merchant Stripe connection not found',
      });
    }

    // Fetch account status from Stripe
    const account = await stripe.accounts.retrieve(connection.stripe_account_id);

    const updated = await prisma.merchant_stripe_connections.update({
      where: { tenant_id: tenantId },
      data: {
        stripe_account_status: account.charges_enabled ? 'enabled' : 
                               account.payouts_enabled ? 'restricted' : 'pending',
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
      connection: updated,
    });
  } catch (error: any) {
    logger.error('[PlatformRevenue] Error refreshing merchant status:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'refresh_failed',
      message: error.message || 'Failed to refresh merchant status',
    });
  }
});

// ====================
// REVENUE TRACKING
// ====================

/**
 * GET /api/admin/platform-revenue/summary
 * Get revenue summary
 */
router.get('/summary', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const transactions = await prisma.platform_revenue_transactions.findMany({
      where: {
        created_at: {
          gte: startDate,
        },
      },
    });

    const summary = {
      total_transactions: transactions.length,
      gross_volume_cents: transactions.reduce((sum: number, t: any) => sum + (t.gross_amount_cents || 0), 0),
      platform_revenue_cents: transactions.reduce((sum: number, t: any) => sum + (t.platform_fee_cents || 0), 0),
      gateway_fees_cents: transactions.reduce((sum: number, t: any) => sum + (t.gateway_fee_cents || 0), 0),
      net_to_merchants_cents: transactions.reduce((sum: number, t: any) => sum + (t.net_amount_cents || 0), 0),
      pending_payouts_cents: transactions
        .filter((t: any) => t.status === 'pending' && t.transaction_type !== 'payout')
        .reduce((sum: number, t: any) => sum + (t.platform_fee_cents || 0), 0),
      by_type: {
        transaction_fees: transactions
          .filter((t: any) => t.transaction_type === 'transaction_fee')
          .reduce((sum: number, t: any) => sum + (t.platform_fee_cents || 0), 0),
        deposit_forfeits: transactions
          .filter((t: any) => t.transaction_type === 'deposit_forfeit')
          .reduce((sum: number, t: any) => sum + (t.platform_fee_cents || 0), 0),
        subscriptions: transactions
          .filter((t: any) => t.transaction_type === 'subscription')
          .reduce((sum: number, t: any) => sum + (t.platform_fee_cents || 0), 0),
      },
    };

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error getting summary:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'summary_fetch_failed',
      message: 'Failed to fetch revenue summary',
    });
  }
});

/**
 * GET /api/admin/platform-revenue/transactions
 * Get revenue transactions
 */
router.get('/transactions', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      type,
      status,
      tenant_id,
      start_date,
      end_date,
      limit = 50,
      offset = 0,
    } = req.query;

    const where: any = {};

    if (type && type !== 'all') {
      where.transaction_type = type;
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    if (tenant_id) {
      where.tenant_id = tenant_id;
    }
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.gte = new Date(start_date as string);
      if (end_date) where.created_at.lte = new Date(end_date as string);
    }

    const [transactions, total] = await Promise.all([
      prisma.platform_revenue_transactions.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.platform_revenue_transactions.count({ where }),
    ]);

    res.json({
      success: true,
      transactions: serializeBigInt(transactions),
      total: total?.toString(),
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error getting transactions:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'transactions_fetch_failed',
      message: 'Failed to fetch transactions',
    });
  }
});

/**
 * GET /api/admin/platform-revenue/tenants/:tenantId/revenue
 * Get revenue by tenant
 */
router.get('/tenants/:tenantId/revenue', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const transactions = await prisma.platform_revenue_transactions.findMany({
      where: {
        tenant_id: tenantId,
        created_at: {
          gte: startDate,
        },
      },
    });

    const revenue = {
      total_cents: transactions.reduce((sum: number, t: any) => sum + (t.gross_amount_cents || 0), 0),
      platform_fees_cents: transactions.reduce((sum: number, t: any) => sum + (t.platform_fee_cents || 0), 0),
      forfeit_fees_cents: transactions
        .filter((t: any) => t.transaction_type === 'deposit_forfeit')
        .reduce((sum: number, t: any) => sum + (t.platform_fee_cents || 0), 0),
      transaction_count: transactions.length,
    };

    res.json({
      success: true,
      revenue,
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error getting tenant revenue:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'tenant_revenue_failed',
      message: 'Failed to fetch tenant revenue',
    });
  }
});

// ====================
// PAYOUTS
// ====================

/**
 * GET /api/admin/platform-revenue/payouts/pending
 * Get pending payouts summary
 */
router.get('/payouts/pending', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get pending platform revenue
    const pendingPlatform = await prisma.platform_revenue_transactions.aggregate({
      where: {
        status: 'pending',
        transaction_type: { not: 'payout' },
      },
      _sum: {
        platform_fee_cents: true,
      },
    });

    // Get pending merchant payouts (would need to be calculated per merchant)
    const merchantPending = await prisma.platform_revenue_transactions.groupBy({
      by: ['tenant_id'],
      where: {
        status: 'pending',
        transaction_type: { not: 'payout' },
        tenant_id: { not: null },
      },
      _sum: {
        net_amount_cents: true,
      },
    });

    // Get tenant names
    const tenantIds = merchantPending.map((m: any) => m.tenant_id).filter(Boolean) as string[];
    const tenants = await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });

    const tenantMap = new Map(tenants.map((t: any) => [t.id, t.name]));

    const merchantPendingList = merchantPending.map((m: any) => ({
      tenant_id: m.tenant_id,
      tenant_name: tenantMap.get(m.tenant_id!) || 'Unknown',
      amount_cents: m._sum.net_amount_cents || 0,
    }));

    res.json({
      success: true,
      platform_pending_cents: pendingPlatform._sum.platform_fee_cents || 0,
      merchant_pending: merchantPendingList,
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error getting pending payouts:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'pending_payouts_failed',
      message: 'Failed to fetch pending payouts',
    });
  }
});

/**
 * POST /api/admin/platform-revenue/payouts/trigger
 * Trigger platform payout
 */
router.post('/payouts/trigger', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stripe = await getStripeClient();

    if (!stripe) {
      return res.status(400).json({
        success: false,
        error: 'stripe_not_configured',
        message: 'Stripe is not configured for the platform',
      });
    }

    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });

    if (!config?.stripe_platform_account_id) {
      return res.status(400).json({
        success: false,
        error: 'platform_account_not_configured',
        message: 'Platform Stripe account is not configured',
      });
    }

    // Get pending platform revenue
    const pending = await prisma.platform_revenue_transactions.aggregate({
      where: {
        status: 'pending',
        transaction_type: { not: 'payout' },
      },
      _sum: {
        platform_fee_cents: true,
      },
    });

    const amountCents = pending._sum.platform_fee_cents || 0;

    if (amountCents < (config.platform_payout_minimum_cents || 1000)) {
      return res.status(400).json({
        success: false,
        error: 'below_minimum',
        message: `Amount is below minimum payout of $${(config.platform_payout_minimum_cents || 1000) / 100}`,
      });
    }

    // Create payout via Stripe
    const payout = await stripe.payouts.create({
      amount: amountCents,
      currency: 'usd',
      method: 'standard',
    }, {
      stripeAccount: config.stripe_platform_account_id,
    });

    // Create payout transaction record
    const payoutTransaction = await prisma.platform_revenue_transactions.create({
      data: {
        id: `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        transaction_type: 'payout',
        gross_amount_cents: amountCents,
        platform_fee_cents: 0,
        gateway_fee_cents: 0,
        net_amount_cents: amountCents,
        stripe_payout_id: payout.id,
        status: 'pending',
        processed_at: new Date(),
      },
    });

    // Update pending transactions to completed
    await prisma.platform_revenue_transactions.updateMany({
      where: {
        status: 'pending',
        transaction_type: { not: 'payout' },
      },
      data: {
        status: 'completed',
        processed_at: new Date(),
      },
    });

    // Update platform config
    await prisma.platform_payment_config.update({
      where: { id: 'platform_main' },
      data: {
        last_payout_at: new Date(),
        last_payout_amount_cents: amountCents,
        total_payout_cents: {
          increment: BigInt(amountCents),
        },
      },
    });

    res.json({
      success: true,
      payout_id: payout.id,
      amount_cents: amountCents,
    });
  } catch (error: any) {
    logger.error('[PlatformRevenue] Error triggering payout:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'payout_failed',
      message: error.message || 'Failed to trigger payout',
    });
  }
});

// ====================
// FEE TIERS
// ====================

/**
 * GET /api/admin/platform-revenue/fee-tiers
 * Get all platform fee tiers
 */
router.get('/fee-tiers', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tiers = await prisma.platform_fee_tiers.findMany({
      orderBy: { tier_name: 'asc' },
    });

    res.json({
      success: true,
      tiers: tiers.map((tier: any) => ({
        ...tier,
        fee_percentage: tier.fee_percentage?.toString() || '0',
        fee_fixed_cents: tier.fee_fixed_cents || 0,
        min_transaction_count: tier.min_transaction_count || 0,
      })),
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error getting fee tiers:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'tiers_fetch_failed',
      message: 'Failed to fetch fee tiers',
    });
  }
});

/**
 * POST /api/admin/platform-revenue/fee-tiers
 * Create a new platform fee tier
 */
router.post('/fee-tiers', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      tier_name,
      fee_percentage,
      fee_fixed_cents = 0,
      min_transaction_cents = 0,
      max_transaction_cents = null,
      min_transaction_count = 0,
      description = '',
    } = req.body;

    if (!tier_name) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'tier_name is required',
      });
    }

    const tier = await prisma.platform_fee_tiers.create({
      data: {
        id: `tier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tier_name,
        fee_percentage,
        fee_fixed_cents,
        min_transaction_cents,
        max_transaction_cents,
        min_transaction_count,
        description,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    res.json({
      success: true,
      tier: {
        ...tier,
        fee_percentage: tier.fee_percentage?.toString() || '0',
        min_transaction_count: tier.min_transaction_count || 0,
      },
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error creating fee tier:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'tier_create_failed',
      message: 'Failed to create fee tier',
    });
  }
});

/**
 * PUT /api/admin/platform-revenue/fee-tiers/:id
 * Update a platform fee tier
 */
router.put('/fee-tiers/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      tier_name,
      fee_percentage,
      fee_fixed_cents,
      min_transaction_cents,
      max_transaction_cents,
      min_transaction_count,
      description,
      is_active,
    } = req.body;

    const tier = await prisma.platform_fee_tiers.update({
      where: { id },
      data: {
        ...(tier_name && { tier_name }),
        ...(fee_percentage !== undefined && { fee_percentage }),
        ...(fee_fixed_cents !== undefined && { fee_fixed_cents }),
        ...(min_transaction_cents !== undefined && { min_transaction_cents }),
        ...(max_transaction_cents !== undefined && { max_transaction_cents }),
        ...(min_transaction_count !== undefined && { min_transaction_count }),
        ...(description !== undefined && { description }),
        ...(is_active !== undefined && { is_active }),
        updated_at: new Date(),
      },
    });

    res.json({
      success: true,
      tier: {
        ...tier,
        fee_percentage: tier.fee_percentage?.toString() || '0',
      },
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error updating fee tier:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'tier_update_failed',
      message: 'Failed to update fee tier',
    });
  }
});

/**
 * DELETE /api/admin/platform-revenue/fee-tiers/:id
 * Delete a platform fee tier
 */
router.delete('/fee-tiers/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.platform_fee_tiers.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Fee tier deleted',
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error deleting fee tier:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'tier_delete_failed',
      message: 'Failed to delete fee tier',
    });
  }
});

// ====================
// FEE OVERRIDES
// ====================

/**
 * GET /api/admin/platform-revenue/fee-overrides
 * Get all tenant fee overrides
 */
router.get('/fee-overrides', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const overrides = await prisma.platform_fee_overrides.findMany({
      where: { is_active: true },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({
      success: true,
      overrides: overrides.map((o: any) => ({
        id: o.id,
        tenant_id: o.tenant_id,
        tenant_name: o.tenants?.name,
        tenant_tier: o.tenants?.subscription_tier,
        fee_percentage: o.fee_percentage?.toString() || '0',
        fee_fixed_cents: o.fee_fixed_cents || 0,
        reason: o.reason,
        expires_at: o.expires_at,
        created_at: o.created_at,
        approved_by: o.approved_by,
      })),
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error getting fee overrides:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'overrides_fetch_failed',
      message: 'Failed to fetch fee overrides',
    });
  }
});

/**
 * POST /api/admin/platform-revenue/fee-overrides
 * Create a tenant fee override
 */
router.post('/fee-overrides', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      tenant_id,
      fee_percentage,
      fee_fixed_cents = 0,
      reason,
      expires_at,
    } = req.body;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant',
        message: 'tenant_id is required',
      });
    }

    // Deactivate any existing override for this tenant
    await prisma.platform_fee_overrides.updateMany({
      where: { tenant_id, is_active: true },
      data: { is_active: false },
    });

    const override = await prisma.platform_fee_overrides.create({
      data: {
        id: `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenant_id,
        fee_percentage,
        fee_fixed_cents,
        reason: reason || 'Admin override',
        is_active: true,
        expires_at: expires_at ? new Date(expires_at) : null,
        approved_by: (req as any).user?.email || 'admin',
        approved_by_email: (req as any).user?.email || 'admin',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    res.json({
      success: true,
      override: {
        ...override,
        fee_percentage: override.fee_percentage?.toString() || '0',
      },
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error creating fee override:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'override_create_failed',
      message: 'Failed to create fee override',
    });
  }
});

/**
 * DELETE /api/admin/platform-revenue/fee-overrides/:id
 * Deactivate a tenant fee override
 */
router.delete('/fee-overrides/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Soft delete by deactivating
    await prisma.platform_fee_overrides.update({
      where: { id },
      data: { is_active: false },
    });

    res.json({
      success: true,
      message: 'Fee override deactivated',
    });
  } catch (error) {
    logger.error('[PlatformRevenue] Error deleting fee override:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'override_delete_failed',
      message: 'Failed to delete fee override',
    });
  }
});

export default router;
