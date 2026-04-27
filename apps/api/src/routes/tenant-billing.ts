/**
 * Tenant Billing API Routes
 * 
 * Routes for tenant billing management including overview, risk assessment, 
 * actionable tasks, and recent activity.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { jsPDF } from 'jspdf';

const router = Router({ mergeParams: true });

// Helper to check if user is platform admin
const isPlatformAdmin = (user: any): boolean => {
  return user?.role === 'PLATFORM_ADMIN' || user?.role === 'platform_admin';
};

// Helper to verify tenant access (returns true if access granted, false otherwise)
const verifyTenantAccess = async (tenantId: string, user: any): Promise<{ allowed: boolean; error?: string }> => {
  // Platform admins have access to all tenants
  if (isPlatformAdmin(user)) {
    return { allowed: true };
  }
  
  const userId = user.id;
  const tenantUser = await prisma.user_tenants.findFirst({
    where: { 
      tenant_id: tenantId,
      user_id: userId 
    },
    select: { role: true }
  });

  if (!tenantUser) {
    return { allowed: false, error: 'Tenant not found or access denied' };
  }

  if (tenantUser.role !== 'ADMIN' && tenantUser.role !== 'OWNER') {
    return { allowed: false, error: 'Access denied' };
  }

  return { allowed: true };
};

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
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
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
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
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
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
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
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
    }

    // Fetch real data from database
    const [subscriptionInvoices, platformFeeInvoices] = await Promise.all([
      // Get subscription invoices with payments
      prisma.subscription_invoices.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: limit,
        include: {
          subscription_payments: true
        }
      }),
      // Get platform fee invoices
      prisma.platform_fee_invoices.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: limit
      })
    ]);

    // Extract payments from invoices
    const payments = subscriptionInvoices.flatMap(inv => inv.subscription_payments || []);

    // Format activities
    const activities: any[] = [];
    
    // Add subscription invoices
    for (const inv of subscriptionInvoices) {
      activities.push({
        id: inv.id,
        type: 'invoice',
        title: 'Subscription Invoice',
        amount: Number(inv.amount_cents),
        status: inv.status || 'pending',
        date: inv.created_at,
        dueDate: inv.due_date,
        paidAt: inv.paid_at
      });
    }
    
    // Add platform fee invoices
    for (const inv of platformFeeInvoices) {
      activities.push({
        id: inv.id,
        type: 'invoice',
        title: 'Platform Fee Invoice',
        amount: Number(inv.total_fees_cents),
        status: inv.status || 'pending',
        date: inv.created_at,
        dueDate: inv.due_date,
        paidAt: inv.paid_at
      });
    }
    
    // Add payments
    for (const p of payments) {
      activities.push({
        id: p.id,
        type: 'payment',
        title: p.gateway_type ? `${p.gateway_type} Payment` : 'Payment',
        amount: Number(p.amount_cents),
        status: p.status || 'success',
        date: p.created_at
      });
    }

    // Sort by date descending and limit
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
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
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
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
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
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
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
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
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
    }

    // Calculate date range based on period
    const now = new Date();
    const monthsBack = period === '3m' ? 3 : period === '12m' ? 12 : 6;
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

    // Fetch real data from database
    const [subscriptionInvoices, platformFeeInvoices] = await Promise.all([
      prisma.subscription_invoices.findMany({
        where: { 
          tenant_id: tenantId,
          created_at: { gte: startDate }
        },
        orderBy: { created_at: 'desc' },
        include: {
          subscription_payments: true
        }
      }),
      prisma.platform_fee_invoices.findMany({
        where: { 
          tenant_id: tenantId,
          created_at: { gte: startDate }
        },
        orderBy: { created_at: 'desc' }
      })
    ]);
    
    // Extract payments from invoices
    const payments = subscriptionInvoices.flatMap(inv => inv.subscription_payments || []);

    // Calculate totals
    const subscriptionFees = subscriptionInvoices.reduce((sum, inv) => sum + Number(inv.amount_cents), 0);
    const platformFees = platformFeeInvoices.reduce((sum, inv) => sum + Number(inv.total_fees_cents), 0);
    const transactionFees = payments.reduce((sum, p) => sum + Number(p.amount_cents || 0), 0);
    const totalSpent = subscriptionFees + platformFees + transactionFees;

    // Build monthly breakdown
    const monthlyMap = new Map<string, { total: number; subscription: number; platformFees: number; transactionFees: number }>();
    
    for (const inv of subscriptionInvoices) {
      const monthKey = (inv.created_at || new Date()).toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const existing = monthlyMap.get(monthKey) || { total: 0, subscription: 0, platformFees: 0, transactionFees: 0 };
      existing.subscription += Number(inv.amount_cents);
      existing.total += Number(inv.amount_cents);
      monthlyMap.set(monthKey, existing);
    }
    
    for (const inv of platformFeeInvoices) {
      const monthKey = (inv.created_at || new Date()).toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const existing = monthlyMap.get(monthKey) || { total: 0, subscription: 0, platformFees: 0, transactionFees: 0 };
      existing.platformFees += Number(inv.total_fees_cents);
      existing.total += Number(inv.total_fees_cents);
      monthlyMap.set(monthKey, existing);
    }
    
    for (const p of payments) {
      const monthKey = (p.created_at || new Date()).toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const existing = monthlyMap.get(monthKey) || { total: 0, subscription: 0, platformFees: 0, transactionFees: 0 };
      existing.transactionFees += Number(p.amount_cents || 0);
      existing.total += Number(p.amount_cents || 0);
      monthlyMap.set(monthKey, existing);
    }

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    // Payment method breakdown
    const paymentMethodMap = new Map<string, { count: number; total: number }>();
    for (const p of payments) {
      const type = p.gateway_type || 'card';
      const existing = paymentMethodMap.get(type) || { count: 0, total: 0 };
      existing.count += 1;
      existing.total += Number(p.amount_cents);
      paymentMethodMap.set(type, existing);
    }
    const paymentMethods = Array.from(paymentMethodMap.entries())
      .map(([type, data]) => ({ type, ...data }));

    // Calculate projections based on average
    const averageMonthly = totalSpent / monthsBack;
    const projections = {
      nextMonth: Math.round(averageMonthly),
      nextQuarter: Math.round(averageMonthly * 3),
      yearly: Math.round(averageMonthly * 12)
    };

    const analytics = {
      period,
      totalSpent,
      averageMonthly: Math.round(averageMonthly),
      platformFees,
      transactionFees,
      subscriptionFees,
      monthlyBreakdown,
      paymentMethods,
      projections
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
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
    }

    // Calculate date ranges
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Fetch real data from database
    const [currentMonthFees, lastMonthFees, yearToDateFees] = await Promise.all([
      prisma.platform_fee_invoices.findMany({
        where: {
          tenant_id: tenantId,
          created_at: { gte: currentMonthStart }
        }
      }),
      prisma.platform_fee_invoices.findMany({
        where: {
          tenant_id: tenantId,
          created_at: { gte: lastMonthStart, lte: lastMonthEnd }
        }
      }),
      prisma.platform_fee_invoices.findMany({
        where: {
          tenant_id: tenantId,
          created_at: { gte: yearStart }
        }
      })
    ]);

    const summary = {
      currentMonth: currentMonthFees.reduce((sum, inv) => sum + Number(inv.total_fees_cents), 0),
      lastMonth: lastMonthFees.reduce((sum, inv) => sum + Number(inv.total_fees_cents), 0),
      yearToDate: yearToDateFees.reduce((sum, inv) => sum + Number(inv.total_fees_cents), 0),
      transactions: yearToDateFees.length
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
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
    }

    // Find the invoice
    const invoice = await prisma.subscription_invoices.findFirst({
      where: { id: invoiceId, tenant_id: tenantId }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Create a payment record and update invoice status
    const paymentIntent = `pi_mock_${Date.now()}`;
    const now = new Date();

    // Update invoice to paid
    await prisma.subscription_invoices.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paid_at: now
      }
    });

    // Create payment record
    await prisma.subscription_payments.create({
      data: {
        id: `spay-${invoiceId}-${Date.now().toString(36)}`,
        invoice_id: invoiceId,
        gateway_type: 'stripe',
        transaction_id: paymentIntent,
        amount_cents: invoice.amount_cents,
        status: 'succeeded',
        created_at: now
      }
    });

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
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
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
        paidAt: invoice.paid_at,
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
        paidAt: invoice.paid_at,
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

/**
 * GET /api/tenants/:tenantId/billing/statements/:statementId/download
 * Download billing statement as PDF
 */
router.get('/statements/:statementId/download', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId, statementId } = req.params;
    const user = (req as any).user;

    const accessCheck = await verifyTenantAccess(tenantId, user);
    if (!accessCheck.allowed) {
      return res.status(404).json({ success: false, error: accessCheck.error });
    }

    // Get tenant info
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { name: true }
    });

    // Try to find the invoice (subscription or manual)
    const invoice = await prisma.subscription_invoices.findUnique({
      where: { id: statementId },
      include: {
        subscription_payments: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Statement not found' });
    }

    // Verify invoice belongs to tenant
    if (invoice.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get platform branding settings
    const platformSettings = await prisma.platform_settings_list.findFirst();
    const branding = {
      platformName: platformSettings?.platform_name || 'Visible Shelf',
      logoUrl: platformSettings?.logo_url,
      primaryColor: (platformSettings?.theme_colors as any)?.primary || '#0066ff',
      contactEmail: platformSettings?.contact_email || 'billing@visibleshelf.store',
      contactPhone: platformSettings?.contact_phone || '(913) 703-6157',
      contactAddress: platformSettings?.contact_address || '',
      contactWebsite: platformSettings?.contact_website || 'https://visibleshelf.store',
    };

    // Generate PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = 20;

    // Add logo if available
    let hasLogo = false;
    if (branding.logoUrl) {
      try {
        const logoResponse = await fetch(branding.logoUrl);
        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer();
          const logoBase64 = Buffer.from(logoBuffer).toString('base64');
          const logoDataUri = `data:image/png;base64,${logoBase64}`;

          const imgProps = doc.getImageProperties(logoDataUri);
          const aspectRatio = imgProps.width / imgProps.height;
          const logoWidth = 20;
          const logoHeight = logoWidth / aspectRatio;

          doc.addImage(logoDataUri, 'PNG', margin, yPos, logoWidth, logoHeight);
          yPos += logoHeight + 5;
          hasLogo = true;
        }
      } catch (e) {
        console.log('[Statement PDF] Could not load logo, using text');
      }
    }

    // Header with platform branding (only if no logo)
    if (!hasLogo) {
      doc.setFontSize(30);
      doc.setTextColor(branding.primaryColor);
      doc.text(branding.platformName, margin, yPos);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      yPos += 8;
      if (branding.contactWebsite) {
        doc.text(branding.contactWebsite, margin, yPos);
        yPos += 5;
      }
    }

    // Statement title (right side, right-aligned)
    doc.setFontSize(19);
    doc.setTextColor(0, 0, 0);
    doc.text('BILLING STATEMENT', pageWidth - margin, 20, { align: 'right' });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`#${statementId}`, pageWidth - margin, 28, { align: 'right' });

    // From/To section
    yPos = 50;
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    
    // From
    doc.setFont('helvetica', 'bold');
    doc.text('From:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    doc.text(branding.platformName, margin, yPos);
    yPos += 5;
    if (branding.contactEmail) doc.text(branding.contactEmail, margin, yPos);
    yPos += 5;
    if (branding.contactAddress) {
      const addressLines = branding.contactAddress.split('\n');
      for (const line of addressLines) {
        doc.text(line, margin, yPos);
        yPos += 5;
      }
    }

    // To (right side)
    yPos = 50;
    const toX = pageWidth / 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', toX, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    doc.text(tenant?.name || 'Tenant', toX, yPos);

    // Invoice details
    yPos += 20;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    const formatDate = (date: Date | string | null) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    const infoRows = [
      ['Statement ID:', statementId],
      ['Invoice Date:', formatDate(invoice.created_at)],
      ['Due Date:', formatDate(invoice.due_date)],
      ['Status:', (invoice.status || 'pending').toUpperCase()],
    ];

    if (invoice.paid_at) {
      infoRows.push(['Payment Date:', formatDate(invoice.paid_at)]);
    }

    for (const [label, value] of infoRows) {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, margin + 40, yPos);
      yPos += 6;
    }

    // Line items header
    yPos += 10;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Description', margin + 2, yPos + 5);
    doc.text('Amount', pageWidth - margin - 20, yPos + 5, { align: 'right' });
    yPos += 12;

    // Line item
    doc.setFont('helvetica', 'normal');
    doc.text('Subscription Invoice', margin + 2, yPos);
    doc.text(formatPrice(Number(invoice.amount_cents)), pageWidth - margin - 20, yPos, { align: 'right' });
    yPos += 8;

    // Total
    yPos += 5;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', margin + 2, yPos);
    doc.text(formatPrice(Number(invoice.amount_cents)), pageWidth - margin - 20, yPos, { align: 'right' });

    // Payment history
    if (invoice.subscription_payments && invoice.subscription_payments.length > 0) {
      yPos += 15;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Payment History', margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      for (const payment of invoice.subscription_payments) {
        doc.text(`${payment.gateway_type} - ${formatDate(payment.created_at)} - ${formatPrice(Number(payment.amount_cents))} - ${payment.status}`, margin, yPos);
        yPos += 5;
      }
    }

    // Footer
    yPos = doc.internal.pageSize.getHeight() - 30;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This is a computer-generated statement.', pageWidth / 2, yPos, { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos + 5, { align: 'center' });

    // Return PDF as binary
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Generate unique filename with tenant, date, and statement ID
    const dateStr = new Date().toISOString().split('T')[0];
    // Create a safe slug from tenant name or use tenant ID
    const safeName = (tenant?.name || tenantId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric sequences with single dash
      .replace(/^-|-$/g, '');        // Remove leading/trailing dashes
    const filename = `statement-${safeName}-${dateStr}-${statementId.substring(0, 8)}.pdf`;

    // Use RFC 5987 encoding for filenames with special characters
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('[TenantBilling] Error downloading statement:', error);
    return res.status(500).json({ success: false, error: 'Failed to download statement' });
  }
});

export default router;
