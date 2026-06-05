/**
 * Seed script for tier system
 * Run with: npx tsx prisma/seed-tiers.ts
 */
/// <reference types="node" />

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding tier system...');

  // Check if tiers already exist
  const existingTiers = await prisma.subscription_tiers_list.count();
  if (existingTiers > 0) {
    console.log(`✓ Tiers already seeded (${existingTiers} tiers found)`);
    return;
  }

  // Seed tiers
  const tiers = [
    {
      id: 'tier_google_only',
      tier_key: 'google_only',
      name: 'Google-Only',
      display_name: 'Google-Only',
      description: 'Get discovered on Google',
      price_monthly: 2900,
      max_skus: 250,
      tier_type: 'individual',
      sort_order: 1,
      features: [
        { featureKey: 'google_shopping', featureName: 'Google Shopping', isInherited: false },
        { featureKey: 'google_merchant_center', featureName: 'Google Merchant Center', isInherited: false },
        { featureKey: 'basic_product_pages', featureName: 'Basic Product Pages', isInherited: false },
        { featureKey: 'qr_codes_512', featureName: 'QR Codes (512px)', isInherited: false },
        { featureKey: 'performance_analytics', featureName: 'Performance Analytics', isInherited: false },
        { featureKey: 'quick_start_wizard', featureName: 'Quick Start Wizard (Limited)', isInherited: false },
      ],
    },
    {
      id: 'tier_starter',
      tier_key: 'starter',
      name: 'Starter',
      display_name: 'Starter',
      description: 'Get started with the basics',
      price_monthly: 4900,
      max_skus: 500,
      tier_type: 'individual',
      sort_order: 2,
      features: [
        { featureKey: 'google_shopping', featureName: 'Google Shopping', isInherited: true },
        { featureKey: 'google_merchant_center', featureName: 'Google Merchant Center', isInherited: true },
        { featureKey: 'basic_product_pages', featureName: 'Basic Product Pages', isInherited: true },
        { featureKey: 'qr_codes_512', featureName: 'QR Codes (512px)', isInherited: true },
        { featureKey: 'performance_analytics', featureName: 'Performance Analytics', isInherited: true },
        { featureKey: 'storefront', featureName: 'Public Storefront', isInherited: false },
        { featureKey: 'product_search', featureName: 'Product Search', isInherited: false },
        { featureKey: 'mobile_responsive', featureName: 'Mobile-Responsive Design', isInherited: false },
        { featureKey: 'enhanced_seo', featureName: 'Enhanced SEO', isInherited: false },
        { featureKey: 'basic_categories', featureName: 'Basic Categories', isInherited: false },
      ],
    },
    {
      id: 'tier_professional',
      tier_key: 'professional',
      name: 'Professional',
      display_name: 'Professional',
      description: 'For established retail businesses',
      price_monthly: 49900,
      max_skus: 5000,
      tier_type: 'individual',
      sort_order: 3,
      features: [
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
        { featureKey: 'quick_start_wizard_full', featureName: 'Quick Start Wizard (Full)', isInherited: false },
        { featureKey: 'barcode_scan', featureName: 'Smart Barcode Scanner', isInherited: false },
        { featureKey: 'gbp_integration', featureName: 'Google Business Profile Integration', isInherited: false },
        { featureKey: 'custom_branding', featureName: 'Custom Branding', isInherited: false },
        { featureKey: 'business_logo', featureName: 'Business Logo', isInherited: false },
        { featureKey: 'qr_codes_1024', featureName: 'QR Codes (1024px)', isInherited: false },
        { featureKey: 'image_gallery_5', featureName: '5-Image Gallery', isInherited: false },
        { featureKey: 'interactive_maps', featureName: 'Interactive Maps', isInherited: false },
        { featureKey: 'privacy_mode', featureName: 'Privacy Mode', isInherited: false },
        { featureKey: 'custom_marketing_copy', featureName: 'Custom Marketing Copy', isInherited: false },
        { featureKey: 'priority_support', featureName: 'Priority Support', isInherited: false },
      ],
    },
    {
      id: 'tier_enterprise',
      tier_key: 'enterprise',
      name: 'Enterprise',
      display_name: 'Enterprise',
      description: 'For large single-location operations',
      price_monthly: 99900,
      max_skus: null,
      tier_type: 'individual',
      sort_order: 4,
      features: [
        { featureKey: 'google_shopping', featureName: 'Google Shopping', isInherited: true },
        { featureKey: 'storefront', featureName: 'Public Storefront', isInherited: true },
        { featureKey: 'product_scanning', featureName: 'Product Scanning', isInherited: true },
        { featureKey: 'custom_branding', featureName: 'Custom Branding', isInherited: true },
        { featureKey: 'unlimited_skus', featureName: 'Unlimited SKUs', isInherited: false },
        { featureKey: 'white_label', featureName: 'White Label Branding', isInherited: false },
        { featureKey: 'custom_domain', featureName: 'Custom Domain', isInherited: false },
        { featureKey: 'qr_codes_2048', featureName: 'QR Codes (2048px)', isInherited: false },
        { featureKey: 'image_gallery_10', featureName: '10-Image Gallery', isInherited: false },
        { featureKey: 'api_access', featureName: 'API Access', isInherited: false },
        { featureKey: 'advanced_analytics', featureName: 'Advanced Analytics', isInherited: false },
        { featureKey: 'dedicated_account_manager', featureName: 'Dedicated Account Manager', isInherited: false },
        { featureKey: 'sla_guarantee', featureName: 'SLA Guarantee', isInherited: false },
        { featureKey: 'custom_integrations', featureName: 'Custom Integrations', isInherited: false },
      ],
    },
  ];

  for (const tierData of tiers) {
    const { features, ...tier } = tierData;

    // Create the tier first
    const createdTier = await prisma.subscription_tiers_list.create({
      data: tier,
    });

    // Then create features for this tier
    if (features && features.length > 0) {
      await prisma.tier_features_list.createMany({
        data: features.map((feature, index) => ({
          id: `${createdTier.id}_${feature.featureKey}_${index}`, // Generate unique ID
          tier_id: createdTier.id,
          feature_key: feature.featureKey,
          feature_name: feature.featureName,
          is_inherited: feature.isInherited,
        })),
      });
    }

    console.log(`✓ Created tier: ${tier.display_name}`);
  }

  console.log('✅ Tier system seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding tiers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
