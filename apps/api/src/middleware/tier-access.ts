import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

/**
 * Tier-Based Feature Access Control
 * 
 * This middleware enforces feature access based on subscription tiers.
 * Features are cumulative - higher tiers inherit lower tier features.
 * 
 * CRITICAL: This protects revenue by ensuring customers must upgrade
 * to access premium features like Quick Start, Scanning, and GBP Integration.
 */

// Define features available at each tier (cumulative)
export const TIER_FEATURES = {
  trial: [
    'google_shopping',
    'basic_product_pages',
    'qr_codes_512',
  ],
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
    'product_scanning',          // Worth $375/mo in labor
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
    'product_scanning',
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
const TIER_HIERARCHY: Record<string, string[]> = {
  trial: [],
  google_only: ['trial'],
  starter: ['google_only', 'trial'],
  professional: ['starter', 'google_only', 'trial'],
  enterprise: ['professional', 'starter', 'google_only', 'trial'],
  organization: ['professional', 'starter', 'google_only', 'trial'],
  chain_starter: ['starter', 'google_only', 'trial'],
  chain_professional: ['professional', 'starter', 'google_only', 'trial'],
  chain_enterprise: ['enterprise', 'professional', 'starter', 'google_only', 'trial'],
};

// Feature to minimum required tier mapping
const FEATURE_TIER_MAP: Record<string, string> = {
  // Professional tier features (CRITICAL)
  quick_start_wizard: 'professional',
  product_scanning: 'professional',
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
 */
export function checkTierAccess(tier: string, feature: string): boolean {
  // Get features for this tier
  const tierFeatures = TIER_FEATURES[tier as keyof typeof TIER_FEATURES] || [];
  
  // Check if feature is in this tier
  if ((tierFeatures as readonly string[]).includes(feature)) {
    return true;
  }
  
  // Check inherited tiers
  const inheritedTiers = TIER_HIERARCHY[tier] || [];
  for (const inheritedTier of inheritedTiers) {
    const inheritedFeatures = TIER_FEATURES[inheritedTier as keyof typeof TIER_FEATURES] || [];
    if ((inheritedFeatures as readonly string[]).includes(feature)) {
      return true;
    }
  }
  
  return false;
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
 * Middleware to require a specific feature based on tier
 * 
 * Usage:
 * router.post('/quick-start', requireTierFeature('quick_start_wizard'), handler);
 */
export function requireTierFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get tenant ID from params, body, or query
      const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          error: 'tenant_id_required',
          message: 'Tenant ID is required for feature access check',
        });
      }
      
      // Get tenant's subscription tier
      const tenant = await prisma.tenant.findUnique({
        where: { id: String(tenantId || '') },
        select: { 
          id: true,
          subscriptionTier: true,
          subscriptionStatus: true,
        },
      });
      
      if (!tenant) {
        return res.status(404).json({
          error: 'tenant_not_found',
          message: 'Tenant not found',
        });
      }
      
      // Check subscription status
      if (tenant.subscriptionStatus === 'canceled' || tenant.subscriptionStatus === 'expired') {
        return res.status(403).json({
          error: 'subscription_inactive',
          message: 'Your subscription is inactive. Please renew to access features.',
          subscriptionStatus: tenant.subscriptionStatus,
        });
      }
      
      // Check if tier has access to feature
      const tierString = tenant.subscriptionTier || 'trial';
      const hasAccess = checkTierAccess(tierString, feature);
      
      if (!hasAccess) {
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
      const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          error: 'tenant_id_required',
          message: 'Tenant ID is required for feature access check',
        });
      }
      
      const tenant = await prisma.tenant.findUnique({
        where: { id: String(tenantId || '') },
        select: { subscriptionTier: true, subscriptionStatus: true },
      });
      
      if (!tenant) {
        return res.status(404).json({ error: 'tenant_not_found' });
      }
      
      if (tenant.subscriptionStatus === 'canceled' || tenant.subscriptionStatus === 'expired') {
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
