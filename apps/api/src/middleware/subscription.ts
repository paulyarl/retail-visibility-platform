import { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";

/**
 * Subscription status check middleware
 * Blocks access if tenant subscription is expired or canceled
 */
export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.query.tenantId as string;

    if (!tenantId) {
      return res.status(400).json({
        error: "tenant_required",
        message: "Tenant ID is required",
      });
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
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: "tenant_not_found",
        message: "Tenant not found",
      });
    }

    const now = new Date();

    // Check if subscription is canceled
    if (tenant.subscriptionStatus === "canceled") {
      return res.status(402).json({
        error: "subscription_canceled",
        message: "Your subscription has been canceled. Please contact support to reactivate.",
        tenant: {
          id: tenant.id,
          name: tenant.name,
          status: tenant.subscriptionStatus,
        },
      });
    }

    // Check if trial has expired
    if (
      tenant.subscriptionStatus === "trial" &&
      tenant.trialEndsAt &&
      tenant.trialEndsAt < now
    ) {
      return res.status(402).json({
        error: "trial_expired",
        message: "Your trial has expired. Please subscribe to continue using the platform.",
        tenant: {
          id: tenant.id,
          name: tenant.name,
          status: "trial_expired",
          trialEndsAt: tenant.trialEndsAt,
        },
      });
    }

    // Check if subscription has expired
    if (
      tenant.subscriptionStatus === "active" &&
      tenant.subscriptionEndsAt &&
      tenant.subscriptionEndsAt < now
    ) {
      return res.status(402).json({
        error: "subscription_expired",
        message: "Your subscription has expired. Please renew to continue.",
        tenant: {
          id: tenant.id,
          name: tenant.name,
          status: "expired",
          subscriptionEndsAt: tenant.subscriptionEndsAt,
        },
      });
    }

    // Check if payment is past due
    if (tenant.subscriptionStatus === "past_due") {
      return res.status(402).json({
        error: "payment_past_due",
        message: "Your payment is past due. Please update your payment method.",
        tenant: {
          id: tenant.id,
          name: tenant.name,
          status: tenant.subscriptionStatus,
        },
      });
    }

    // Subscription is valid, continue
    next();
  } catch (error) {
    console.error("[Subscription Check] Error:", error);
    return res.status(500).json({
      error: "subscription_check_failed",
      message: "Failed to verify subscription status",
    });
  }
}

/**
 * Check subscription limits based on tier
 */
export async function checkSubscriptionLimits(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.query.tenantId as string;

    if (!tenantId) {
      return next();
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscriptionTier: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    if (!tenant) {
      return next();
    }

    // Define limits per tier
    const limits: Record<string, { items: number }> = {
      trial: { items: 500 },
      starter: { items: 500 },
      professional: { items: 5000 },
      enterprise: { items: Infinity },
    };

    const tier = tenant.subscriptionTier || "trial";
    const limit = limits[tier] || limits.trial;

    // Check if creating new item would exceed limit
    if (req.method === "POST" && tenant._count.items >= limit.items) {
      return res.status(402).json({
        error: "item_limit_reached",
        message: `You've reached the ${tier} plan limit of ${limit.items} items. Please upgrade to add more.`,
        limit: limit.items,
        current: tenant._count.items,
        tier,
      });
    }

    next();
  } catch (error) {
    console.error("[Subscription Limits] Error:", error);
    next(); // Don't block on limit check errors
  }
}
