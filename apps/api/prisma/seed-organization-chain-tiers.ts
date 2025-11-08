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

  // Find chain tier  
  const chainTier = await prisma.subscriptionTier.findFirst({
    where: { tierKey: 'chain' },
  });

  if (!orgTier && !chainTier) {
    console.log('⚠️  No organization or chain tiers found. Creating them...');
    
    // Create organization tier
    const newOrgTier = await prisma.subscriptionTier.create({
      data: {
        tierKey: 'organization',
        name: 'Organization',
        displayName: 'Organization',
        description: 'For multi-location businesses managed as an organization',
        priceMonthly: 0, // Custom pricing
        maxSKUs: null, // Unlimited
        maxLocations: null, // Unlimited
        tierType: 'organization',
        isActive: true,
        sortOrder: 5,
      },
    });
    console.log(`✓ Created organization tier: ${newOrgTier.id}`);

    // Create chain tier
    const newChainTier = await prisma.subscriptionTier.create({
      data: {
        tierKey: 'chain',
        name: 'Chain',
        displayName: 'Chain',
        description: 'For retail chains with multiple locations under one brand',
        priceMonthly: 0, // Custom pricing
        maxSKUs: null, // Unlimited
        maxLocations: null, // Unlimited
        tierType: 'organization',
        isActive: true,
        sortOrder: 6,
      },
    });
    console.log(`✓ Created chain tier: ${newChainTier.id}`);
  }

  // Re-fetch to ensure we have the IDs
  const organizationTier = await prisma.subscriptionTier.findFirst({
    where: { tierKey: 'organization' },
    include: { features: true },
  });

  const chainTierFinal = await prisma.subscriptionTier.findFirst({
    where: { tierKey: 'chain' },
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
        { featureKey: 'product_scanning', featureName: 'Product Scanning', isInherited: true },
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
        await prisma.tierFeature.create({
          data: {
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

  // Chain Tier Features (inherits all Organization features + adds chain-specific)
  if (chainTierFinal) {
    if (chainTierFinal.features.length === 0) {
      console.log('Adding features to Chain tier...');
      
      const chainFeatures = [
        // Inherited from Organization
        { featureKey: 'google_shopping', featureName: 'Google Shopping', isInherited: true },
        { featureKey: 'storefront', featureName: 'Public Storefront', isInherited: true },
        { featureKey: 'product_scanning', featureName: 'Product Scanning', isInherited: true },
        { featureKey: 'custom_branding', featureName: 'Custom Branding', isInherited: true },
        { featureKey: 'unlimited_skus', featureName: 'Unlimited SKUs', isInherited: true },
        { featureKey: 'white_label', featureName: 'White Label Branding', isInherited: true },
        { featureKey: 'custom_domain', featureName: 'Custom Domain', isInherited: true },
        { featureKey: 'api_access', featureName: 'API Access', isInherited: true },
        { featureKey: 'advanced_analytics', featureName: 'Advanced Analytics', isInherited: true },
        { featureKey: 'dedicated_account_manager', featureName: 'Dedicated Account Manager', isInherited: true },
        { featureKey: 'sla_guarantee', featureName: 'SLA Guarantee', isInherited: true },
        { featureKey: 'multi_location', featureName: 'Multi-Location Management', isInherited: true },
        { featureKey: 'centralized_inventory', featureName: 'Centralized Inventory', isInherited: true },
        { featureKey: 'location_groups', featureName: 'Location Groups', isInherited: true },
        { featureKey: 'bulk_operations', featureName: 'Bulk Operations', isInherited: true },
        { featureKey: 'role_based_access', featureName: 'Role-Based Access Control', isInherited: true },
        { featureKey: 'organization_dashboard', featureName: 'Organization Dashboard', isInherited: true },
        { featureKey: 'cross_location_reporting', featureName: 'Cross-Location Reporting', isInherited: true },
        { featureKey: 'custom_pricing', featureName: 'Custom Pricing', isInherited: true },
        
        // Chain-specific features
        { featureKey: 'chain_branding', featureName: 'Chain-Wide Branding', isInherited: false },
        { featureKey: 'franchise_management', featureName: 'Franchise Management', isInherited: false },
        { featureKey: 'chain_analytics', featureName: 'Chain-Wide Analytics', isInherited: false },
        { featureKey: 'regional_management', featureName: 'Regional Management', isInherited: false },
        { featureKey: 'chain_promotions', featureName: 'Chain-Wide Promotions', isInherited: false },
        { featureKey: 'master_catalog', featureName: 'Master Product Catalog', isInherited: false },
        { featureKey: 'location_templates', featureName: 'Location Templates', isInherited: false },
        { featureKey: 'enterprise_sso', featureName: 'Enterprise SSO', isInherited: false },
      ];

      for (const feature of chainFeatures) {
        await prisma.tierFeature.create({
          data: {
            tierId: chainTierFinal.id,
            ...feature,
            isEnabled: true,
          },
        });
      }
      console.log(`✓ Added ${chainFeatures.length} features to Chain tier`);
    } else {
      console.log(`✓ Chain tier already has ${chainTierFinal.features.length} features`);
    }
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
