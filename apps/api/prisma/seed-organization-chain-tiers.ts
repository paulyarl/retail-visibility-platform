/**
 * Seed script to add features to organization and chain tiers
 * Run with: npx tsx prisma/seed-organization-chain-tiers.ts
 */
/// <reference types="node" />

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Adding features to organization and chain tiers...');

  // Find organization tier
  const orgTier = await prisma.subscription_tiers_list.findFirst({
    where: { tier_key: 'organization' },
  });

  // Find chain tiers
  const chainStarterTier = await prisma.subscription_tiers_list.findFirst({
    where: { tier_key: 'chain_starter' },
  });
  
  const chainProfessionalTier = await prisma.subscription_tiers_list.findFirst({
    where: { tier_key: 'chain_professional' },
  });
  
  const chainEnterpriseTier = await prisma.subscription_tiers_list.findFirst({
    where: { tier_key: 'chain_enterprise' },
  });

  if (!orgTier && !chainStarterTier && !chainProfessionalTier && !chainEnterpriseTier) {
    console.log('⚠️  No organization or chain tiers found. Creating them...');
    
    // Create organization tier
    const newOrgTier = await prisma.subscription_tiers_list.create({
      data: {
        id: generateTierId(),
        tier_key: 'organization',
        name: 'Organization',
        display_name: 'Organization',
        description: 'For multi-location businesses managed as an organization',
        price_monthly: 0, // Custom pricing
        max_skus: null, // Unlimited
        max_locations: null, // Unlimited
        tier_type: 'organization',
        is_active: true,
        sort_order: 5,
      },
    });
    console.log(`✓ Created organization tier: ${newOrgTier.id}`);

    // Create chain tiers (mirror individual tiers)
    const newChainStarter = await prisma.subscription_tiers_list.create({
      data: {
        id: generateTierId(),
        tier_key: 'chain_starter',
        name: 'Chain Starter',
        display_name: 'Chain Starter',
        description: 'Starter tier for retail chains',
        price_monthly: 19900, // $199/mo
        max_skus: 500,
        max_locations: null,
        tier_type: 'organization',
        is_active: true,
        sort_order: 6,
      },
    });
    console.log(`✓ Created chain starter tier: ${newChainStarter.id}`);

    const newChainProfessional = await prisma.subscription_tiers_list.create({
      data: {
        id: generateTierId(),
        tier_key: 'chain_professional',
        name: 'Chain Professional',
        display_name: 'Chain Professional',
        description: 'Professional tier for retail chains',
        price_monthly: 199900, // $1,999/mo
        max_skus: 5000,
        max_locations: null,
        tier_type: 'organization',
        is_active: true,
        sort_order: 7,
      },
    });
    console.log(`✓ Created chain professional tier: ${newChainProfessional.id}`);

    const newChainEnterprise = await prisma.subscription_tiers_list.create({
      data: {
        id:generateTierId(),
        tier_key: 'chain_enterprise',
        name: 'Chain Enterprise',
        display_name: 'Chain Enterprise',
        description: 'Enterprise tier for retail chains',
        price_monthly: 499900, // $4,999/mo
        max_skus: null,
        max_locations: null,
        tier_type: 'organization',
        is_active: true,
        sort_order: 8,
      },
    });
    console.log(`✓ Created chain enterprise tier: ${newChainEnterprise.id}`);
  }

  // Re-fetch to ensure we have the IDs
  const organizationTier = await prisma.subscription_tiers_list.findFirst({
    where: { tier_key: 'organization' },
    include: { tier_features_list: true },
  });

  const chainStarterFinal = await prisma.subscription_tiers_list.findFirst({
    where: { tier_key: 'chain_starter' },
    include: { tier_features_list: true },
  });

  const chainProfessionalFinal = await prisma.subscription_tiers_list.findFirst({
    where: { tier_key: 'chain_professional' },
    include: { tier_features_list: true },
  });

  const chainEnterpriseFinal = await prisma.subscription_tiers_list.findFirst({
    where: { tier_key: 'chain_enterprise' },
    include: { tier_features_list: true },
  });

  // Organization Tier Features (inherits all Enterprise features + adds organization-specific)
  if (organizationTier) {
    if (organizationTier.tier_features_list.length === 0) {
      console.log('Adding features to Organization tier...');
      
      const orgFeatures = [
        // Inherited from Enterprise
        { featureKey: 'google_shopping', featureName: 'Google Shopping', isInherited: true },
        { featureKey: 'storefront', featureName: 'Public Storefront', isInherited: true },
        { featureKey: 'barcode_scan', featureName: 'Smart Barcode Scanner', isInherited: true },
        { featureKey: 'custom_branding', featureName: 'Custom Branding', isInherited: true },
        { featureKey: 'unlimited_skus', featureName: 'Unlimited SKUs', isInherited: true },
        { featureKey: 'white_label', featureName: 'White Label Branding', isInherited: true },
        { featureKey: 'custom_domain', featureName: 'Custom Domain', isInherited: true },
        { featureKey: 'api_access', featureName: 'API Access', isInherited: true },
        { featureKey: 'advanced_analytics', featureName: 'Advanced Analytics', isInherited: true },
        { featureKey: 'dedicated_account_manager', featureName: 'Dedicated Account Manager', isInherited: true },
        { featureKey: 'sla_guarantee', featureName: 'SLA Guarantee', isInherited: true },
        
        // Organization-specific features
        { featureKey: 'multi_location', featureName: 'Multi-Location Management', isInherited: false },
        { featureKey: 'centralized_inventory', featureName: 'Centralized Inventory', isInherited: false },
        { featureKey: 'location_groups', featureName: 'Location Groups', isInherited: false },
        { featureKey: 'bulk_operations', featureName: 'Bulk Operations', isInherited: false },
        { featureKey: 'role_based_access', featureName: 'Role-Based Access Control', isInherited: false },
        { featureKey: 'organization_dashboard', featureName: 'Organization Dashboard', isInherited: false },
        { featureKey: 'cross_location_reporting', featureName: 'Cross-Location Reporting', isInherited: false },
        { featureKey: 'custom_pricing', featureName: 'Custom Pricing', isInherited: false },
      ];

      for (const feature of orgFeatures) {
        await prisma.tier_features_list.create({
          data: {
            id: generateFeatureId(),
            tier_id: organizationTier.id,
            feature_key: feature.featureKey,
            feature_name: feature.featureName,
            is_inherited: feature.isInherited,
            is_enabled: true,
          },
        });
      }
      console.log(`✓ Added ${orgFeatures.length} features to Organization tier`);
    } else {
      console.log(`✓ Organization tier already has ${organizationTier.tier_features_list.length} features`);
    }
  }

  // Chain-specific features (added to all chain tiers)
  const chainSpecificFeatures = [
    { featureKey: 'chain_branding', featureName: 'Chain-Wide Branding', isInherited: false },
    { featureKey: 'franchise_management', featureName: 'Franchise Management', isInherited: false },
    { featureKey: 'chain_analytics', featureName: 'Chain-Wide Analytics', isInherited: false },
    { featureKey: 'regional_management', featureName: 'Regional Management', isInherited: false },
    { featureKey: 'chain_promotions', featureName: 'Chain-Wide Promotions', isInherited: false },
    { featureKey: 'master_catalog', featureName: 'Master Product Catalog', isInherited: false },
    { featureKey: 'location_templates', featureName: 'Location Templates', isInherited: false },
  ];

  // Chain Starter Features (mirrors Starter + chain features)
  if (chainStarterFinal && chainStarterFinal.tier_features_list.length === 0) {
    console.log('Adding features to Chain Starter tier...');
    
    const chainStarterFeatures = [
      // Inherited from Starter
      { featureKey: 'google_shopping', featureName: 'Google Shopping', isInherited: true },
      { featureKey: 'google_merchant_center', featureName: 'Google Merchant Center', isInherited: true },
      { featureKey: 'basic_product_pages', featureName: 'Basic Product Pages', isInherited: true },
      { featureKey: 'qr_codes_512', featureName: 'QR Codes (512px)', isInherited: true },
      { featureKey: 'performance_analytics', featureName: 'Performance Analytics', isInherited: true },
      { featureKey: 'storefront', featureName: 'Public Storefront', isInherited: true },
      { featureKey: 'product_search', featureName: 'Product Search', isInherited: true },
      { featureKey: 'mobile_responsive', featureName: 'Mobile-Responsive Design', isInherited: true },
      { featureKey: 'enhanced_seo', featureName: 'Enhanced SEO', isInherited: true },
      { featureKey: 'basic_categories', featureName: 'Basic Categories', isInherited: true },
      ...chainSpecificFeatures,
    ];

    for (const feature of chainStarterFeatures) {
      await prisma.tier_features_list.create({
        data: {
          id: generateFeatureId(),
          tier_id: chainStarterFinal.id,
          feature_key: feature.featureKey,
          feature_name: feature.featureName,
          is_inherited: feature.isInherited,
          is_enabled: true,
        },
      });
    }
    console.log(`✓ Added ${chainStarterFeatures.length} features to Chain Starter tier`);
  }

  // Chain Professional Features (mirrors Professional + chain features)
  if (chainProfessionalFinal && chainProfessionalFinal.tier_features_list.length === 0) {
    console.log('Adding features to Chain Professional tier...');
    
    const chainProfessionalFeatures = [
      // Inherited from Professional
      { featureKey: 'google_shopping', featureName: 'Google Shopping', isInherited: true },
      { featureKey: 'google_merchant_center', featureName: 'Google Merchant Center', isInherited: true },
      { featureKey: 'basic_product_pages', featureName: 'Basic Product Pages', isInherited: true },
      { featureKey: 'qr_codes_512', featureName: 'QR Codes (512px)', isInherited: true },
      { featureKey: 'performance_analytics', featureName: 'Performance Analytics', isInherited: true },
      { featureKey: 'storefront', featureName: 'Public Storefront', isInherited: true },
      { featureKey: 'product_search', featureName: 'Product Search', isInherited: true },
      { featureKey: 'mobile_responsive', featureName: 'Mobile-Responsive Design', isInherited: true },
      { featureKey: 'enhanced_seo', featureName: 'Enhanced SEO', isInherited: true },
      { featureKey: 'basic_categories', featureName: 'Basic Categories', isInherited: true },
      { featureKey: 'quick_start_wizard_full', featureName: 'Quick Start Wizard (Full)', isInherited: true },
      { featureKey: 'barcode_scan', featureName: 'Smart Barcode Scanner', isInherited: true },
      { featureKey: 'gbp_integration', featureName: 'Google Business Profile Integration', isInherited: true },
      { featureKey: 'custom_branding', featureName: 'Custom Branding', isInherited: true },
      { featureKey: 'business_logo', featureName: 'Business Logo', isInherited: true },
      { featureKey: 'qr_codes_1024', featureName: 'QR Codes (1024px)', isInherited: true },
      { featureKey: 'image_gallery_5', featureName: '5-Image Gallery', isInherited: true },
      { featureKey: 'interactive_maps', featureName: 'Interactive Maps', isInherited: true },
      { featureKey: 'privacy_mode', featureName: 'Privacy Mode', isInherited: true },
      { featureKey: 'custom_marketing_copy', featureName: 'Custom Marketing Copy', isInherited: true },
      { featureKey: 'priority_support', featureName: 'Priority Support', isInherited: true },
      ...chainSpecificFeatures,
    ];

    for (const feature of chainProfessionalFeatures) {
      await prisma.tier_features_list.create({
        data: {
          id: generateFeatureId(),
          tier_id: chainProfessionalFinal.id,
          feature_key: feature.featureKey,
          feature_name: feature.featureName,
          is_inherited: feature.isInherited,
          is_enabled: true,
        },
      });
    }
    console.log(`✓ Added ${chainProfessionalFeatures.length} features to Chain Professional tier`);
  }

  // Chain Enterprise Features (mirrors Enterprise + chain features + enterprise SSO)
  if (chainEnterpriseFinal && chainEnterpriseFinal.tier_features_list.length === 0) {
    console.log('Adding features to Chain Enterprise tier...');
    
    const chainEnterpriseFeatures = [
      // Inherited from Enterprise
      { featureKey: 'google_shopping', featureName: 'Google Shopping', isInherited: true },
      { featureKey: 'storefront', featureName: 'Public Storefront', isInherited: true },
      { featureKey: 'barcode_scan', featureName: 'Smart Barcode Scanner', isInherited: true },
      { featureKey: 'custom_branding', featureName: 'Custom Branding', isInherited: true },
      { featureKey: 'unlimited_skus', featureName: 'Unlimited SKUs', isInherited: true },
      { featureKey: 'white_label', featureName: 'White Label Branding', isInherited: true },
      { featureKey: 'custom_domain', featureName: 'Custom Domain', isInherited: true },
      { featureKey: 'qr_codes_2048', featureName: 'QR Codes (2048px)', isInherited: true },
      { featureKey: 'image_gallery_10', featureName: '10-Image Gallery', isInherited: true },
      { featureKey: 'api_access', featureName: 'API Access', isInherited: true },
      { featureKey: 'advanced_analytics', featureName: 'Advanced Analytics', isInherited: true },
      { featureKey: 'dedicated_account_manager', featureName: 'Dedicated Account Manager', isInherited: true },
      { featureKey: 'sla_guarantee', featureName: 'SLA Guarantee', isInherited: true },
      { featureKey: 'custom_integrations', featureName: 'Custom Integrations', isInherited: true },
      ...chainSpecificFeatures,
      // Enterprise-only chain feature
      { featureKey: 'enterprise_sso', featureName: 'Enterprise SSO', isInherited: false },
    ];

    for (const feature of chainEnterpriseFeatures) {
      await prisma.tier_features_list.create({
        data: {
          id: generateFeatureId(),
          tier_id: chainEnterpriseFinal.id,
          feature_key: feature.featureKey,
          feature_name: feature.featureName,
          is_inherited: feature.isInherited,
          is_enabled: true,
        },
      });
    }
    console.log(`✓ Added ${chainEnterpriseFeatures.length} features to Chain Enterprise tier`);
  }

  console.log('✅ Organization and Chain tiers updated successfully!');
}

function generateTierId(): string {
  return `tier_${crypto.randomUUID()}`;
}

function generateFeatureId(): string {
  return `feat_${crypto.randomUUID()}`;
}

main()
  .catch((e) => {
    console.error('❌ Error seeding organization/chain tiers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
