/**
 * Admin Trial Management Routes
 * 
 * Handles trial management operations for platform administrators:
 * - Start trials for tenants
 * - Cancel trials
 * - Extend trials (if needed)
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { requireAuth, requirePlatformAdmin } from '../../middleware/auth';
import { getTrialManagementService } from '../../services/subscription/TrialManagementService';
import { getSubscriptionBillingService } from '../../services/subscription/SubscriptionBillingService';
import { audit } from '../../audit';

const router = Router();

// Apply authentication and admin requirements
router.use(requireAuth);
router.use(requirePlatformAdmin);

/**
 * POST /api/admin/trials/start
 * Start a trial for a tenant
 */
const startTrialSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  targetTier: z.enum(['google_only', 'starter', 'professional', 'chain_starter']),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.post('/start', async (req, res) => {
  try {
    const parsed = startTrialSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { tenantId, targetTier, reason } = parsed.data;

    // Get current tenant state
    const currentTenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
        metadata: true,
      },
    });

    if (!currentTenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
      });
    }

    // Check if tenant already has an active trial
    if (currentTenant.trial_ends_at && currentTenant.trial_ends_at > new Date()) {
      return res.status(400).json({
        success: false,
        error: 'trial_already_active',
        message: 'Tenant already has an active trial',
        trialEndsAt: currentTenant.trial_ends_at,
      });
    }

    // Check if tenant has a payment method (required for trial)
    const billingService = getSubscriptionBillingService();
    const paymentMethods = await billingService.getPaymentMethods(tenantId);
    
    if (!paymentMethods || paymentMethods.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'no_payment_method',
        message: 'Tenant must have a payment method to start a trial',
      });
    }

    // Use the first available payment method for trial
    const paymentMethodId = paymentMethods[0].id;

    // Start the trial using TrialManagementService
    const trialService = getTrialManagementService();
    const trialResult = await trialService.startTrial(tenantId, targetTier, paymentMethodId);

    if (!trialResult.success) {
      return res.status(400).json({
        success: false,
        error: 'trial_start_failed',
        message: trialResult.error,
      });
    }

    // Create audit log
    await audit({
      tenantId,
      actor: req.user?.userId || 'system',
      action: 'trial.start',
      payload: {
        reason,
        targetTier,
        trialTier: trialResult.trialTier,
        trialEndsAt: trialResult.trialEndsAt,
        graceEndsAt: trialResult.graceEndsAt,
        adminUserId: req.user?.userId,
        adminEmail: req.user?.email,
      },
    });

    console.log(`[Trial Management] Trial started for tenant ${tenantId} by ${req.user?.email}:`, {
      targetTier,
      trialTier: trialResult.trialTier,
      trialEndsAt: trialResult.trialEndsAt,
    });

    res.json({
      success: true,
      tenant: {
        id: currentTenant.id,
        subscription_tier: trialResult.trialTier,
        subscription_status: 'trial',
        trial_ends_at: trialResult.trialEndsAt,
        subscription_ends_at: null,
      },
      trial: {
        trialTier: trialResult.trialTier,
        trialEndsAt: trialResult.trialEndsAt,
        graceEndsAt: trialResult.graceEndsAt,
      },
    });

  } catch (error: any) {
    console.error('[POST /api/admin/trials/start] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to start trial',
    });
  }
});

/**
 * POST /api/admin/trials/cancel
 * Cancel an active trial for a tenant
 */
const cancelTrialSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.post('/cancel', async (req, res) => {
  try {
    const parsed = cancelTrialSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { tenantId, reason } = parsed.data;

    // Get current tenant state
    const currentTenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
        metadata: true,
      },
    });

    if (!currentTenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
      });
    }

    // Check if tenant has an active trial
    if (!currentTenant.trial_ends_at || currentTenant.trial_ends_at <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'no_active_trial',
        message: 'Tenant does not have an active trial',
      });
    }

    // Cancel the trial (downgrade to expired_trial)
    const billingService = getTrialManagementService();
    await billingService.downgradeToExpired(tenantId);

    // Create audit log
    await audit({
      tenantId,
      actor: req.user?.userId || 'system',
      action: 'trial.cancel',
      payload: {
        reason,
        previousTier: currentTenant.subscription_tier,
        newTier: 'expired_trial',
        adminUserId: req.user?.userId,
        adminEmail: req.user?.email,
      },
    });

    console.log(`[Trial Management] Trial canceled for tenant ${tenantId} by ${req.user?.email}`);

    res.json({
      success: true,
      tenant: {
        id: currentTenant.id,
        subscription_tier: 'expired_trial',
        subscription_status: 'canceled',
        trial_ends_at: null,
        subscription_ends_at: null,
      },
    });

  } catch (error: any) {
    console.error('[POST /api/admin/trials/cancel] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Failed to cancel trial',
    });
  }
});

export default router;
