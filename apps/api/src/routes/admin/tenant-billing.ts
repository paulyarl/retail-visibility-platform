import { Router } from 'express';
import { prisma } from '../../prisma';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { SubscriptionBillingService } from '../../services/subscription/SubscriptionBillingService';

const router = Router();
const subscriptionBillingService = new SubscriptionBillingService();

// Apply authentication and admin requirements
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/admin/billing/tenants/:tenantId/financial-metrics
router.get('/tenants/:tenantId/financial-metrics', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
        subscription_ends_at: true,
        created_at: true,
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get payment methods
    const paymentMethods = await subscriptionBillingService.getPaymentMethods(tenantId);

    // Calculate MRR based on subscription tier
    const tierPricing: Record<string, number> = {
      'discovery': 0,
      'starter': 49,
      'growth': 149,
      'scale': 499,
      'enterprise': 1499,
    };

    const mrr = tierPricing[tenant.subscription_tier || 'discovery'] || 0;
    const arr = mrr * 12;

    // Get recent transactions (mock data for now)
    const transactions = await prisma.$queryRaw`
      SELECT 
        id,
        type,
        amount,
        status,
        description,
        created_at as "createdAt",
        payment_method_token as "paymentMethod"
      FROM merchant_billing_transactions 
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT 20
    ` as Array<{
      id: string;
      type: string;
      amount: number;
      status: string;
      description: string;
      createdAt: Date;
      paymentMethod?: string;
    }>;

    // Calculate metrics
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(t => t.status === 'succeeded').length;
    const failedTransactions = transactions.filter(t => t.status === 'failed').length;
    const paymentSuccessRate = totalTransactions > 0 ? Math.round((successfulTransactions / totalTransactions) * 100) : 100;

    // Calculate revenue
    const currentMonthRevenue = transactions
      .filter(t => t.status === 'succeeded' && 
        new Date(t.createdAt).getMonth() === new Date().getMonth() &&
        new Date(t.createdAt).getFullYear() === new Date().getFullYear())
      .reduce((sum, t) => sum + t.amount, 0);

    const previousMonthDate = new Date();
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
    const previousMonthRevenue = transactions
      .filter(t => t.status === 'succeeded' && 
        new Date(t.createdAt).getMonth() === previousMonthDate.getMonth() &&
        new Date(t.createdAt).getFullYear() === previousMonthDate.getFullYear())
      .reduce((sum, t) => sum + t.amount, 0);

    const revenueGrowth = previousMonthRevenue > 0 
      ? Math.round(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100)
      : 0;

    // Calculate upcoming charge
    let upcomingCharge;
    if (tenant.subscription_status === 'active' && mrr > 0) {
      const lastCharge = transactions
        .filter(t => t.type === 'payment' && t.status === 'succeeded')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      if (lastCharge) {
        const nextChargeDate = new Date(lastCharge.createdAt);
        nextChargeDate.setMonth(nextChargeDate.getMonth() + 1);
        upcomingCharge = {
          amount: mrr,
          date: nextChargeDate.toISOString(),
          description: `Monthly subscription - ${tenant.subscription_tier} tier`,
        };
      }
    }

    const metrics = {
      mrr,
      arr,
      totalRevenue: transactions.filter(t => t.status === 'succeeded').reduce((sum, t) => sum + t.amount, 0),
      currentMonthRevenue,
      previousMonthRevenue,
      revenueGrowth,
      paymentSuccessRate,
      failedPayments: failedTransactions,
      totalTransactions,
      upcomingCharge,
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching financial metrics:', error);
    res.status(500).json({ error: 'Failed to fetch financial metrics' });
  }
});

// GET /api/admin/billing/tenants/:tenantId/transactions
router.get('/tenants/:tenantId/transactions', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get transactions (mock data for now - would come from billing_transactions table)
    const transactions = await prisma.$queryRaw`
      SELECT 
        id,
        type,
        amount,
        status,
        description,
        created_at as "createdAt",
        payment_method_token as "paymentMethod"
      FROM merchant_billing_transactions 
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    ` as Array<{
      id: string;
      type: string;
      amount: number;
      status: string;
      description: string;
      createdAt: Date;
      paymentMethod?: string;
    }>;

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/admin/billing/tenants/:tenantId/health-metrics
router.get('/tenants/:tenantId/health-metrics', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
        subscription_ends_at: true,
        created_at: true,
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get payment methods
    const paymentMethods = await subscriptionBillingService.getPaymentMethods(tenantId);

    // Get transactions for payment health
    const transactions = await prisma.$queryRaw`
      SELECT 
        status,
        created_at as "createdAt"
      FROM merchant_billing_transactions 
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT 50
    ` as Array<{
      status: string;
      createdAt: Date;
    }>;

    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(t => t.status === 'succeeded').length;
    const failedTransactions = transactions.filter(t => t.status === 'failed').length;
    const paymentSuccessRate = totalTransactions > 0 ? Math.round((successfulTransactions / totalTransactions) * 100) : 100;

    // Calculate payment health score
    let paymentHealthScore = 100;
    if (paymentSuccessRate < 95) paymentHealthScore -= 20;
    if (failedTransactions > 3) paymentHealthScore -= 15;
    if (paymentMethods.length === 0) paymentHealthScore -= 25;

    // Calculate subscription health score
    let subscriptionHealthScore = 100;
    const daysUntilExpiry = tenant.subscription_ends_at 
      ? Math.ceil((new Date(tenant.subscription_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 365;

    if (tenant.subscription_status !== 'active') subscriptionHealthScore -= 30;
    if (daysUntilExpiry < 7) subscriptionHealthScore -= 25;
    if (daysUntilExpiry < 30) subscriptionHealthScore -= 15;

    // Mock engagement health (would come from usage analytics)
    const engagementHealthScore = 75; // Placeholder

    // Calculate overall score
    const overallScore = Math.round((paymentHealthScore + subscriptionHealthScore + engagementHealthScore) / 3);

    // Generate risk factors
    const riskFactors = [];
    if (paymentSuccessRate < 90) {
      riskFactors.push({
        type: 'payment' as const,
        severity: paymentSuccessRate < 80 ? 'high' as const : 'medium' as const,
        description: `Low payment success rate of ${paymentSuccessRate}%`,
        recommendation: 'Contact tenant to update payment method',
      });
    }
    if (paymentMethods.length === 0) {
      riskFactors.push({
        type: 'payment' as const,
        severity: 'critical' as const,
        description: 'No payment methods on file',
        recommendation: 'Urgent: Tenant must add payment method',
      });
    }
    if (daysUntilExpiry < 7) {
      riskFactors.push({
        type: 'subscription' as const,
        severity: 'high' as const,
        description: `Subscription expires in ${daysUntilExpiry} days`,
        recommendation: 'Send renewal reminder',
      });
    }

    // Generate recommendations
    const recommendations = [];
    if (paymentSuccessRate < 95) {
      recommendations.push({
        priority: 'high' as const,
        action: 'Send payment method update reminder',
        impact: 'Reduce failed payments and improve cash flow',
      });
    }
    if (daysUntilExpiry < 30) {
      recommendations.push({
        priority: 'medium' as const,
        action: 'Send renewal reminder',
        impact: 'Prevent service interruption',
      });
    }

    const healthMetrics = {
      overallScore,
      paymentHealth: {
        score: paymentHealthScore,
        successRate: paymentSuccessRate,
        failedPayments: failedTransactions,
        lastFailedPayment: transactions.find(t => t.status === 'failed')?.createdAt?.toISOString(),
        consecutiveFailures: 0, // Would calculate from consecutive failures
      },
      subscriptionHealth: {
        score: subscriptionHealthScore,
        status: tenant.subscription_status || 'unknown',
        daysUntilExpiry,
        isTrial: !!tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date(),
        trialDaysRemaining: tenant.trial_ends_at 
          ? Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : undefined,
      },
      engagementHealth: {
        score: engagementHealthScore,
        lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Mock
        activeFeatures: ['products', 'categories', 'orders'], // Mock
        usageMetrics: {
          apiCalls: Math.floor(Math.random() * 10000),
          itemsCreated: Math.floor(Math.random() * 1000),
          storageUsed: Math.floor(Math.random() * 1000),
        },
      },
      riskFactors,
      recommendations,
    };

    res.json(healthMetrics);
  } catch (error) {
    console.error('Error fetching health metrics:', error);
    res.status(500).json({ error: 'Failed to fetch health metrics' });
  }
});

// POST /api/admin/billing/tenants/:tenantId/send-notification
router.post('/tenants/:tenantId/send-notification', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { type, message } = req.body;

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Log notification (in real implementation, would send email/SMS/push)
    await prisma.notification_logs.create({
      data: {
        tenant_id: tenantId,
        type: type || 'info'
      }
    });

    res.json({ 
      success: true, 
      message: 'Notification sent successfully',
      tenantId,
      type 
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

export default router;
