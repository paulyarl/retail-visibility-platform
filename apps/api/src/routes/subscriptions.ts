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
            items: true,
            users: true,
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
    const limits: Record<string, { items: number; users: number }> = {
      starter: { items: 500, users: 3 },
      pro: { items: 5000, users: 10 },
      enterprise: { items: Infinity, users: Infinity },
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
        items: {
          current: tenant._count.items,
          limit: tierLimits.items,
          percentage: tierLimits.items === Infinity ? 0 : Math.round((tenant._count.items / tierLimits.items) * 100),
        },
        users: {
          current: tenant._count.users,
          limit: tierLimits.users,
          percentage: tierLimits.users === Infinity ? 0 : Math.round((tenant._count.users / tierLimits.users) * 100),
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
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
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
          items: 500,
          users: 3,
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
          items: 5000,
          users: 10,
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
          items: Infinity,
          users: Infinity,
          locations: Infinity,
        },
      },
    ],
  });
});

export default router;
