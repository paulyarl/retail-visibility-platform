import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';

const router = Router();

// Apply authentication and admin requirements
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/admin/billing/revenue/overview
router.get('/revenue/overview', async (req, res) => {
  try {
    const { period = '90d' } = req.query;

    // Mock data - would be calculated from actual database
    const metrics = {
      totalMRR: 12450,
      totalARR: 149400,
      totalRevenue: 89750,
      currentMonthRevenue: 12450,
      previousMonthRevenue: 11200,
      revenueGrowth: 11.2,
      projectedRevenue: 13500,
      churnRate: 3.2,
      netRevenueRetention: 104.5,
      customerLifetimeValue: 2400,
      averageRevenuePerUser: 85
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching revenue metrics:', error);
    res.status(500).json({ error: 'Failed to fetch revenue metrics' });
  }
});

// GET /api/admin/billing/revenue/trends
router.get('/revenue/trends', async (req, res) => {
  try {
    const { period = '90d' } = req.query;

    // Mock trend data
    const trends = [
      { date: '2024-01-01', mrr: 10500, arr: 126000, revenue: 10500, newCustomers: 12, churnedCustomers: 2 },
      { date: '2024-01-15', mrr: 10800, arr: 129600, revenue: 10800, newCustomers: 8, churnedCustomers: 1 },
      { date: '2024-02-01', mrr: 11200, arr: 134400, revenue: 11200, newCustomers: 15, churnedCustomers: 3 },
      { date: '2024-02-15', mrr: 11500, arr: 138000, revenue: 11500, newCustomers: 10, churnedCustomers: 2 },
      { date: '2024-03-01', mrr: 11800, arr: 141600, revenue: 11800, newCustomers: 18, churnedCustomers: 4 },
      { date: '2024-03-15', mrr: 12100, arr: 145200, revenue: 12100, newCustomers: 12, churnedCustomers: 2 },
      { date: '2024-04-01', mrr: 12450, arr: 149400, revenue: 12450, newCustomers: 20, churnedCustomers: 3 },
      { date: '2024-04-15', mrr: 12700, arr: 152400, revenue: 12700, newCustomers: 14, churnedCustomers: 1 },
    ];

    res.json(trends);
  } catch (error) {
    console.error('Error fetching revenue trends:', error);
    res.status(500).json({ error: 'Failed to fetch revenue trends' });
  }
});

// GET /api/admin/billing/revenue/tier-distribution
router.get('/revenue/tier-distribution', async (req, res) => {
  try {
    // Mock tier distribution data
    const distribution = [
      { tier: 'Starter', count: 85, revenue: 4165, percentage: 33.4 },
      { tier: 'Growth', count: 42, revenue: 6258, percentage: 50.3 },
      { tier: 'Scale', count: 12, revenue: 5988, percentage: 48.1 },
      { tier: 'Enterprise', count: 3, revenue: 4497, percentage: 36.1 }
    ];

    res.json(distribution);
  } catch (error) {
    console.error('Error fetching tier distribution:', error);
    res.status(500).json({ error: 'Failed to fetch tier distribution' });
  }
});

// GET /api/admin/billing/revenue/cohort-analysis
router.get('/revenue/cohort-analysis', async (req, res) => {
  try {
    // Mock cohort data
    const cohortData = [
      { cohort: '2024-01', size: 45, month1: 100, month2: 95, month3: 92, month4: 89, month5: 87, month6: 85 },
      { cohort: '2024-02', size: 38, month1: 100, month2: 96, month3: 93, month4: 91, month5: 88, month6: 86 },
      { cohort: '2024-03', size: 52, month1: 100, month2: 97, month3: 94, month4: 92, month5: 90, month6: 88 },
      { cohort: '2024-04', size: 41, month1: 100, month2: 98, month3: 95, month4: 93, month5: 91, month6: 89 },
    ];

    res.json(cohortData);
  } catch (error) {
    console.error('Error fetching cohort analysis:', error);
    res.status(500).json({ error: 'Failed to fetch cohort analysis' });
  }
});

// GET /api/admin/billing/invoices
router.get('/invoices', async (req, res) => {
  try {
    const { status, type, search, page = 1, limit = 50 } = req.query;

    // Mock invoice data
    const invoices = [
      {
        id: 'inv_001',
        invoiceNumber: 'INV-2024-001',
        tenantId: 'tenant_001',
        tenantName: 'Acme Corporation',
        amount: 149.00,
        status: 'paid',
        dueDate: '2024-04-15',
        createdAt: '2024-04-01',
        paidAt: '2024-04-14',
        description: 'Monthly subscription - Growth tier',
        type: 'subscription',
        paymentMethod: 'Visa ending in 4242',
        retryCount: 0
      },
      {
        id: 'inv_002',
        invoiceNumber: 'INV-2024-002',
        tenantId: 'tenant_002',
        tenantName: 'Tech Startup Inc',
        amount: 499.00,
        status: 'pending',
        dueDate: '2024-04-20',
        createdAt: '2024-04-01',
        description: 'Monthly subscription - Scale tier',
        type: 'subscription',
        paymentMethod: 'PayPal',
        retryCount: 2,
        lastRetryAt: '2024-04-18'
      },
      {
        id: 'inv_003',
        invoiceNumber: 'INV-2024-003',
        tenantId: 'tenant_003',
        tenantName: 'Retail Solutions LLC',
        amount: 89.00,
        status: 'failed',
        dueDate: '2024-04-10',
        createdAt: '2024-04-01',
        description: 'Monthly subscription - Starter tier',
        type: 'subscription',
        paymentMethod: 'Mastercard ending in 5555',
        retryCount: 3,
        lastRetryAt: '2024-04-12'
      },
      {
        id: 'inv_004',
        invoiceNumber: 'INV-2024-004',
        tenantId: 'tenant_004',
        tenantName: 'Global Enterprises',
        amount: 1499.00,
        status: 'draft',
        dueDate: '2024-04-25',
        createdAt: '2024-04-18',
        description: 'Monthly subscription - Enterprise tier',
        type: 'subscription',
        retryCount: 0
      }
    ];

    // Apply filters (mock implementation)
    let filteredInvoices = invoices;
    if (status && status !== 'all') {
      filteredInvoices = filteredInvoices.filter(inv => inv.status === status);
    }
    if (type && type !== 'all') {
      filteredInvoices = filteredInvoices.filter(inv => inv.type === type);
    }
    if (search) {
      filteredInvoices = filteredInvoices.filter(inv => 
        inv.invoiceNumber.toLowerCase().includes((search as string).toLowerCase()) ||
        inv.tenantName.toLowerCase().includes((search as string).toLowerCase())
      );
    }

    const startIndex = (Number(page) - 1) * Number(limit);
    const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + Number(limit));

    res.json({
      invoices: paginatedInvoices,
      total: filteredInvoices.length,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(filteredInvoices.length / Number(limit))
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/admin/billing/invoices/stats
router.get('/invoices/stats', async (req, res) => {
  try {
    // Mock invoice stats
    const stats = {
      totalInvoices: 124,
      totalAmount: 156780.50,
      paidAmount: 142450.25,
      pendingAmount: 8956.75,
      failedAmount: 5373.50,
      overdueCount: 8,
      thisMonthRevenue: 12450.00,
      lastMonthRevenue: 11200.00
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    res.status(500).json({ error: 'Failed to fetch invoice stats' });
  }
});

// POST /api/admin/billing/invoices/generate
router.post('/invoices/generate', async (req, res) => {
  try {
    const { tenantIds, type, description, dueDate } = req.body;

    // Mock invoice generation
    const generatedInvoice = {
      id: `inv_${Date.now()}`,
      invoiceNumber: `INV-2024-${Math.floor(Math.random() * 1000)}`,
      tenantId: tenantIds[0],
      amount: 149.00,
      status: 'draft',
      dueDate,
      createdAt: new Date().toISOString(),
      description,
      type: type || 'subscription'
    };

    res.json({ success: true, invoice: generatedInvoice });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// GET /api/admin/billing/payments/analytics
router.get('/payments/analytics', async (req, res) => {
  try {
    const { period = '30d', gateway = 'all' } = req.query;

    // Mock payment analytics
    const metrics = {
      totalPayments: 15420,
      successfulPayments: 14856,
      failedPayments: 456,
      pendingPayments: 108,
      totalVolume: 1245780.50,
      successRate: 96.4,
      averageProcessingTime: 2.3,
      retryRate: 2.9,
      chargebackRate: 0.2
    };

    const paymentMethodAnalytics = [
      {
        gatewayType: 'stripe',
        totalTransactions: 12450,
        successRate: 97.2,
        volume: 987650.25,
        averageAmount: 79.30,
        failureReasons: [
          { reason: 'Insufficient funds', count: 145, percentage: 31.8 },
          { reason: 'Card expired', count: 89, percentage: 19.5 },
          { reason: 'Processing error', count: 67, percentage: 14.7 },
          { reason: 'Fraud declined', count: 45, percentage: 9.9 },
          { reason: 'Other', count: 110, percentage: 24.1 }
        ]
      },
      {
        gatewayType: 'paypal',
        totalTransactions: 2890,
        successRate: 94.8,
        volume: 245680.75,
        averageAmount: 85.00,
        failureReasons: [
          { reason: 'Insufficient funds', count: 78, percentage: 28.7 },
          { reason: 'Account restricted', count: 56, percentage: 20.6 },
          { reason: 'Processing error', count: 43, percentage: 15.8 },
          { reason: 'Timeout', count: 34, percentage: 12.5 },
          { reason: 'Other', count: 60, percentage: 22.4 }
        ]
      },
      {
        gatewayType: 'square',
        totalTransactions: 80,
        successRate: 91.3,
        volume: 12449.50,
        averageAmount: 155.62,
        failureReasons: [
          { reason: 'Connection error', count: 4, percentage: 36.4 },
          { reason: 'Invalid card', count: 3, percentage: 27.3 },
          { reason: 'Processing error', count: 2, percentage: 18.2 },
          { reason: 'Other', count: 2, percentage: 18.1 }
        ]
      }
    ];

    const geographicData = [
      { country: 'United States', count: 8945, volume: 712450.25, successRate: 96.8 },
      { country: 'Canada', count: 2340, volume: 187200.00, successRate: 95.2 },
      { country: 'United Kingdom', count: 1890, volume: 151200.00, successRate: 97.1 },
      { country: 'Australia', count: 890, volume: 71200.00, successRate: 94.6 },
      { country: 'Germany', count: 670, volume: 53600.00, successRate: 93.8 },
      { country: 'France', count: 450, volume: 36000.00, successRate: 95.5 },
      { country: 'Other', count: 235, volume: 18830.25, successRate: 92.3 }
    ];

    const failureAnalysis = [
      { reason: 'Insufficient funds', count: 223, percentage: 48.9, trend: 'stable', actionable: false },
      { reason: 'Card expired', count: 89, percentage: 19.5, trend: 'improving', actionable: true },
      { reason: 'Processing error', count: 112, percentage: 24.6, trend: 'worsening', actionable: true },
      { reason: 'Fraud declined', count: 32, percentage: 7.0, trend: 'improving', actionable: false }
    ];

    res.json({
      metrics,
      paymentMethodAnalytics: gateway === 'all' ? paymentMethodAnalytics : paymentMethodAnalytics.filter(pm => pm.gatewayType === gateway),
      geographicData,
      failureAnalysis
    });
  } catch (error) {
    console.error('Error fetching payment analytics:', error);
    res.status(500).json({ error: 'Failed to fetch payment analytics' });
  }
});

// GET /api/admin/billing/reports
router.get('/reports', async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;

    // Mock reports data
    const reports = [
      {
        id: 'rpt_001',
        name: 'Monthly Revenue Report - April 2024',
        type: 'monthly',
        status: 'completed',
        generatedAt: '2024-05-01T09:00:00Z',
        fileSize: 2048576,
        downloadUrl: '/api/admin/billing/reports/rpt_001/download',
        parameters: {
          startDate: '2024-04-01',
          endDate: '2024-04-30',
          includeMetrics: ['revenue', 'mrr', 'churn', 'customers'],
          format: 'pdf'
        }
      },
      {
        id: 'rpt_002',
        name: 'Q1 2024 Financial Summary',
        type: 'quarterly',
        status: 'completed',
        generatedAt: '2024-04-15T10:30:00Z',
        fileSize: 3072000,
        downloadUrl: '/api/admin/billing/reports/rpt_002/download',
        parameters: {
          startDate: '2024-01-01',
          endDate: '2024-03-31',
          includeMetrics: ['revenue', 'profit', 'customers', 'retention'],
          format: 'excel'
        }
      },
      {
        id: 'rpt_003',
        name: 'Annual Report 2023',
        type: 'annual',
        status: 'completed',
        generatedAt: '2024-01-15T14:00:00Z',
        fileSize: 5242880,
        downloadUrl: '/api/admin/billing/reports/rpt_003/download',
        parameters: {
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          includeMetrics: ['revenue', 'profit', 'customers', 'retention', 'geographic'],
          format: 'pdf'
        }
      },
      {
        id: 'rpt_004',
        name: 'Custom Analysis - High-Value Customers',
        type: 'custom',
        status: 'generating',
        parameters: {
          startDate: '2024-03-01',
          endDate: '2024-04-30',
          includeMetrics: ['customer_lifetime_value', 'revenue_attribution'],
          format: 'excel'
        }
      }
    ];

    // Apply filters
    let filteredReports = reports;
    if (status && status !== 'all') {
      filteredReports = filteredReports.filter(report => report.status === status);
    }
    if (type && type !== 'all') {
      filteredReports = filteredReports.filter(report => report.type === type);
    }

    const startIndex = (Number(page) - 1) * Number(limit);
    const paginatedReports = filteredReports.slice(startIndex, startIndex + Number(limit));

    res.json({
      reports: paginatedReports,
      total: filteredReports.length,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(filteredReports.length / Number(limit))
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// POST /api/admin/billing/reports/generate
router.post('/reports/generate', async (req, res) => {
  try {
    const { templateId, parameters } = req.body;

    // Mock report generation
    const reportId = `rpt_${Date.now()}`;
    const report = {
      id: reportId,
      name: parameters.name || `Generated Report ${new Date().toISOString()}`,
      type: parameters.type || 'custom',
      status: 'generating',
      parameters
    };

    // Simulate async generation
    setTimeout(() => {
      console.log(`Report ${reportId} generation completed`);
    }, 30000); // 30 seconds

    res.json({ success: true, report });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/admin/billing/reports/:reportId/download
router.get('/reports/:reportId/download', async (req, res) => {
  try {
    const { reportId } = req.params;

    // Mock file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.pdf"`);
    res.send('Mock PDF content for report download');
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ error: 'Failed to download report' });
  }
});

export default router;
