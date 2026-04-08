/**
 * Tenant Trial Setup API
 * 
 * Handles trial activation for tenants during onboarding
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { TenantService } from '../../services/TenantService';
import { checkTierFeatureAccess, isValidTier } from '../../services/TierService';

// Schema for trial setup request
const trialSetupSchema = z.object({
  trialTier: z.enum(['trial_google_only', 'trial_starter', 'trial_professional', 'trial_chain_starter']),
  paymentMethodId: z.string().optional(), // For future payment integration
});

export async function POST(request: NextRequest) {
  try {
    // Extract tenant ID from URL
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const tenantId = pathSegments[3]; // Extract from /api/t/[tenantId]/trial-setup
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { trialTier } = trialSetupSchema.parse(body);

    // Validate tenant exists
    const tenantService = TenantService.getInstance();
    const tenant = await tenantService.getTenantProfile(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // TODO: Add proper authentication and RBAC check
    // For now, we'll assume the user has access if they can reach this endpoint

    // Validate trial tier exists
    const isValidTrialTier = await isValidTier(trialTier);
    if (!isValidTrialTier) {
      return NextResponse.json({ error: 'Invalid trial tier' }, { status: 400 });
    }

    // Check if tenant already has an active trial
    // We need to get the raw tenant data from database to check subscription tier
    const rawTenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        trial_ends_at: true,
      }
    });

    if (rawTenant?.subscription_tier?.startsWith('trial_') && rawTenant.trial_ends_at && rawTenant.trial_ends_at > new Date()) {
      return NextResponse.json({ 
        error: 'Active trial already exists',
        trialEndsAt: rawTenant.trial_ends_at
      }, { status: 409 });
    }

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Update tenant with trial tier
    const updatedTenant = await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_tier: trialTier,
        subscription_status: 'trial',
        trial_ends_at: trialEndsAt,
        updated_at: new Date(),
      },
    });

    // TODO: Send trial confirmation email
    // TODO: Schedule trial expiration reminder
    // TODO: Track trial activation analytics

    return NextResponse.json({
      success: true,
      tenant: {
        id: updatedTenant.id,
        subscriptionTier: updatedTenant.subscription_tier,
        subscriptionStatus: updatedTenant.subscription_status,
        trialEndsAt: updatedTenant.trial_ends_at,
      },
      message: 'Trial activated successfully'
    });

  } catch (error) {
    console.error('[Trial Setup] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data',
        details: error.issues
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Failed to activate trial',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Extract tenant ID from URL
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const tenantId = pathSegments[3]; // Extract from /api/t/[tenantId]/trial-setup
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Validate tenant exists
    const tenantService = TenantService.getInstance();
    const tenant = await tenantService.getTenantProfile(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Get raw tenant data for trial status
    const rawTenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
      }
    });

    // Return trial status
    return NextResponse.json({
      hasActiveTrial: rawTenant?.subscription_tier?.startsWith('trial_') && 
                     rawTenant.trial_ends_at && 
                     rawTenant.trial_ends_at > new Date(),
      trialTier: rawTenant?.subscription_tier,
      trialEndsAt: rawTenant?.trial_ends_at,
      subscriptionStatus: rawTenant?.subscription_status,
      canStartTrial: !rawTenant?.subscription_tier?.startsWith('trial_') || 
                     (rawTenant.trial_ends_at && rawTenant.trial_ends_at <= new Date())
    });

  } catch (error) {
    console.error('[Trial Setup] GET Error:', error);
    return NextResponse.json({ 
      error: 'Failed to get trial status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Default export for Express router
import { Router } from 'express';
const router = Router();

// POST /:tenantId/trial-setup - Activate trial
router.post('/:tenantId/trial-setup', async (req: any, res: any) => {
  try {
    const { trialTier } = req.body;
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    // Validate request body
    const trialSetupSchema = z.object({
      trialTier: z.enum(['trial_google_only', 'trial_starter', 'trial_professional', 'trial_chain_starter']),
      paymentMethodId: z.string().optional(),
    });

    const { trialTier: validatedTier } = trialSetupSchema.parse({ trialTier });

    // Validate tenant exists
    const tenantService = TenantService.getInstance();
    const tenant = await tenantService.getTenantProfile(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Validate trial tier exists
    const isValidTrialTier = await isValidTier(validatedTier);
    if (!isValidTrialTier) {
      return res.status(400).json({ error: 'Invalid trial tier' });
    }

    // Check if tenant already has an active trial
    const rawTenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        trial_ends_at: true,
      }
    });

    if (rawTenant?.subscription_tier?.startsWith('trial_') && rawTenant.trial_ends_at && rawTenant.trial_ends_at > new Date()) {
      return res.status(409).json({ 
        error: 'Active trial already exists',
        trialEndsAt: rawTenant.trial_ends_at
      });
    }

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Update tenant with trial tier
    const updatedTenant = await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_tier: validatedTier,
        subscription_status: 'trial',
        trial_ends_at: trialEndsAt,
        updated_at: new Date(),
      },
    });

    return res.json({
      success: true,
      tenant: {
        id: updatedTenant.id,
        subscriptionTier: updatedTenant.subscription_tier,
        subscriptionStatus: updatedTenant.subscription_status,
        trialEndsAt: updatedTenant.trial_ends_at,
      },
      message: 'Trial activated successfully'
    });

  } catch (error: any) {
    console.error('[Trial Setup] Error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: error.issues
      });
    }

    return res.status(500).json({ 
      error: 'Failed to activate trial',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /:tenantId/trial-setup - Get trial status
router.get('/:tenantId/trial-setup', async (req: any, res: any) => {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    // Validate tenant exists
    const tenantService = TenantService.getInstance();
    const tenant = await tenantService.getTenantProfile(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get raw tenant data for trial status
    const rawTenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
      }
    });

    // Return trial status
    return res.json({
      hasActiveTrial: rawTenant?.subscription_tier?.startsWith('trial_') && 
                     rawTenant.trial_ends_at && 
                     rawTenant.trial_ends_at > new Date(),
      trialTier: rawTenant?.subscription_tier,
      trialEndsAt: rawTenant?.trial_ends_at,
      subscriptionStatus: rawTenant?.subscription_status,
      canStartTrial: !rawTenant?.subscription_tier?.startsWith('trial_') || 
                     (rawTenant.trial_ends_at && rawTenant.trial_ends_at <= new Date())
    });

  } catch (error: any) {
    console.error('[Trial Setup] GET Error:', error);
    return res.status(500).json({ 
      error: 'Failed to get trial status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
