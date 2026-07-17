/**
 * Platform Fee Invoice API Routes
 * 
 * Handles monthly invoicing for non-Stripe platform fees:
 * - Invoice generation
 * - Payment tracking
 * - Waiver management
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { platformFeeInvoiceService } from '../services/PlatformFeeInvoiceService';
import { logger } from '../logger';

const router = Router();

// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

/**
 * GET /api/admin/platform-fee-invoices
 * List all invoices with filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, tenant_id, period_start, period_end, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    
    if (status) where.status = status;
    if (tenant_id) where.tenant_id = tenant_id;
    if (period_start || period_end) {
      where.period_start = {};
      if (period_start) where.period_start.gte = new Date(period_start as string);
      if (period_end) where.period_end = { lte: new Date(period_end as string) };
    }

    const invoices = await prisma.platform_fee_invoices.findMany({
      where,
      include: {
        tenants: {
          select: { name: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.platform_fee_invoices.count({ where });

    const result = invoices.map((inv: any) => ({
      ...inv,
      tenant_name: inv.tenants?.name,
      tenants: undefined,
    }));

    res.json({
      success: true,
      invoices: result,
      total,
    });
  } catch (error) {
    logger.error('[FeeInvoices] Error listing invoices:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'list_failed',
      message: 'Failed to list invoices',
    });
  }
});

/**
 * GET /api/admin/platform-fee-invoices/summary
 * Get invoice summary statistics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { period_start, period_end } = req.query;

    const startDate = period_start ? new Date(period_start as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = period_end ? new Date(period_end as string) : new Date();

    const summary = await platformFeeInvoiceService.getInvoiceSummary(startDate, endDate);

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error('[FeeInvoices] Error getting summary:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'summary_failed',
      message: 'Failed to get invoice summary',
    });
  }
});

/**
 * POST /api/admin/platform-fee-invoices/generate
 * Generate invoices for a period
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { period_start, period_end } = req.body;

    if (!period_start || !period_end) {
      return res.status(400).json({
        success: false,
        error: 'missing_dates',
        message: 'period_start and period_end are required',
      });
    }

    const startDate = new Date(period_start);
    const endDate = new Date(period_end);

    const results = await platformFeeInvoiceService.generateMonthlyInvoices(startDate, endDate);

    res.json({
      success: true,
      generated: results.length,
      invoices: results,
    });
  } catch (error) {
    logger.error('[FeeInvoices] Error generating invoices:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'generation_failed',
      message: 'Failed to generate invoices',
    });
  }
});

/**
 * GET /api/admin/platform-fee-invoices/:invoiceId
 * Get invoice details with line items
 */
router.get('/:invoiceId', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await prisma.platform_fee_invoices.findUnique({
      where: { id: invoiceId },
      include: {
        tenants: {
          select: { name: true, id: true },
        },
        platform_fee_invoice_items: {
          orderBy: { transaction_date: 'desc' },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'invoice_not_found',
        message: 'Invoice not found',
      });
    }

    res.json({
      success: true,
      invoice: {
        ...invoice,
        tenant_name: invoice.tenants?.name,
        tenants: undefined,
      },
    });
  } catch (error) {
    logger.error('[FeeInvoices] Error getting invoice:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'fetch_failed',
      message: 'Failed to fetch invoice',
    });
  }
});

/**
 * POST /api/admin/platform-fee-invoices/:invoiceId/pay
 * Mark invoice as paid
 */
router.post('/:invoiceId/pay', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { payment_method, stripe_payment_intent_id } = req.body;

    await platformFeeInvoiceService.markInvoicePaid(
      invoiceId,
      payment_method || 'manual',
      stripe_payment_intent_id
    );

    const invoice = await prisma.platform_fee_invoices.findUnique({
      where: { id: invoiceId },
    });

    res.json({
      success: true,
      invoice,
    });
  } catch (error) {
    logger.error('[FeeInvoices] Error marking invoice paid:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'payment_failed',
      message: 'Failed to mark invoice as paid',
    });
  }
});

/**
 * POST /api/admin/platform-fee-invoices/:invoiceId/waive
 * Waive invoice
 */
router.post('/:invoiceId/waive', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'reason_required',
        message: 'Waiver reason is required',
      });
    }

    await platformFeeInvoiceService.waiveInvoice(invoiceId, reason);

    const invoice = await prisma.platform_fee_invoices.findUnique({
      where: { id: invoiceId },
    });

    res.json({
      success: true,
      invoice,
    });
  } catch (error) {
    logger.error('[FeeInvoices] Error waiving invoice:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'waiver_failed',
      message: 'Failed to waive invoice',
    });
  }
});

/**
 * GET /api/admin/platform-fee-invoices/tenant/:tenantId
 * Get invoices for a specific tenant
 */
router.get('/tenant/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { limit = 12, offset = 0 } = req.query;

    const invoices = await prisma.platform_fee_invoices.findMany({
      where: { tenant_id: tenantId },
      orderBy: { period_start: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.platform_fee_invoices.count({
      where: { tenant_id: tenantId },
    });

    res.json({
      success: true,
      invoices,
      total,
    });
  } catch (error) {
    logger.error('[FeeInvoices] Error getting tenant invoices:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'fetch_failed',
      message: 'Failed to fetch tenant invoices',
    });
  }
});

export default router;
