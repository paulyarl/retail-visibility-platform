/**
 * Seed script to add features to organization and chain tiers
 * Run with: npx tsx prisma/seed-organization-chain-tiers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Adding features to organization and chain tiers...');

  // Find organization tier
  const orgTier = await prisma.subscriptionTier.findFirst({
    where: { tierKey: 'organization' },
  });

  // Find chain tiers
  const chainStarterTier = await prisma.subscriptionTier.findFirst({
    where: { tierKey: 'chain_starter' },
  });
  
  const chainProfessionalTier = await prisma.subscriptionTier.findFirst({
    where: { tierKey: 'chain_professional' },
  });
  
  const chainEnterpriseTier = await prisma.subscriptionTier.findFirst({
    where: { tierKey: 'chain_enterprise' },
  });

  if (!orgTier && !chainStarterTier && !chainProfessionalTier && !chainEnterpriseTier) {
    console.log('⚠️  No organization or chain tiers found. Creating them...');
    
    // Create organization tier
    const newOrgTier = await prisma.subscriptionTier.create({
      data: {
        id: generateTierId(),
        tierKey: 'organization',
        name: 'Organization',
        displayName: 'Organization',
        description: 'For multi-location businesses managed as an organization',
        priceMonthly: 0, // Custom pricing
        maxSkus: null, // Unlimited
        maxLocations: null, // Unlimited
        tierType: 'organization',
        isActive: true,
        sortOrder: 5,
      },
    });
    console.log(`✓ Created organization tier: ${newOrgTier.id}`);

    // Create chain tiers (mirror individual tiers)
    const newChainStarter = await prisma.subscriptionTier.create({
      data: {
        id: generateTierId(),
        tierKey: 'chain_starter',
        name: 'Chain Starter',
        displayName: 'Chain Starter',
        description: 'Starter tier for retail chains',
        priceMonthly: 19900, // $199/mo
        maxSkus: 500,
        maxLocations: null,
        tierType: 'organization',
        isActive: true,
        sortOrder: 6,
      },
    });
    console.log(`✓ Created chain starter tier: ${newChainStarter.id}`);

    const newChainProfessional = await prisma.subscriptionTier.create({
      data: {
        id: generateTierId(),
        tierKey: 'chain_professional',
        name: 'Chain Professional',
        displayName: 'Chain Professional',
        description: 'Professional tier for retail chains',
        priceMonthly: 199900, // $1,999/mo
        maxSkus: 5000,
        maxLocations: null,
        tierType: 'organization',
        isActive: true,
        sortOrder: 7,
      },
    });
    console.log(`✓ Created chain professional tier: ${newChainProfessional.id}`);

    const newChainEnterprise = await prisma.subscriptionTier.create({
      data: {
        id:generateTierId(),
        tierKey: 'chain_enterprise',
        name: 'Chain Enterprise',
        displayName: 'Chain Enterprise',
        description: 'Enterprise tier for retail chains',
        priceMonthly: 499900, // $4,999/mo
        maxSkus: null,
        maxLocations: null,
        tierType: 'organization',
        isActive: true,
        sortOrder: 8,
      },
    });
    console.log(`✓ Created chain enterprise tier: ${newChainEnterprise.id}`);
  }

  // Re-fetch to ensure we have the IDs
  const organizationTier = await prisma.subscriptionTier.findFirst({
    where: { tierKey: 'organization' },
    include: { features: true },
  });

  const chainStarterFinal = await prisma.subscriptionTier.findFirst({
    where: { tierKey: 'chain_starter' },
    include: { features: true },
  });

  const chainProfessionalFinal = await prisma.subscriptionTier.findFirst({
    where: { tierKey: 'chain_professional' },
    include: { features: true },
  });

  const chainEnterpriseFinal = await prisma.subscriptionTier.findFirst({
    where: { tierKey: 'chain_enterprise' },
    include: { features: true },
  });

  // Organization Tier Features (inherits all Enterprise features + adds organization-specific)
  if (organizationTier) {
    if (organizationTier.features.length === 0) {
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
        await prisma.tierFeatures.create({
          data: {
            id: generateFeatureId(),
            tierId: organizationTier.id,
            ...feature,
            isEnabled: true,
          },
        });
      }
      console.log(`✓ Added ${orgFeatures.length} features to Organization tier`);
    } else {
      console.log(`✓ Organization tier already has ${organizationTier.features.length} features`);
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
  if (chainStarterFinal && chainStarterFinal.features.length === 0) {
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
      await prisma.tierFeatures.create({
        data: {
          id: generateFeatureId(),
          tierId: chainStarterFinal.id,
          ...feature,
          isEnabled: true,
        },
      });
    }
    console.log(`✓ Added ${chainStarterFeatures.length} features to Chain Starter tier`);
  }

  // Chain Professional Features (mirrors Professional + chain features)
  if (chainProfessionalFinal && chainProfessionalFinal.features.length === 0) {
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
      await prisma.tierFeatures.create({
        data: {
          id: generateFeatureId(),
          tierId: chainProfessionalFinal.id,
          ...feature,
          isEnabled: true,
        },
      });
    }
    console.log(`✓ Added ${chainProfessionalFeatures.length} features to Chain Professional tier`);
  }

  // Chain Enterprise Features (mirrors Enterprise + chain features + enterprise SSO)
  if (chainEnterpriseFinal && chainEnterpriseFinal.features.length === 0) {
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
      await prisma.tierFeatures.create({
        data: {
          id: generateFeatureId(),
          tierId: chainEnterpriseFinal.id,
          ...feature,
          isEnabled: true,
        },
      });
    }
    console.log(`✓ Added ${chainEnterpriseFeatures.length} features to Chain Enterprise tier`);
  }

  console.log('✅ Organization and Chain tiers updated successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding organization/chain tiers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
function generateTierId(): any {
  throw new Error('Function not implemented.');
}

function generateFeatureId(): any {
  throw new Error('Function not implemented.');
}

