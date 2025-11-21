import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import TierService from '../services/TierService';
import { getMaintenanceState } from '../utils/subscription-status';

/**
 * Tier-Based Feature Access Control
 * 
 * This middleware enforces feature access based on subscription tiers.
 * Now uses database-driven tier system via TierService.
 * 
 * CRITICAL: This protects revenue by ensuring customers must upgrade
 * to access premium features like Quick Start, Scanning, and GBP Integration.
 * 
 * MIGRATION NOTE: This middleware now uses TierService for database-driven tiers.
 * Hardcoded TIER_FEATURES below are kept for backward compatibility and fallback.
 */

// LEGACY: Define features available at each tier (cumulative)
// NOTE: These are now loaded from database via TierService, but kept as fallback
// NOTE: 'trial' is not a tier - it's a time-limited status that can apply to any tier
export const TIER_FEATURES = {
  google_only: [
    'google_shopping',
    'google_merchant_center',
    'basic_product_pages',
    'qr_codes_512',
    'performance_analytics',
  ],
  starter: [
    'storefront',
    'product_search',
    'mobile_responsive',
    'enhanced_seo',
    'basic_categories',
  ],
  professional: [
    // ⚠️ CRITICAL REVENUE-PROTECTING FEATURES
    'quick_start_wizard',       // Saves 400+ hours, worth $10K+
    'barcode_scan',          // Worth $375/mo in labor
    'gbp_integration',           // Worth $200-300/mo
    'custom_branding',
    'business_logo',
    'qr_codes_1024',
    'image_gallery_5',
    'interactive_maps',
    'privacy_mode',
    'custom_marketing_copy',
    'priority_support',
  ],
  enterprise: [
    'unlimited_skus',
    'white_label',
    'custom_domain',
    'qr_codes_2048',
    'image_gallery_10',
    'api_access',
    'advanced_analytics',
    'dedicated_account_manager',
    'sla_guarantee',
    'custom_integrations',
  ],
  organization: [
    // Organization-specific features (franchise model)
    'propagation_products',
    'propagation_categories',
    'propagation_gbp_sync',
    'propagation_hours',
    'propagation_profile',
    'propagation_flags',
    'propagation_roles',
    'propagation_brand',
    'organization_dashboard',
    'hero_location',
    'strategic_testing',
    'unlimited_locations',
    'shared_sku_pool',
    'centralized_control',
    'api_access',
  ],
  // Chain tiers (similar to individual but multi-location)
  chain_starter: [
    'storefront',
    'product_search',
    'mobile_responsive',
    'enhanced_seo',
    'multi_location_5',
  ],
  chain_professional: [
    'quick_start_wizard',
    'barcode_scan',
    'gbp_integration',
    'custom_branding',
    'qr_codes_1024',
    'image_gallery_5',
    'multi_location_25',
    'basic_propagation',
  ],
  chain_enterprise: [
    'unlimited_skus',
    'white_label',
    'custom_domain',
    'qr_codes_2048',
    'image_gallery_10',
    'api_access',
    'unlimited_locations',
    'advanced_propagation',
    'dedicated_account_manager',
  ],
} as const;

// Tier hierarchy for inheritance (lower tiers inherit from higher)
// NOTE: 'trial' is not a tier - it's a subscription status that can apply to any tier
const TIER_HIERARCHY: Record<string, string[]> = {
  google_only: [],
  starter: ['google_only'],
  professional: ['starter', 'google_only'],
  enterprise: ['professional', 'starter', 'google_only'],
  organization: ['professional', 'starter', 'google_only'],
  chain_starter: ['starter', 'google_only'],
  chain_professional: ['professional', 'starter', 'google_only'],
  chain_enterprise: ['enterprise', 'professional', 'starter', 'google_only'],
};

// Feature to minimum required tier mapping
const FEATURE_TIER_MAP: Record<string, string> = {
  // Professional tier features (CRITICAL)
  quick_start_wizard: 'professional',
  barcode_scan: 'professional',
  gbp_integration: 'professional',
  custom_branding: 'professional',
  qr_codes_1024: 'professional',
  image_gallery_5: 'professional',
  
  // Enterprise tier features
  white_label: 'enterprise',
  custom_domain: 'enterprise',
  qr_codes_2048: 'enterprise',
  image_gallery_10: 'enterprise',
  api_access: 'enterprise',
  
  // Organization tier features
  propagation_products: 'organization',
  propagation_categories: 'organization',
  propagation_gbp_sync: 'organization',
  organization_dashboard: 'organization',
  hero_location: 'organization',
  strategic_testing: 'organization',
};

/**
 * Check if a tier has access to a feature
 * Now uses database-driven tiers with fallback to hardcoded values
 */
export async function checkTierAccess(tier: string, feature: string): Promise<boolean> {
  try {
    // Try database first
    const hasAccess = await TierService.checkTierFeatureAccess(tier, feature);
    return hasAccess;
  } catch (error) {
    console.warn('[checkTierAccess] Database lookup failed, using fallback:', error);
    
    // Fallback to hardcoded values
    const tierFeatures = TIER_FEATURES[tier as keyof typeof TIER_FEATURES] || [];
    
    if ((tierFeatures as readonly string[]).includes(feature)) {
      return true;
    }
    
    const inheritedTiers = TIER_HIERARCHY[tier] || [];
    for (const inheritedTier of inheritedTiers) {
      const inheritedFeatures = TIER_FEATURES[inheritedTier as keyof typeof TIER_FEATURES] || [];
      if ((inheritedFeatures as readonly string[]).includes(feature)) {
        return true;
      }
    }
    
    return false;
  }
}

/**
 * Get the minimum required tier for a feature
 */
export function getRequiredTier(feature: string): string {
  return FEATURE_TIER_MAP[feature] || 'professional';
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: string): string {
  const displayNames: Record<string, string> = {
    trial: 'Trial',
    google_only: 'Google-Only',
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise',
    organization: 'Organization',
    chain_starter: 'Chain Starter',
    chain_professional: 'Chain Professional',
    chain_enterprise: 'Chain Enterprise',
  };
  return displayNames[tier] || tier;
}

/**
 * Get tier pricing
 */
export function getTierPricing(tier: string): number {
  const pricing: Record<string, number> = {
    trial: 0,
    google_only: 29,
    starter: 49,
    professional: 499,
    enterprise: 999,
    organization: 999,
    chain_starter: 199,
    chain_professional: 1999,
    chain_enterprise: 4999,
  };
  return pricing[tier] || 0;
}

/**
 * Check if a tenant has access to a feature (including overrides)
 * Returns the access status and source (tier, override, or none)
 * Now uses TierService for database-driven tier lookups
 */
export async function checkTierAccessWithOverrides(
  tenantId: string,
  feature: string
): Promise<{ hasAccess: boolean; source: 'tier' | 'override' | 'none'; override?: any }> {
  // Use TierService which already handles overrides
  return await TierService.checkTenantFeatureAccess(tenantId, feature);
}

/**
 * Middleware to require a specific feature based on tier (with override support)
 * 
 * Usage:
 * router.post('/quick-start', requireTierFeature('quick_start_wizard'), handler);
 */
export function requireTierFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Platform admins and support bypass all tier restrictions
      const { canPerformSupportActions } = await import('../utils/platform-admin');
      if (canPerformSupportActions(req.user)) {
        return next();
      }
      
      // Get tenant ID from params, body, or query
      const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId_required',
          message: 'Tenant ID is required for feature access check',
        });
      }
      
      // Get tenant's subscription tier and status
      const tenant = await prisma.tenant.findUnique({
        where: { id: String(tenantId || '') },
        select: { 
          id: true,
          subscription_tier: true,
          subscription_status: true,
        },
      });
      
      if (!tenant) {
        return res.status(404).json({
          error: 'tenant_not_found',
          message: 'Tenant not found',
        });
      }
      
      // Check subscription status
      if (tenant.subscription_status === 'canceled' || tenant.subscription_status === 'expired') {
        return res.status(403).json({
          error: 'subscription_inactive',
          message: 'Your subscription is inactive. Please renew to access features.',
          subscription_status: tenant.subscription_status,
        });
      }
      
      // Check access (including overrides)
      const access = await checkTierAccessWithOverrides(String(tenantId), feature);
      
      if (!access.hasAccess) {
        const tierString = tenant.subscriptionTier || 'trial';
        const requiredTier = getRequiredTier(feature);
        const requiredTierDisplay = getTierDisplayName(requiredTier);
        const currentTierDisplay = getTierDisplayName(tierString);
        const requiredTierPrice = getTierPricing(requiredTier);
        const currentTierPrice = getTierPricing(tierString);
        
        return res.status(403).json({
          error: 'feature_not_available',
          message: `This feature requires ${requiredTierDisplay} tier or higher`,
          feature,
          currentTier: tenant.subscriptionTier,
          currentTierDisplay,
          currentTierPrice,
          requiredTier,
          requiredTierDisplay,
          requiredTierPrice,
          upgradeCost: requiredTierPrice - currentTierPrice,
          upgradeUrl: '/settings/subscription',
        });
      }
      
      // Add access info to request for logging
      (req as any).featureAccess = {
        feature,
        source: access.source,
        override: access.override,
      };
      
      // Log override usage
      if (access.source === 'override') {
        console.log(`[Feature Access] Override used: ${feature} for tenant ${tenantId} (reason: ${access.override?.reason || 'none'})`);
      }
      
      // Access granted
      next();
    } catch (error) {
      console.error('[requireTierFeature] Error:', error);
      return res.status(500).json({
        error: 'feature_check_failed',
        message: 'Failed to check feature access',
      });
    }
  };
}

/**
 * Middleware to check if tenant has any of the specified features
 * 
 * Usage:
 * router.post('/advanced', requireAnyTierFeature(['api_access', 'custom_domain']), handler);
 */
export function requireAnyTierFeature(features: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Platform admins and support bypass all tier restrictions
      const { canPerformSupportActions } = await import('../utils/platform-admin');
      if (canPerformSupportActions(req.user)) {
        return next();
      }
      
      const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId_required',
          message: 'Tenant ID is required for feature access check',
        });
      }
      
      const tenant = await prisma.tenant.findUnique({
        where: { id: String(tenantId || '') },
        select: { subscription_tier: true, subscription_status: true },
      });
      
      if (!tenant) {
        return res.status(404).json({ error: 'tenant_not_found' });
      }
      
      if (tenant.subscription_status === 'canceled' || tenant.subscription_status === 'expired') {
        return res.status(403).json({
          error: 'subscription_inactive',
          message: 'Your subscription is inactive',
        });
      }
      
      // Check if tenant has any of the features
      const tierString = tenant.subscriptionTier || 'trial';
      const hasAnyAccess = features.some(feature => 
        checkTierAccess(tierString, feature)
      );
      
      if (!hasAnyAccess) {
        return res.status(403).json({
          error: 'feature_not_available',
          message: 'This feature requires a higher tier',
          currentTier: tenant.subscriptionTier,
        });
      }
      
      next();
    } catch (error) {
      console.error('[requireAnyTierFeature] Error:', error);
      return res.status(500).json({ error: 'feature_check_failed' });
    }
  };
}

export async function requireWritableSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = (req.params.tenantId || req.params.id || req.body.tenantId || req.query.tenantId) as string | undefined;

    if (!tenantId) {
      return res.status(400).json({
        error: 'tenantId_required',
        message: 'Tenant ID is required for write operations',
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: String(tenantId) },
      select: {
        subscription_tier: true,
        subscription_status: true,
        trialEndsAt: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    const tier = tenant.subscriptionTier || 'starter';
    const status = tenant.subscription_status || 'active';
    const maintenanceState = getMaintenanceState({
      tier,
      status,
      trialEndsAt: tenant.trialEndsAt ?? undefined,
    });

    // Freeze: read-only visibility mode (canceled/expired or google_only outside maintenance window)
    if (maintenanceState === 'freeze') {
      return res.status(403).json({
        error: 'subscription_read_only',
        message: 'Your account is in read-only visibility mode. Upgrade to add or update products or sync new changes.',
        subscription_tier: tier,
        subscription_status: status,
        maintenanceState,
        upgradeUrl: '/settings/subscription',
      });
    }

    return next();
  } catch (error) {
    console.error('[requireWritableSubscription] Error:', error);
    return res.status(500).json({
      error: 'subscription_check_failed',
      message: 'Failed to check subscription status',
    });
  }
}

/**
 * Get all available features for a tier
 */
export function getTierFeatures(tier: string): string[] {
  const features = new Set<string>();
  
  // Add tier's own features
  const tierFeatures = TIER_FEATURES[tier as keyof typeof TIER_FEATURES] || [];
  (tierFeatures as readonly string[]).forEach(f => features.add(f));
  
  // Add inherited features
  const inheritedTiers = TIER_HIERARCHY[tier] || [];
  for (const inheritedTier of inheritedTiers) {
    const inheritedFeatures = TIER_FEATURES[inheritedTier as keyof typeof TIER_FEATURES] || [];
    (inheritedFeatures as readonly string[]).forEach(f => features.add(f));
  }
  
  return Array.from(features);
}
