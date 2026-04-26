/**
 * Tenant Billing API Routes
 * 
 * Routes for tenant billing management including overview, risk assessment, 
 * actionable tasks, and recent activity.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Extend Express Request type to include user from auth middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * GET /api/tenants/:tenantId/billing/overview
 * Get billing overview for tenant
 */
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user.id;

    // Verify user has access to this tenant using the checkTenantAccess middleware pattern
    const tenantUser = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        user_id: userId 
      },
      select: { role: true }
    });

    if (!tenantUser) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    const userRole = tenantUser.role;
    if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Mock data for now - replace with actual database queries
    const overview = {
      currentBalance: 15000, // $150.00
      nextPaymentDue: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      subscriptionStatus: 'active',
      lastPaymentStatus: 'success',
      subscriptionTier: 'Storefront',
      monthlyAmount: 5900 // $59.00
    };

    return res.status(200).json({ success: true, data: overview });
  } catch (error: any) {
    console.error('[TenantBilling] Error getting billing overview:', error);
    return res.status(500).json({ success: false, error: 'Failed to get billing overview' });
  }
});

/**
 * GET /api/tenants/:tenantId/billing/risk
 * Get subscription risk assessment
 */
router.get('/risk', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user.id;

    // Verify user has access to this tenant
    const tenantUser = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        user_id: userId 
      },
      select: { role: true }
    });

    if (!tenantUser) {
      return res.status(404).json({ success: false, error: 'Tenant not found or access denied' });
    }

    // Mock risk assessment data
    const risk = {
      level: 'medium',
      score: 45,
      factors: [
        {
          type: 'expiring_card',
          severity: 'medium',
          description: 'Payment method expires in 22 days',
          impact: 'Next payment may fail',
          timeframe: '22 days'
        }
      ],
      recommendedActions: [
        {
          type: 'payment_method',
          priority: 'high',
          title: 'Update Payment Method',
          description: 'Your payment method is expiring soon',
          actionUrl: '/settings/billing/payment-methods',
          actionText: 'Update Now'
        }
      ]
    };

    return res.status(200).json({ success: true, data: risk });
  } catch (error: any) {
    console.error('[TenantBilling] Error calculating risk assessment:', error);
    return res.status(500).json({ success: false, error: 'Failed to calculate risk assessment' });
  }
});

/**
 * GET /api/tenants/:tenantId/billing/actions
 * Get actionable billing tasks
 */
router.get('/actions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user.id;

    // Verify user has access to this tenant
    const tenantUser = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        user_id: userId 
      },
      select: { role: true }
    });

    if (!tenantUser) {
      return res.status(404).json({ success: false, error: 'Tenant not found or access denied' });
    }

    // Mock action items
    const actions = [
      {
        id: '1',
        type: 'payment_method',
        priority: 'high',
        title: 'Update Payment Method',
        description: 'Your payment method expires soon',
        actionUrl: '/settings/billing/payment-methods',
        actionText: 'Update Payment Method',
        dueDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000)
      }
    ];

    return res.status(200).json({ success: true, data: actions });
  } catch (error: any) {
    console.error('[TenantBilling] Error getting billing actions:', error);
    return res.status(500).json({ success: false, error: 'Failed to get billing actions' });
  }
});

/**
 * GET /api/tenants/:tenantId/billing/recent-activity
 * Get recent billing activity
 */
router.get('/recent-activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const userId = (req as any).user.id;

    // Verify user has access to this tenant
    const tenantUser = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        user_id: userId 
      },
      select: { role: true }
    });

    if (!tenantUser) {
      return res.status(404).json({ success: false, error: 'Tenant not found or access denied' });
    }

    // Mock activity data
    const activities = [
      {
        id: '1',
        type: 'payment',
        title: 'Monthly Subscription Payment',
        amount: 5900,
        status: 'success',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        id: '2',
        type: 'invoice',
        title: 'Platform Fee Invoice',
        amount: 450,
        status: 'pending',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ];

    activities.sort((a: any, b: any) => b.date.getTime() - a.date.getTime());
    const limitedActivities = activities.slice(0, limit);

    return res.status(200).json({ success: true, data: limitedActivities });
  } catch (error: any) {
    console.error('[TenantBilling] Error getting recent activity:', error);
    return res.status(500).json({ success: false, error: 'Failed to get recent activity' });
  }
});

/**
 * GET /api/tenants/:tenantId/billing/payment-methods
 * Get payment methods for tenant
 */
router.get('/payment-methods', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user.id;

    // Verify user has access to this tenant
    const tenantUser = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        user_id: userId 
      },
      select: { role: true }
    });

    if (!tenantUser) {
      return res.status(404).json({ success: false, error: 'Tenant not found or access denied' });
    }

    // Mock payment methods data
    const paymentMethods = [
      {
        id: 'pm_card_1234567890',
        type: 'card',
        last4: '4242',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2025,
        isDefault: true,
        createdAt: new Date('2024-01-15')
      }
    ];

    return res.status(200).json({ success: true, data: paymentMethods });
  } catch (error: any) {
    console.error('[TenantBilling] Error getting payment methods:', error);
    return res.status(500).json({ success: false, error: 'Failed to get payment methods' });
  }
});

/**
 * POST /api/tenants/:tenantId/billing/payment-methods
 * Add new payment method
 */
router.post('/payment-methods', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { type, paymentMethodId, isDefault } = req.body;
    const userId = (req as any).user.id;

    // Verify user has access to this tenant
    const tenantUser = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        user_id: userId 
      },
      select: { role: true }
    });

    if (!tenantUser) {
      return res.status(404).json({ success: false, error: 'Tenant not found or access denied' });
    }

    // Mock implementation
    const newPaymentMethod = {
      id: paymentMethodId,
      type,
      last4: '4242',
      brand: 'visa',
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault: isDefault || false,
      createdAt: new Date()
    };

    return res.status(200).json({ success: true, data: newPaymentMethod });
  } catch (error: any) {
    console.error('[TenantBilling] Error adding payment method:', error);
    return res.status(500).json({ success: false, error: 'Failed to add payment method' });
  }
});

/**
 * PUT /api/tenants/:tenantId/billing/payment-methods/:paymentMethodId
 * Update payment method
 */
router.put('/payment-methods/:paymentMethodId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId, paymentMethodId } = req.params;
    const { isDefault } = req.body;
    const userId = (req as any).user.id;

    // Verify user has access to this tenant
    const tenantUser = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        user_id: userId 
      },
      select: { role: true }
    });

    if (!tenantUser) {
      return res.status(404).json({ success: false, error: 'Tenant not found or access denied' });
    }

    // Mock implementation
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[TenantBilling] Error updating payment method:', error);
    return res.status(500).json({ success: false, error: 'Failed to update payment method' });
  }
});

/**
 * DELETE /api/tenants/:tenantId/billing/payment-methods/:paymentMethodId
 * Remove payment method
 */
router.delete('/payment-methods/:paymentMethodId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId, paymentMethodId } = req.params;
    const userId = (req as any).user.id;

    // Verify user has access to this tenant
    const tenantUser = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        user_id: userId 
      },
      select: { role: true }
    });

    if (!tenantUser) {
      return res.status(404).json({ success: false, error: 'Tenant not found or access denied' });
    }

    // Mock implementation
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[TenantBilling] Error removing payment method:', error);
    return res.status(500).json({ success: false, error: 'Failed to remove payment method' });
  }
});

/**
 * GET /api/tenants/:tenantId/billing/analytics
 * Get billing analytics
 */
router.get('/analytics', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const period = (req.query.period as string) || '6m';
    const userId = (req as any).user.id;

    // Verify user has access to this tenant
    const tenantUser = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        user_id: userId 
      },
      select: { role: true }
    });

    if (!tenantUser) {
      return res.status(404).json({ success: false, error: 'Tenant not found or access denied' });
    }

    // Mock analytics data
    const analytics = {
      period,
      totalSpent: 35400, // $354.00
      averageMonthly: 5900, // $59.00
      platformFees: 4500, // $45.00
      transactionFees: 1200, // $12.00
      subscriptionFees: 29700, // $297.00
      monthlyBreakdown: [
        {
          month: 'January 2024',
          total: 5900,
          subscription: 5400,
          platformFees: 300,
          transactionFees: 200
        },
        {
          month: 'February 2024',
          total: 5900,
          subscription: 5400,
          platformFees: 300,
          transactionFees: 200
        }
      ],
      paymentMethods: [
        {
          type: 'card',
          count: 6,
          total: 35400
        }
      ],
      projections: {
        nextMonth: 5900,
        nextQuarter: 17700,
        yearly: 70800
      }
    };

    return res.status(200).json({ success: true, data: analytics });
  } catch (error: any) {
    console.error('[TenantBilling] Error getting analytics:', error);
    return res.status(500).json({ success: false, error: 'Failed to get analytics' });
  }
});

/**
 * GET /api/tenants/:tenantId/billing/platform-fees
 * Get platform fee summary
 */
router.get('/platform-fees', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user.id;

    // Verify user has access to this tenant
    const tenantUser = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        user_id: userId 
      },
      select: { role: true }
    });

    if (!tenantUser) {
      return res.status(404).json({ success: false, error: 'Tenant not found or access denied' });
    }

    // Mock platform fee summary
    const summary = {
      currentMonth: 300,
      lastMonth: 300,
      yearToDate: 1800,
      transactions: 6
    };

    return res.status(200).json({ success: true, data: summary });
  } catch (error: any) {
    console.error('[TenantBilling] Error getting platform fees:', error);
    return res.status(500).json({ success: false, error: 'Failed to get platform fee summary' });
  }
});

/**
 * POST /api/tenants/:tenantId/billing/invoices/:invoiceId/pay
 * Pay invoice
 */
router.post('/invoices/:invoiceId/pay', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId, invoiceId } = req.params;
    const { paymentMethodId } = req.body;
    const userId = (req as any).user.id;

    // Verify user has access to this tenant
    const tenantUser = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        user_id: userId 
      },
      select: { role: true }
    });

    if (!tenantUser) {
      return res.status(404).json({ success: false, error: 'Tenant not found or access denied' });
    }

    // Mock implementation
    const paymentIntent = `pi_mock_${Date.now()}`;

    return res.status(200).json({ 
      success: true, 
      paymentIntent 
    });
  } catch (error: any) {
    console.error('[TenantBilling] Error paying invoice:', error);
    return res.status(500).json({ success: false, error: 'Failed to process payment' });
  }
});

// Get billing statements
router.get('/statements', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user.id;

    // Verify user has access to this tenant
    const tenantUser = await prisma.user_tenants.findFirst({
      where: { 
        tenant_id: tenantId,
        user_id: userId 
      },
      select: { role: true }
    });

    if (!tenantUser) {
      return res.status(404).json({ success: false, error: 'Tenant not found or access denied' });
    }

    const userRole = tenantUser.role;
    if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get real billing statements from database
    const [subscriptionInvoices, platformFeeInvoices] = await Promise.all([
      // Get subscription invoices
      prisma.subscription_invoices.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: 50
      }),
      // Get platform fee invoices
      prisma.platform_fee_invoices.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: 50
      })
    ]);

    // Combine and format statements
    const statements = [
      // Format subscription invoices as statements
      ...subscriptionInvoices.map(invoice => ({
        id: invoice.id,
        period: `${invoice.tier} Subscription`,
        startDate: invoice.billing_period_start,
        endDate: invoice.billing_period_end,
        totalAmount: invoice.amount_cents,
        subscriptionAmount: invoice.amount_cents,
        platformFees: 0,
        transactionFees: 0,
        status: invoice.status === 'paid' ? 'paid' : 
                invoice.status === 'pending' ? 'available' : 'draft',
        generatedAt: invoice.created_at || new Date(),
        downloadUrl: `/api/tenants/${tenantId}/billing/statements/${invoice.id}/download`
      })),
      // Format platform fee invoices as statements
      ...platformFeeInvoices.map(invoice => ({
        id: invoice.id,
        period: `Platform Fees - ${invoice.period_start?.toLocaleDateString() || ''} to ${invoice.period_end?.toLocaleDateString() || ''}`,
        startDate: invoice.period_start || new Date(),
        endDate: invoice.period_end || new Date(),
        totalAmount: Number(invoice.total_fees_cents || 0),
        subscriptionAmount: 0,
        platformFees: Number(invoice.stripe_fees_cents || 0) + Number(invoice.paypal_fees_cents || 0) + Number(invoice.square_fees_cents || 0) + Number(invoice.clover_fees_cents || 0) + Number(invoice.other_fees_cents || 0),
        transactionFees: 0, // Platform fees include transaction fees
        status: invoice.status === 'paid' ? 'paid' : 
                invoice.status === 'pending' ? 'available' : 'draft',
        generatedAt: invoice.created_at || new Date(),
        downloadUrl: `/api/tenants/${tenantId}/billing/statements/${invoice.id}/download`
      }))
    ].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    return res.status(200).json({ 
      success: true, 
      statements 
    });
  } catch (error: any) {
    console.error('[TenantBilling] Error getting statements:', error);
    return res.status(500).json({ success: false, error: 'Failed to get billing statements' });
  }
});

export default router;
