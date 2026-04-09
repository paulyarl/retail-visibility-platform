/**
 * Admin Manual Billing Routes
 * 
 * Handles manual billing operations for platform administrators:
 * - Manual invoice creation
 * - Manual payment method management
 * - Service charge management
 * - Payment status overrides
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePlatformAdmin } from '../../middleware/auth';
import { getManualBillingService } from '../../services/subscription/ManualBillingService';
import { getServiceChargeService } from '../../services/subscription/ServiceChargeService';
import { audit } from '../../audit';
import { prisma } from '../../prisma';

const router = Router();

// Apply authentication and admin requirements
router.use(requireAuth);
router.use(requirePlatformAdmin);

/**
 * POST /api/admin/manual-billing/invoices
 * Create a manual invoice for a tenant
 */
const createManualInvoiceSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  organizationId: z.string().optional(),
  amountCents: z.number().min(1, 'Amount must be greater than 0'),
  description: z.string().min(1, 'Description is required'),
  paymentInstructions: z.string().optional(),
  dueDateOverride: z.string().datetime().optional(),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.post('/invoices', async (req, res) => {
  try {
    const parsed = createManualInvoiceSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { tenantId, organizationId, amountCents, description, paymentInstructions, dueDateOverride, reason } = parsed.data;

    // Validate tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, organization_id: true }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
      });
    }

    // Create manual invoice
    const manualBillingService = getManualBillingService();
    const result = await manualBillingService.createManualInvoice({
      tenantId,
      organizationId: organizationId || tenant.organization_id || undefined,
      amountCents,
      description,
      paymentInstructions,
      dueDateOverride: dueDateOverride ? new Date(dueDateOverride) : undefined,
      adminCreatedBy: req.user?.userId || 'system',
      adminEmail: req.user?.email,
      reason,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'invoice_creation_failed',
        message: result.error,
      });
    }

    console.log(`[Admin Manual Billing] Manual invoice created: ${result.invoiceId} for tenant ${tenantId} by ${req.user?.email}`);

    res.json({
      success: true,
      invoiceId: result.invoiceId,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        organizationId: tenant.organization_id,
      },
      invoice: {
        id: result.invoiceId,
        amountCents,
        description,
        status: 'pending',
      },
    });

  } catch (error: any) {
    console.error('[POST /api/admin/manual-billing/invoices] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to create manual invoice',
    });
  }
});

/**
 * POST /api/admin/manual-billing/payment-methods
 * Add a manual payment method for a tenant
 */
const addPaymentMethodSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  organizationId: z.string().optional(),
  gatewayType: z.enum(['manual', 'bank', 'cash', 'other']).default('manual'),
  paymentReference: z.string().optional(),
  adminNotes: z.string().optional(),
  isDefault: z.boolean().default(false),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.post('/payment-methods', async (req, res) => {
  try {
    const parsed = addPaymentMethodSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { tenantId, organizationId, gatewayType, paymentReference = '', adminNotes, isDefault, reason } = parsed.data;

    // Validate tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, organization_id: true }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
      });
    }

    // Add manual payment method
    const manualBillingService = getManualBillingService();
    const result = await manualBillingService.addManualPaymentMethod({
      tenantId,
      organizationId: organizationId || tenant.organization_id || undefined,
      gatewayType: 'manual',
      paymentReference,
      adminNotes,
      isDefault,
      reason,
      createdBy: req.user?.userId || 'system',
      createdByEmail: req.user?.email,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'payment_method_creation_failed',
        message: result.error,
      });
    }

    console.log(`[Admin Manual Billing] Manual payment method added: ${result.paymentMethodId} for tenant ${tenantId} by ${req.user?.email}`);

    res.json({
      success: true,
      paymentMethodId: result.paymentMethodId,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        organizationId: tenant.organization_id,
      },
      paymentMethod: {
        id: result.paymentMethodId,
        gatewayType: 'manual',
        paymentReference,
        isDefault,
      },
    });

  } catch (error: any) {
    console.error('[POST /api/admin/manual-billing/payment-methods] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to add manual payment method',
    });
  }
});

/**
 * POST /api/admin/manual-billing/mark-paid
 * Mark an invoice as paid manually
 */
const markPaidSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  paymentReference: z.string().optional(),
  amountCents: z.number().optional(),
  paymentDate: z.string().datetime(),
  notes: z.string().optional(),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.post('/mark-paid', async (req, res) => {
  try {
    const parsed = markPaidSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { invoiceId, paymentReference, amountCents, paymentDate, notes, reason } = parsed.data;

    // Validate invoice exists
    const invoice = await prisma.subscription_invoices.findUnique({
      where: { id: invoiceId },
      include: {
        tenants: {
          select: { id: true, name: true, organization_id: true }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'invoice_not_found',
      });
    }

    // Mark invoice as paid
    const manualBillingService = getManualBillingService();
    const result = await manualBillingService.markInvoiceAsPaid({
      invoiceId,
      paymentReference,
      amountCents,
      paymentDate: new Date(paymentDate),
      notes,
      verifiedBy: req.user?.userId || 'system',
      verifiedByEmail: req.user?.email,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'payment_marking_failed',
        message: result.error,
      });
    }

    console.log(`[Admin Manual Billing] Invoice marked as paid: ${invoiceId} by ${req.user?.email}`);

    res.json({
      success: true,
      invoice: {
        id: invoiceId,
        status: 'paid',
        amountCents: amountCents || invoice.amount_cents,
        paymentDate: new Date(paymentDate),
      },
      tenant: {
        id: invoice.tenants.id,
        name: invoice.tenants.name,
      },
    });

  } catch (error: any) {
    console.error('[POST /api/admin/manual-billing/mark-paid] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to mark invoice as paid',
    });
  }
});

/**
 * GET /api/admin/manual-billing/invoices
 * Get all manual invoices (admin view)
 */
router.get('/invoices', async (req, res) => {
  try {
    // Get all manual invoices for admin view
    const manualBillingService = getManualBillingService();
    const invoices = await manualBillingService.getAllManualInvoices();

    res.json({
      success: true,
      invoices,
    });
  } catch (error: any) {
    console.error('[GET /api/admin/manual-billing/invoices] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to get manual invoices',
    });
  }
});

/**
 * GET /api/admin/manual-billing/all-invoices
 * Get all invoices (manual and automated)
 */
router.get('/all-invoices', async (req, res) => {
  try {
    // Get all invoices including automated ones
    const invoices = await prisma.subscription_invoices.findMany({
      orderBy: { created_at: 'desc' }
    });

    // Get tenant IDs and fetch tenant names
    const tenantIds = [...new Set(invoices.map(inv => inv.tenant_id))];
    const tenants = await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true }
    });

    const tenantMap = new Map(tenants.map(t => [t.id, t.name]));

    // Get payment details for each invoice
    const invoiceIds = invoices.map(inv => inv.id);
    const payments = await prisma.subscription_payments.findMany({
      where: { invoice_id: { in: invoiceIds } },
      select: {
        id: true,
        invoice_id: true,
        gateway_type: true,
        transaction_id: true,
        amount_cents: true,
        status: true,
        created_at: true
      }
    });

    // Group payments by invoice
    const paymentsByInvoice = new Map<string, any[]>();
    payments.forEach((payment: any) => {
      if (!paymentsByInvoice.has(payment.invoice_id)) {
        paymentsByInvoice.set(payment.invoice_id, []);
      }
      paymentsByInvoice.get(payment.invoice_id)!.push(payment);
    });

    // Transform the data to match the expected format
    const transformedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      tenantId: invoice.tenant_id,
      tenantName: tenantMap.get(invoice.tenant_id) || 'Unknown Tenant',
      tier: invoice.tier,
      billingPeriodStart: invoice.billing_period_start,
      billingPeriodEnd: invoice.billing_period_end,
      amountCents: invoice.amount_cents,
      status: invoice.status || 'draft',
      dueDate: invoice.due_date,
      paidAt: invoice.paid_at,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at,
      isManual: invoice.manual_payment || false,
      paymentInstructions: invoice.payment_instructions,
      payments: (paymentsByInvoice.get(invoice.id) || []).map(payment => ({
        id: payment.id,
        gatewayType: payment.gateway_type || 'manual',
        transactionId: payment.transaction_id || '',
        amountCents: payment.amount_cents,
        status: payment.status || 'pending',
        createdAt: payment.created_at || new Date()
      }))
    }));

    res.json({
      success: true,
      invoices: transformedInvoices,
    });
  } catch (error: any) {
    console.error('[GET /api/admin/manual-billing/all-invoices] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to get all invoices',
    });
  }
});


/**
 * PUT /api/admin/manual-billing/subscription-control/:tenantId
 * Toggle manual subscription control for a tenant
 */
router.put('/subscription-control/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { enabled, expiresAt, reason } = req.body;

    // Validate tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found'
      });
    }

    // Update tenant subscription control
    const updatedTenant = await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        ...(enabled && { manual_subscription_control: enabled }),
        manual_subscription_expires_at: expiresAt ? new Date(expiresAt) : null,
        ...(reason && { manual_subscription_reason: reason }),
        updated_at: new Date()
      }
    } as any);

    console.log(`[ManualBilling] Subscription control updated for tenant ${tenantId}: enabled=${enabled}`);

    res.json({
      success: true,
      tenant: {
        id: updatedTenant.id,
        name: updatedTenant.name,
        manualSubscriptionControl: (updatedTenant as any).manual_subscription_control,
        manualSubscriptionExpiresAt: (updatedTenant as any).manual_subscription_expires_at,
        manualSubscriptionReason: (updatedTenant as any).manual_subscription_reason,
        subscriptionStatus: updatedTenant.subscription_status,
        subscriptionTier: updatedTenant.subscription_tier,
        subscriptionEndsAt: updatedTenant.subscription_ends_at
      }
    });
  } catch (error: any) {
    console.error('[PUT /api/admin/manual-billing/subscription-control] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to update subscription control'
    });
  }
});

/**
 * PUT /api/admin/manual-billing/invoices/:invoiceId
 * Update a manual invoice
 */
router.put('/invoices/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { amountCents, description, paymentInstructions } = req.body;

    // Validate invoice exists and is pending
    const invoice = await prisma.subscription_invoices.findFirst({
      where: { 
        id: invoiceId,
        manual_payment: true,
        status: 'pending'
      }
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'invoice_not_found',
        message: 'Pending manual invoice not found'
      });
    }

    // Update the invoice
    const updatedInvoice = await prisma.subscription_invoices.update({
      where: { id: invoiceId },
      data: {
        amount_cents: amountCents,
        payment_instructions: paymentInstructions,
        updated_at: new Date()
      }
    });

    console.log(`[Admin Manual Billing] Invoice updated: ${invoiceId}`);

    res.json({
      success: true,
      invoice: {
        id: updatedInvoice.id,
        amountCents: updatedInvoice.amount_cents,
        description: updatedInvoice.payment_instructions,
        status: updatedInvoice.status || 'pending',
        createdAt: updatedInvoice.created_at,
        updatedAt: updatedInvoice.updated_at
      }
    });

  } catch (error: any) {
    console.error('[PUT /api/admin/manual-billing/invoices] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to update invoice',
    });
  }
});

/**
 * DELETE /api/admin/manual-billing/invoices/:invoiceId
 * Cancel/delete a manual invoice
 */
router.delete('/invoices/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;

    // Validate invoice exists and is pending
    const invoice = await prisma.subscription_invoices.findFirst({
      where: { 
        id: invoiceId,
        manual_payment: true,
        status: 'pending'
      }
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'invoice_not_found',
        message: 'Pending manual invoice not found'
      });
    }

    // Cancel the invoice by updating status
    const cancelledInvoice = await prisma.subscription_invoices.update({
      where: { id: invoiceId },
      data: {
        status: 'cancelled',
        updated_at: new Date()
      }
    });

    console.log(`[Admin Manual Billing] Invoice cancelled: ${invoiceId}`);

    res.json({
      success: true,
      invoice: {
        id: cancelledInvoice.id,
        status: cancelledInvoice.status
      }
    });

  } catch (error: any) {
    console.error('[DELETE /api/admin/manual-billing/invoices] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to cancel invoice',
    });
  }
});

/**
 * GET /api/admin/manual-billing/invoices/:tenantId
 * Get manual invoices for a tenant
 */
router.get('/invoices/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, organization_id: true }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
      });
    }

    // Get manual invoices
    const manualBillingService = getManualBillingService();
    const invoices = await manualBillingService.getManualInvoices(tenantId);

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        organizationId: tenant.organization_id,
      },
      invoices,
    });

  } catch (error: any) {
    console.error('[GET /api/admin/manual-billing/invoices/:tenantId] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to get manual invoices',
    });
  }
});

/**
 * GET /api/admin/manual-billing/payment-methods
 * Get all manual payment methods (admin view)
 */
router.get('/payment-methods', async (req, res) => {
  try {
    // Get all manual payment methods for admin view
    const manualBillingService = getManualBillingService();
    const paymentMethods = await manualBillingService.getAllManualPaymentMethods();

    res.json({
      success: true,
      paymentMethods,
    });
  } catch (error: any) {
    console.error('[GET /api/admin/manual-billing/payment-methods] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to get manual payment methods',
    });
  }
});

/**
 * PUT /api/admin/manual-billing/payment-methods/:paymentMethodId
 * Update a manual payment method
 */
router.put('/payment-methods/:paymentMethodId', async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const { gatewayType, paymentReference, adminNotes, isDefault } = req.body;

    // Validate payment method exists
    const paymentMethod = await prisma.merchant_billing_gateways.findFirst({
      where: { 
        id: paymentMethodId
      }
    });

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        error: 'payment_method_not_found',
        message: 'Payment method not found'
      });
    }

    // If setting as default, unset other defaults for this tenant
    if (isDefault && !paymentMethod.is_default) {
      await prisma.merchant_billing_gateways.updateMany({
        where: { 
          tenant_id: paymentMethod.tenant_id,
          is_default: true 
        },
        data: { is_default: false }
      });
    }

    // Update the payment method
    const updatedPaymentMethod = await prisma.merchant_billing_gateways.update({
      where: { id: paymentMethodId },
      data: {
        gateway_type: gatewayType,
        manual_reference: paymentReference,
        admin_notes: adminNotes,
        is_default: isDefault,
        updated_at: new Date()
      }
    });

    console.log(`[Admin Manual Billing] Payment method updated: ${paymentMethodId}`);

    res.json({
      success: true,
      paymentMethod: {
        id: updatedPaymentMethod.id,
        gatewayType: updatedPaymentMethod.gateway_type,
        paymentReference: updatedPaymentMethod.manual_reference,
        adminNotes: updatedPaymentMethod.admin_notes,
        isDefault: updatedPaymentMethod.is_default,
        updatedAt: updatedPaymentMethod.updated_at
      }
    });

  } catch (error: any) {
    console.error('[PUT /api/admin/manual-billing/payment-methods] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to update payment method',
    });
  }
});

/**
 * DELETE /api/admin/manual-billing/payment-methods/:paymentMethodId
 * Delete a manual payment method
 */
router.delete('/payment-methods/:paymentMethodId', async (req, res) => {
  try {
    const { paymentMethodId } = req.params;

    // Validate payment method exists
    const paymentMethod = await prisma.merchant_billing_gateways.findFirst({
      where: { 
        id: paymentMethodId
      }
    });

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        error: 'payment_method_not_found',
        message: 'Payment method not found'
      });
    }

    // Delete the payment method
    await prisma.merchant_billing_gateways.delete({
      where: { id: paymentMethodId }
    });

    console.log(`[Admin Manual Billing] Payment method deleted: ${paymentMethodId}`);

    res.json({
      success: true,
      paymentMethod: {
        id: paymentMethodId
      }
    });

  } catch (error: any) {
    console.error('[DELETE /api/admin/manual-billing/payment-methods] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to delete payment method',
    });
  }
});

/**
 * GET /api/admin/manual-billing/payment-methods/:tenantId
 * Get manual payment methods for a tenant
 */
router.get('/payment-methods/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, organization_id: true }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
      });
    }

    // Get manual payment methods
    const manualBillingService = getManualBillingService();
    const paymentMethods = await manualBillingService.getManualPaymentMethods(tenantId);

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        organizationId: tenant.organization_id,
      },
      paymentMethods,
    });

  } catch (error: any) {
    console.error('[GET /api/admin/manual-billing/payment-methods/:tenantId] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to get manual payment methods',
    });
  }
});

export default router;
