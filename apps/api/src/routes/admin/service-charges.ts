/**
 * Admin Service Charges Routes
 * 
 * Handles service charge operations for platform administrators:
 * - Service charge creation
 * - Service charge invoicing
 * - Service charge configurations
 * - Service charge statistics
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePlatformAdmin } from '../../middleware/auth';
import { getServiceChargeService } from '../../services/subscription/ServiceChargeService';
import { prisma } from '../../prisma';

const router = Router();

// Apply authentication and admin requirements to all routes
router.use(requireAuth);
router.use(requirePlatformAdmin);

/**
 * POST /api/admin/service-charges
 * Add a service charge to a tenant
 */
const addServiceChargeSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  organizationId: z.string().optional(),
  chargeType: z.enum(['setup_fee', 'service_fee', 'custom']),
  amountCents: z.number().min(1, 'Amount must be greater than 0'),
  description: z.string().min(1, 'Description is required'),
  applyToInvoice: z.boolean().default(false),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.post('/', async (req, res) => {
  try {
    const parsed = addServiceChargeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { tenantId, organizationId, chargeType, amountCents, description, applyToInvoice, reason } = parsed.data;

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

    // Add service charge
    const serviceChargeService = getServiceChargeService();
    const result = await serviceChargeService.addServiceCharge({
      tenantId,
      organizationId: organizationId || tenant.organization_id || undefined,
      chargeType,
      amountCents,
      description,
      applyToInvoice,
      createdBy: req.user?.userId || 'system',
      createdByEmail: req.user?.email,
      reason,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'service_charge_creation_failed',
        message: result.error,
      });
    }

    console.log(`[Admin Service Charges] Service charge added: ${result.serviceChargeId} for tenant ${tenantId} by ${req.user?.email}`);

    res.json({
      success: true,
      serviceChargeId: result.serviceChargeId,
      invoiceId: result.invoiceId,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        organizationId: tenant.organization_id,
      },
      serviceCharge: {
        id: result.serviceChargeId,
        chargeType,
        amountCents,
        description,
        invoiceId: result.invoiceId,
      },
    });

  } catch (error: any) {
    console.error('[POST /api/admin/service-charges] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to add service charge',
    });
  }
});

/**
 * POST /api/admin/service-charges/invoice
 * Create invoice for uninvoiced service charges
 */
const invoiceServiceChargesSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  serviceChargeIds: z.array(z.string().min(1)).min(1, 'At least one service charge ID is required'),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.post('/invoice', async (req, res) => {
  try {
    const parsed = invoiceServiceChargesSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { tenantId, serviceChargeIds, reason } = parsed.data;

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

    // Create invoice for service charges
    const serviceChargeService = getServiceChargeService();
    const result = await serviceChargeService.createInvoiceForServiceCharges(
      tenantId,
      serviceChargeIds,
      req.user?.userId || 'system',
      req.user?.email
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'invoice_creation_failed',
        message: result.error,
      });
    }

    console.log(`[Admin Service Charges] Invoice created for service charges: ${result.invoiceId} for tenant ${tenantId} by ${req.user?.email}`);

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
        serviceChargeIds,
      },
    });

  } catch (error: any) {
    console.error('[POST /api/admin/service-charges/invoice] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to create invoice for service charges',
    });
  }
});

/**
 * GET /api/admin/service-charges
 * Get all service charges (admin view)
 */
router.get('/', async (req, res) => {
  try {
    // Get all service charges for admin view
    const serviceChargeService = getServiceChargeService();
    const charges = await serviceChargeService.getAllServiceCharges();

    res.json({
      success: true,
      charges,
    });
  } catch (error: any) {
    console.error('[GET /api/admin/service-charges] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to get service charges',
    });
  }
});

/**
 * PUT /api/admin/service-charges/:chargeId
 * Update a service charge
 */
router.put('/:chargeId', async (req, res) => {
  try {
    const { chargeId } = req.params;
    const { chargeType, amountCents, description } = req.body;

    // Validate service charge exists
    const charge = await prisma.service_charges.findFirst({
      where: { 
        id: chargeId
      }
    });

    if (!charge) {
      return res.status(404).json({
        success: false,
        error: 'service_charge_not_found',
        message: 'Service charge not found'
      });
    }

    // Update the service charge
    const updatedCharge = await prisma.service_charges.update({
      where: { id: chargeId },
      data: {
        charge_type: chargeType,
        amount_cents: amountCents,
        description: description,
        updated_at: new Date()
      }
    });

    console.log(`[Admin Service Charges] Service charge updated: ${chargeId}`);

    res.json({
      success: true,
      serviceCharge: {
        id: updatedCharge.id,
        chargeType: updatedCharge.charge_type,
        amountCents: updatedCharge.amount_cents,
        description: updatedCharge.description,
        updatedAt: updatedCharge.updated_at
      }
    });

  } catch (error: any) {
    console.error('[PUT /api/admin/service-charges] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to update service charge',
    });
  }
});

/**
 * GET /api/admin/service-charges/configurations
 * Get service charge configurations
 * NOTE: Must be defined BEFORE /:tenantId to avoid being intercepted
 */
router.get('/configurations', async (req, res) => {
  try {
    // Get service charge configurations
    const serviceChargeService = getServiceChargeService();
    const configurations = await serviceChargeService.getServiceChargeConfigurations();

    res.json({
      success: true,
      configurations,
    });

  } catch (error: any) {
    console.error('[GET /api/admin/service-charges/configurations] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to get service charge configurations',
    });
  }
});

/**
 * GET /api/admin/service-charges/:tenantId
 * Get service charges for a tenant
 */
router.get('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { chargeType, includeUninvoiced, includeInvoiced } = req.query;

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

    // Get service charges
    const serviceChargeService = getServiceChargeService();
    const charges = await serviceChargeService.getServiceCharges(tenantId, {
      chargeType: chargeType as 'setup_fee' | 'service_fee' | 'custom' | undefined,
      includeUninvoiced: includeUninvoiced === 'true',
      includeInvoiced: includeInvoiced === 'true',
    });

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        organizationId: tenant.organization_id,
      },
      charges,
    });

  } catch (error: any) {
    console.error('[GET /api/admin/service-charges/:tenantId] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to get service charges',
    });
  }
});

/**
 * GET /api/admin/service-charges/:tenantId/stats
 * Get service charge statistics for a tenant
 */
router.get('/:tenantId/stats', async (req, res) => {
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

    // Get service charge statistics
    const serviceChargeService = getServiceChargeService();
    const stats = await serviceChargeService.getServiceChargeStats(tenantId);

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        organizationId: tenant.organization_id,
      },
      stats,
    });

  } catch (error: any) {
    console.error('[GET /api/admin/service-charges/:tenantId/stats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to get service charge statistics',
    });
  }
});

console.log('[SERVICE-CHARGES] Module loaded and router exported');
export default router;
