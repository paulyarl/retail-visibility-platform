import { Router } from "express";
import { prisma } from "../prisma";
import { z } from "zod";
import { TRIAL_CONFIG } from "../config/tenant-limits";
import { logger } from '../logger';

const router = Router();

// Get tenant subscription status
router.get("/status", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;

    if (!tenantId) {
      return res.status(400).json({ error: "tenant_required" });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscription_status: true,
        subscription_tier: true,
        trial_ends_at: true,
        subscription_ends_at: true,
        manual_subscription_control: true,
        manual_subscription_expires_at: true,
        manual_subscription_reason: true,
        stripe_customer_id: true,
        _count: {
          select: {
            inventory_items: true,
            user_tenants: true,
          },
        },
      },
    });

    if (!tenant) {
      
        console.log(`${req.method} ${req.path} - route: getSubscriptionStatus`);
      return res.status(404).json({ error: "tenant_not_found" });
    }

    const now = new Date();

    // Calculate effective expiration with manual priority
    const effectiveExpiration = tenant.manual_subscription_control 
      ? {
          expiresAt: tenant.manual_subscription_expires_at,
          type: 'manual' as const,
          source: 'manual_override' as const
        }
      : tenant.subscription_status === 'trial' && tenant.trial_ends_at
        ? {
            expiresAt: tenant.trial_ends_at,
            type: 'trial' as const,
            source: 'automatic_trial' as const
          }
        : tenant.subscription_ends_at
          ? {
              expiresAt: tenant.subscription_ends_at,
              type: 'subscription' as const,
              source: 'automatic_subscription' as const
            }
          : null;

    // Calculate days remaining using effective expiration
    let daysRemaining = null;
    
    if (effectiveExpiration?.expiresAt) {
      daysRemaining = Math.ceil((effectiveExpiration.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Get tier limits
    const limits: Record<string, { _count: number; user_tenants: number }> = {
      starter: { _count: 500, user_tenants: 3 },
      pro: { _count: 5000, user_tenants: 10 },
      enterprise: { _count: Infinity, user_tenants: Infinity },
    };

    const tier = tenant.subscription_tier || "starter";
    const tierLimits = limits[tier] || limits.starter;

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
      subscription: {
        status: tenant.subscription_status,
        tier: tenant.subscription_tier,
        trialEndsAt: tenant.trial_ends_at,
        subscriptionEndsAt: tenant.subscription_ends_at,
        daysRemaining,
        hasStripeAccount: !!tenant.stripe_customer_id,
        // Manual subscription control fields
        manualSubscriptionControl: tenant.manual_subscription_control,
        manualSubscriptionExpiresAt: tenant.manual_subscription_expires_at,
        manualSubscriptionReason: tenant.manual_subscription_reason,
        // Effective expiration fields
        effectiveExpiresAt: effectiveExpiration?.expiresAt,
        effectiveExpiresType: effectiveExpiration?.type,
        effectiveExpiresSource: effectiveExpiration?.source
      },
      usage: {
        _count: {
          current: tenant._count.inventory_items,
          limit: tierLimits._count,
          percentage: tierLimits._count === Infinity ? 0 : Math.round((tenant._count.inventory_items / tierLimits._count) * 100),
        },
        user_tenants: {
          current: tenant._count.user_tenants,
          limit: tierLimits.user_tenants,
          percentage: tierLimits.user_tenants === Infinity ? 0 : Math.round((tenant._count.user_tenants / tierLimits.user_tenants) * 100),
        },
      },
    });
  } catch (error) {
    logger.error("[GET /subscriptions/status] Error:", undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_status" });
  }
});

// Update subscription status (admin only)
const updateSchema = z.object({
  tenantId: z.string(),
  subscriptionStatus: z.enum(["trial", "active", "past_due", "canceled"]).optional(),
  subscriptionTier: z.enum(["starter", "pro", "enterprise"]).optional(),
  trialEndsAt: z.string().datetime().optional(),
  subscriptionEndsAt: z.string().datetime().optional(),
  stripe_customer_id: z.string().optional(),
  stripe_subscription_id: z.string().optional(),
});

router.patch("/update", async (req, res) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "invalid_input",
        details: parsed.error.flatten(),
      });
    }

    const { tenantId, ...updates } = parsed.data;

    // Convert date strings to Date objects
    const data: any = { ...updates };
    if (updates.trialEndsAt) {
      data.trialEndsAt = new Date(updates.trialEndsAt);
    }
    if (updates.subscriptionEndsAt) { 
      data.subscriptionEndsAt = new Date(updates.subscriptionEndsAt);
    }

    const tenant = await prisma.tenants.update({
      where: { id: tenantId },
      data,
      select: {
        id: true,
        name: true,
        subscription_status: true,
        subscription_tier: true,
        trial_ends_at: true,
        subscription_ends_at: true,
      },
    });

    res.json({
      message: "Subscription updated successfully",
      tenant,
    });
  } catch (error) {
    logger.error("[PATCH /subscriptions/update] Error:", undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_update_subscription" });
  }
});

// Get pricing tiers
router.get("/pricing", async (req, res) => {
  res.json({
    tiers: [
      {
        id: "starter",
        name: "Starter",
        price: 49,
        currency: "USD",
        interval: "month",
        features: [
          "1 location",
          "500 items",
          "Basic sync",
          "Email support",
          `${TRIAL_CONFIG.durationDays}-day trial`,
        ],
        limits: {
          _count: 500,
          user_tenants: 3,
          locations: 1,
        },
      },
      {
        id: "pro",
        name: "Professional",
        price: 149,
        currency: "USD",
        interval: "month",
        features: [
          "5 locations",
          "5,000 items",
          "Advanced sync",
          "Priority support",
          "Custom reports",
        ],
        limits: {
          _count: 5000,
          user_tenants: 10,
          locations: 5,
        },
        popular: true,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: 499,
        currency: "USD",
        interval: "month",
        features: [
          "Unlimited locations",
          "Unlimited items",
          "Custom integrations",
          "Dedicated support",
          "SLA guarantee",
        ],
        limits: {
          _count: Infinity,
          user_tenants: Infinity,
          locations: Infinity,
        },
      },
    ],
  });
});

export default router;
