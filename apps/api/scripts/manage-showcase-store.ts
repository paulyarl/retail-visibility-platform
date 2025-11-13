/**
 * Platform Showcase Store Manager
 * 
 * Utilities for managing the platform showcase store:
 * - View store info
 * - Update branding
 * - Refresh products
 * - Reset store
 * 
 * Run with: npx tsx scripts/manage-showcase-store.ts [command]
 * 
 * Commands:
 *   info       - Display showcase store information
 *   refresh    - Refresh product catalog
 *   reset      - Delete and recreate store
 *   update     - Update business profile/branding
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SHOWCASE_STORE_NAME = 'Visible Shelf Demo Store';

async function getShowcaseStore() {
  const tenant = await prisma.tenant.findFirst({
    where: { name: SHOWCASE_STORE_NAME },
    include: {
      businessProfile: true,
      items: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          items: true,
          photos: true,
        },
      },
    },
  });

  if (!tenant) {
    throw new Error('Showcase store not found. Run create-platform-showcase-store.ts first.');
  }

  return tenant;
}

async function showInfo() {
  console.log('📊 Showcase Store Information\n');
  
  const store = await getShowcaseStore();
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('🏪 Store Details');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`ID: ${store.id}`);
  console.log(`Name: ${store.name}`);
  console.log(`Tier: ${store.subscriptionTier}`);
  console.log(`Status: ${store.subscriptionStatus}`);
  console.log(`Created: ${store.createdAt.toLocaleDateString()}`);
  console.log(`Products: ${store._count.items}`);
  console.log(`Photos: ${store._count.photos}`);
  
  if (store.businessProfile) {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🏢 Business Profile');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Business Name: ${store.businessProfile.businessName}`);
    console.log(`Address: ${store.businessProfile.addressLine1}, ${store.businessProfile.city}, ${store.businessProfile.state}`);
    console.log(`Phone: ${store.businessProfile.phoneNumber}`);
    console.log(`Email: ${store.businessProfile.email}`);
    console.log(`Website: ${store.businessProfile.website}`);
    console.log(`Logo: ${store.businessProfile.logoUrl || 'Not set'}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📦 Recent Products');
  console.log('═══════════════════════════════════════════════════════');
  store.items.forEach((item, i) => {
    console.log(`${i + 1}. ${item.name} - $${(item.priceCents / 100).toFixed(2)}`);
  });
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔗 Access URLs');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Dashboard: https://visibleshelf.com/t/${store.id}`);
  console.log(`Storefront: https://visibleshelf.com/store/${store.id}`);
  console.log(`Directory: https://visibleshelf.com/directory/demo-store`);
  console.log('\n');
}

async function refreshProducts() {
  console.log('🔄 Refreshing Product Catalog...\n');
  
  const store = await getShowcaseStore();
  
  // Delete existing products
  console.log('🗑️  Removing old products...');
  const deleted = await prisma.inventoryItem.deleteMany({
    where: { tenantId: store.id },
  });
  console.log(`✅ Deleted ${deleted.count} products\n`);
  
  // Recreate products
  console.log('➕ Adding fresh products...');
  const { generateQuickStartProducts } = require('../src/lib/quick-start');
  
  const scenarios = [
    { scenario: 'grocery', count: 30 },
    { scenario: 'fashion', count: 20 },
    { scenario: 'electronics', count: 15 },
    { scenario: 'home', count: 15 },
    { scenario: 'sports', count: 10 },
    { scenario: 'beauty', count: 10 },
  ];
  
  let totalProducts = 0;
  for (const { scenario, count } of scenarios) {
    console.log(`   Adding ${count} ${scenario} products...`);
    const result = await generateQuickStartProducts(store.id, scenario, count);
    totalProducts += result.productsCreated;
  }
  
  console.log(`\n✅ Product catalog refreshed: ${totalProducts} products\n`);
}

async function updateBranding(logoUrl?: string, websiteUrl?: string) {
  console.log('🎨 Updating Branding...\n');
  
  const store = await getShowcaseStore();
  
  if (!store.businessProfile) {
    console.error('❌ Business profile not found');
    return;
  }
  
  const updates: any = {};
  if (logoUrl) updates.logoUrl = logoUrl;
  if (websiteUrl) updates.website = websiteUrl;
  
  await prisma.tenantBusinessProfile.update({
    where: { tenantId: store.id },
    data: updates,
  });
  
  console.log('✅ Branding updated');
  if (logoUrl) console.log(`   Logo: ${logoUrl}`);
  if (websiteUrl) console.log(`   Website: ${websiteUrl}`);
  console.log('\n');
}

async function resetStore() {
  console.log('⚠️  Resetting Showcase Store...\n');
  console.log('This will delete the entire store and recreate it.\n');
  
  const store = await getShowcaseStore();
  
  console.log('🗑️  Deleting store...');
  await prisma.tenant.delete({
    where: { id: store.id },
  });
  console.log('✅ Store deleted\n');
  
  console.log('🔄 Recreating store...');
  console.log('Run: npx tsx scripts/create-platform-showcase-store.ts\n');
}

async function main() {
  const command = process.argv[2] || 'info';
  
  try {
    switch (command) {
      case 'info':
        await showInfo();
        break;
      
      case 'refresh':
        await refreshProducts();
        await showInfo();
        break;
      
      case 'update':
        const logoUrl = process.argv[3];
        const websiteUrl = process.argv[4];
        await updateBranding(logoUrl, websiteUrl);
        await showInfo();
        break;
      
      case 'reset':
        await resetStore();
        break;
      
      default:
        console.log('❌ Unknown command:', command);
        console.log('\nAvailable commands:');
        console.log('  info       - Display showcase store information');
        console.log('  refresh    - Refresh product catalog');
        console.log('  update     - Update branding (usage: update [logoUrl] [websiteUrl])');
        console.log('  reset      - Delete and recreate store');
        console.log('\n');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
