/**
 * Platform Showcase Store Creator
 * 
 * Creates a dedicated demo/showcase store for the platform with:
 * - Platform branding (logo, colors, info)
 * - Diverse product catalog across multiple categories
 * - Professional business profile
 * - Featured/showcase status
 * - Special permissions and settings
 * 
 * Run with: npx tsx scripts/create-platform-showcase-store.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateQuickStartProducts } from '../src/lib/quick-start';
import { generateTenantId } from '../src/lib/id-generator';

const prisma = new PrismaClient();

// Platform showcase store configuration
const SHOWCASE_CONFIG = {
  tenant: {
    name: 'VisibleShelf Demo Store',
    subscriptionTier: 'professional', // Give it Pro features
    subscriptionStatus: 'active',
  },
  businessProfile: {
    businessName: 'VisibleShelf Demo Store',
    businessLine1: '123 Demo Street',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94102',
    countryCode: 'US',
    phoneNumber: '+1 (555) 123-4567',
    email: 'demo@visibleshelf.com',
    website: 'https://visibleshelf.com',
    contactPerson: 'Demo Team',
    // Platform logo URL - update this with your actual logo
    logoUrl: 'https://visibleshelf.com/logo.png',
    displayMap: true,
    mapPrivacyMode: 'approximate',
    latitude: 37.7749,
    longitude: -122.4194,
    socialLinks: {
      facebook: 'https://facebook.com/visibleshelf',
      twitter: 'https://twitter.com/visibleshelf',
      instagram: 'https://instagram.com/visibleshelf',
    },
    seoTags: {
      title: 'VisibleShelf Demo Store - See What\'s Possible',
      description: 'Explore our showcase store featuring products across multiple categories. See how VisibleShelf can transform your retail business.',
      keywords: ['demo store', 'retail showcase', 'inventory management', 'visible shelf'],
    },
    updatedAt: new Date(),
  },
  // Product mix across different scenarios
  productScenarios: [
    { scenario: 'grocery', count: 30 },
    { scenario: 'fashion', count: 20 },
    { scenario: 'electronics', count: 15 },
    { scenario: 'home', count: 15 },
    { scenario: 'sports', count: 10 },
    { scenario: 'beauty', count: 10 },
  ],
};

async function createShowcaseStore() {
  console.log('🎨 Creating Platform Showcase Store...\n');

  try {
    // Step 1: Check if showcase store already exists
    const existingTenant = await prisma.tenant.findFirst({
      where: { name: SHOWCASE_CONFIG.tenant.name },
    });

    if (existingTenant) {
      console.log('⚠️  Showcase store already exists!');
      console.log(`   Tenant ID: ${existingTenant.id}`);
      console.log(`   Name: ${existingTenant.name}`);
      console.log('\n   Delete it first if you want to recreate it.\n');
      return;
    }

    // Step 2: Create tenant
    console.log('📦 Creating tenant...');
    const tenant = await prisma.tenant.create({
      data: {
        id: generateTenantId(),
        name: SHOWCASE_CONFIG.tenant.name,
        subscriptionTier: SHOWCASE_CONFIG.tenant.subscriptionTier,
        subscriptionStatus: SHOWCASE_CONFIG.tenant.subscriptionStatus,
        region: 'us-east-1',
        language: 'en-US',
        currency: 'USD',
        dataPolicyAccepted: true,
        metadata: {
          isShowcase: true,
          isPlatformDemo: true,
          createdBy: 'platform-admin',
          purpose: 'Platform showcase and demo store',
        },
      },
    });
    console.log(`✅ Tenant created: ${tenant.id}\n`);

    // Step 3: Create business profile with platform branding
    console.log('🏢 Creating business profile with platform branding...');
    await prisma.tenantBusinessProfile.create({
      data: {
        
        tenantId: tenant.id,
        ...SHOWCASE_CONFIG.businessProfile,
      },
    });
    console.log('✅ Business profile created\n');

    // Step 4: Populate with diverse products
    console.log('🛍️  Populating product catalog...\n');
    
    let totalProducts = 0;
    for (const { scenario, count } of SHOWCASE_CONFIG.productScenarios) {
      console.log(`   Adding ${count} ${scenario} products...`);
      try {
        const result = await generateQuickStartProducts({
          tenant_id: tenant.id,
          scenario: scenario as any, // Type assertion for scenario names
          productCount: count,
          assignCategories: true,
          createAsDrafts: false, // Make them active for showcase
        });
        totalProducts += result.productsCreated;
        console.log(`   ✅ ${result.productsCreated} products added`);
      } catch (error) {
        console.error(`   ⚠️  Error adding ${scenario} products:`, error);
      }
    }
    
    console.log(`\n✅ Total products created: ${totalProducts}\n`);

    // Step 5: Mark as featured in directory (if directory exists)
    try {
      console.log('⭐ Setting up directory featured status...');
      const directorySettings = await prisma.directorySettings.upsert({
        where: { tenantId: tenant.id },
        create: {
          id: tenant.id,
          tenantId: tenant.id,
          isPublished: true,
          isFeatured: true,
          featuredUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          slug: 'demo-store',
          seoDescription: SHOWCASE_CONFIG.businessProfile.seoTags.description,
          seoKeywords: SHOWCASE_CONFIG.businessProfile.seoTags.keywords,
          primaryCategory: 'retail',
          secondaryCategories: ['grocery', 'fashion', 'electronics', 'home'],
          updatedAt: new Date(),
        },
        update: {
          isPublished: true,
          isFeatured: true,
          featuredUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });
      console.log('✅ Directory settings configured\n');
    } catch (error) {
      console.log('⚠️  Directory settings not configured (table may not exist yet)\n');
    }

    // Step 6: Create feature overrides for showcase capabilities
    console.log('🔓 Granting showcase feature access...');
    const showcaseFeatures = [
      'quick_start_wizard',
      'product_scanning',
      'category_quick_start',
      'bulk_upload',
      'analytics_dashboard',
      'storefront_customization',
      'google_merchant_sync',
    ];

    for (const feature of showcaseFeatures) {
      try {
        await prisma.tenantFeatureOverrides.upsert({
          where: {
            tenantId_feature: {
              tenantId: tenant.id,
              feature,
            },
          },
          create: {
            id: `${tenant.id}_${feature}`,
            tenantId: tenant.id,
            feature,
            granted: true,
            reason: 'Platform showcase store',
            grantedBy: 'platform-admin',
            updatedAt: new Date(),
          },
          update: {
            granted: true,
            reason: 'Platform showcase store',
          },
        });
      } catch (error) {
        // Feature override table may not exist yet
      }
    }
    console.log('✅ Feature access granted\n');

    // Success summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 Platform Showcase Store Created Successfully!');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`📋 Tenant ID: ${tenant.id}`);
    console.log(`🏪 Store Name: ${tenant.name}`);
    console.log(`📦 Products: ${totalProducts}`);
    console.log(`🎨 Tier: ${tenant.subscriptionTier}`);
    console.log(`⭐ Status: Featured showcase store`);
    console.log('\n📍 Access URLs:');
    console.log(`   Dashboard: https://visibleshelf.com/t/${tenant.id}`);
    console.log(`   Storefront: https://visibleshelf.com/store/${tenant.id}`);
    console.log(`   Directory: https://visibleshelf.com/directory/demo-store`);
    console.log('\n💡 Next Steps:');
    console.log('   1. Upload platform logo to business profile');
    console.log('   2. Add high-quality product images');
    console.log('   3. Configure Google Business Profile integration');
    console.log('   4. Set up Google Merchant Center sync');
    console.log('   5. Customize storefront theme and branding');
    console.log('   6. Add this store to homepage as featured showcase');
    console.log('\n═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error creating showcase store:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createShowcaseStore()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
