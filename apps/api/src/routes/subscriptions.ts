import { Router } from "express";
import { prisma } from "../prisma";
import { z } from "zod";
import { TRIAL_CONFIG } from "../config/tenant-limits";

const router = Router();

// Get tenant subscription status
router.get("/status", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;

    if (!tenantId) {
      return res.status(400).json({ error: "tenant_required" });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        stripeCustomerId: true,
        _count: {
          select: {
            inventoryItems: true,
            userTenants: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: "tenant_not_found" });
    }

    const now = new Date();

    // Calculate days remaining (trial or subscription)
    let daysRemaining = null;
    
    if (tenant.subscriptionStatus === "trial" && tenant.trialEndsAt) {
      daysRemaining = Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    } else if (tenant.subscriptionEndsAt) {
      daysRemaining = Math.ceil((tenant.subscriptionEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Get tier limits
    const limits: Record<string, { _count: number; user_tenants: number }> = {
      starter: { _count: 500, user_tenants: 3 },
      pro: { _count: 5000, user_tenants: 10 },
      enterprise: { _count: Infinity, user_tenants: Infinity },
    };

    const tier = tenant.subscriptionTier || "starter";
    const tierLimits = limits[tier] || limits.starter;

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
      subscription: {
        status: tenant.subscriptionStatus,
        tier: tenant.subscriptionTier,
        trialEndsAt: tenant.trialEndsAt,
        subscriptionEndsAt: tenant.subscriptionEndsAt,
        daysRemaining,
        hasStripeAccount: !!tenant.stripeCustomerId,
      },
      usage: {
        _count: {
          current: tenant._count.inventoryItems,
          limit: tierLimits._count,
          percentage: tierLimits._count === Infinity ? 0 : Math.round((tenant._count.inventoryItems / tierLimits._count) * 100),
        },
        user_tenants: {
          current: tenant._count.userTenants,
          limit: tierLimits.user_tenants,
          percentage: tierLimits.user_tenants === Infinity ? 0 : Math.round((tenant._count.userTenants / tierLimits.user_tenants) * 100),
        },
      },
    });
  } catch (error) {
    console.error("[GET /subscriptions/status] Error:", error);
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

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
      },
    });

    res.json({
      message: "Subscription updated successfully",
      tenant,
    });
  } catch (error) {
    console.error("[PATCH /subscriptions/update] Error:", error);
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
