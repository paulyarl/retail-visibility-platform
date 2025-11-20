import { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { getMaintenanceState, deriveInternalStatus } from "../utils/subscription-status";

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
    const tenantId = req.query.tenant_id as string || req.body?.tenant_id;

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
        subscription_status: true,
        subscription_tier: true,
        trial_ends_at: true,
        subscription_ends_at: true,
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
    if (tenant.subscription_status === "canceled") {
      return res.status(402).json({
        error: "subscription_canceled",
        message: "Your subscription has been canceled. Please contact support to reactivate.",
        tenant: {
          id: tenant.id,
          name: tenant.name,
          status: tenant.subscription_status,
        },
      });
    }

    // Check if trial has expired - convert to active status (keep same tier)
    if (
      tenant.subscription_status === "trial" &&
      tenant.trialEndsAt &&
      tenant.trialEndsAt < now
    ) {
      // Trial expired - require payment to continue
      console.log(`[Subscription Check] Trial expired for tenant ${tenant.id} (${tenant.subscriptionTier} tier).`);
      
      return res.status(402).json({
        error: "trial_expired",
        message: `Your 14-day trial of the ${tenant.subscriptionTier} plan has expired. Please add payment to continue.`,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          tier: tenant.subscriptionTier,
          trial_ends_at: tenant.trialEndsAt,
        },
      });
    }

    // Check if subscription has expired
    if (
      tenant.subscription_status === "active" &&
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
          subscription_ends_at: tenant.subscriptionEndsAt,
        },
      });
    }

    // Check if payment is past due
    if (tenant.subscription_status === "past_due") {
      return res.status(402).json({
        error: "payment_past_due",
        message: "Your payment is past due. Please update your payment method.",
        tenant: {
          id: tenant.id,
          name: tenant.name,
          status: tenant.subscription_status,
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
 * Supports both individual tenants and chain organizations
 */
export async function checkSubscriptionLimits(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.query.tenant_id as string || req.body?.tenant_id;

    if (!tenantId) {
      return next();
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            maxTotalSKUs: true,
            subscription_tier: true,
            tenant: {
              select: {
                _count: {
                  select: {
                    _count: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            _count: true,
          },
        },
      },
    });

    if (!tenant) {
      return next();
    }

    // Check if tenant is part of a chain organization
    if (tenant.organizationId && tenant.organization) {
      // CHAIN-LEVEL LIMIT ENFORCEMENT
      const org = tenant.organization;
      
      // Calculate total SKUs across all locations in the chain
      const totalChainSKUs = org.tenants.reduce(
        (sum, t) => sum + t._count.inventory_item,
        0
      );

      // Check if adding new item would exceed chain limit
      if (req.method === "POST" && totalChainSKUs >= org.maxTotalSKUs) {
        return res.status(402).json({
          error: "chain_limit_reached",
          message: `Your organization "${org.name}" has reached the chain limit of ${org.maxTotalSKUs} total SKUs across all locations. Please upgrade or contact support.`,
          limit: org.maxTotalSKUs,
          current: totalChainSKUs,
          organizationId: org.id,
          organizationName: org.name,
          tier: org.subscriptionTier,
        });
      }

      // Chain limit OK, continue
      next();
      return;
    }

    // INDIVIDUAL TENANT LIMIT ENFORCEMENT
    // Define limits per tier for standalone tenants
    const limits: Record<string, { _count: number }> = {
      google_only: { _count: 500 },
      starter: { _count: 500 },
      professional: { _count: 5000 },
      enterprise: { _count: Infinity },
    };

    const tier = tenant.subscriptionTier || "starter";
    const limit = limits[tier] || limits.starter;
    const status = tenant.subscription_status || "active";
    const maintenanceState = getMaintenanceState({
      tier,
      status,
      trial_ends_at: tenant.trialEndsAt ?? undefined,
    });

    // In maintenance mode, block growth (new items) even if numeric limits not reached
    if (req.method === "POST" && maintenanceState === "maintenance") {
      return res.status(403).json({
        error: "maintenance_no_growth",
        message:
          "Your account is in maintenance mode. You can update existing products, but cannot add new products until you upgrade.",
        subscription_tier: tier,
        subscription_status: status,
        maintenanceState,
        limit: limit.items,
        current: tenant._count.inventory_item,
        upgradeUrl: "/settings/subscription",
      });
    }

    // Check if creating new item would exceed numeric tier limit
    if (req.method === "POST" && tenant._count.inventory_item >= limit.items) {
      return res.status(402).json({
        error: "item_limit_reached",
        message: `You've reached the ${tier} plan limit of ${limit.items} items. Please upgrade to add more.`,
        limit: limit.items,
        current: tenant._count.inventory_item,
        tier,
      });
    }

    next();
  } catch (error) {
    console.error("[Subscription Limits] Error:", error);
    next(); // Don't block on limit check errors
  }
}

/**
 * Require writable subscription middleware
 * Blocks write operations for frozen accounts (read-only visibility mode)
 * Allows maintenance mode (google_only) to update existing data but not grow
 * 
 * Use this on endpoints that modify data (items, profile, sync triggers, etc.)
 */
export async function requireWritableSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.query.tenant_id as string || req.body?.tenant_id;

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
        subscription_status: true,
        subscription_tier: true,
        trial_ends_at: true,
        subscription_ends_at: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: "tenant_not_found",
        message: "Tenant not found",
      });
    }

    // Derive internal status to determine write permissions
    const internalStatus = deriveInternalStatus(tenant);

    // Frozen accounts are read-only (visibility only)
    if (internalStatus === 'frozen') {
      return res.status(403).json({
        error: "account_frozen",
        message: "Your account is in read-only mode. Your storefront and directory listing remain visible, but you cannot make changes. Please upgrade to regain full access.",
        subscription_status: tenant.subscription_status,
        subscription_tier: tenant.subscriptionTier,
        internalStatus,
        upgradeUrl: "/settings/subscription",
      });
    }

    // Canceled accounts cannot make changes
    if (internalStatus === 'canceled') {
      return res.status(403).json({
        error: "subscription_canceled",
        message: "Your subscription has been canceled. Please contact support to reactivate or upgrade to a new plan.",
        subscription_status: tenant.subscription_status,
        internalStatus,
      });
    }

    // Expired accounts need to upgrade
    if (internalStatus === 'expired') {
      return res.status(402).json({
        error: "subscription_expired",
        message: "Your subscription has expired. Please upgrade to continue making changes.",
        subscription_status: tenant.subscription_status,
        subscription_tier: tenant.subscriptionTier,
        internalStatus,
        upgradeUrl: "/settings/subscription",
      });
    }

    // Maintenance mode is allowed (handled by checkSubscriptionLimits for growth restrictions)
    // Active, trialing, and past_due are allowed
    next();
  } catch (error) {
    console.error("[Writable Subscription Check] Error:", error);
    return res.status(500).json({
      error: "subscription_check_failed",
      message: "Failed to verify subscription write permissions",
    });
  }
}
