const { PrismaClient } = require('@prisma/client');
const { nanoid } = require('nanoid');

const db = new PrismaClient();

async function seedDigitalDownloads() {
  console.log('🌱 Seeding digital downloads test data...');
  
  try {
    // Get the tenant
    const tenant = await db.tenants.findFirst({
      where: { id: 'tid-r6cccpag' }
    });
    
    if (!tenant) {
      console.error('❌ Tenant tid-r6cccpag not found');
      return;
    }
    
    console.log(`✅ Found tenant: ${tenant.name}`);
    
    // Create a digital item
    const digitalItem = await db.inventory_items.upsert({
      where: { id: 'pid-test-digital-001' },
      update: {},
      create: {
        id: 'pid-test-digital-001',
        tenant_id: 'tid-r6cccpag',
        sku: 'DIGITAL-001-TEST',
        name: 'Test Digital Product',
        title: 'Test Digital Product',
        description: 'A test digital product for download pages',
        price: 9.99,
        price_cents: 999,
        currency: 'USD',
        stock: 9999,
        availability: 'in_stock',
        product_type: 'digital',
        digital_delivery_method: 'direct_download',
        item_status: 'active',
        visibility: 'public',
        brand: 'Test Brand',
        source: 'MANUAL',
        enrichment_status: 'COMPLETE',
        missing_images: false,
        missing_description: false,
        missing_specs: false,
        missing_brand: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    console.log(`✅ Created digital item: ${digitalItem.name}`);
    
    // Create a download page
    const downloadPage = await db.digital_download_pages.upsert({
      where: { id: 'ddp-test-001' },
      update: {},
      create: {
        id: 'ddp-test-001',
        tenant_id: 'tid-r6cccpag',
        item_id: 'pid-test-digital-001',
        slug: 'test-digital-product-download',
        title: 'Download Page for Test Digital Product',
        description: 'Thank you for purchasing our test digital product!',
        page_type: 'standard',
        instructions: 'Click the download button below to get your files.',
        thank_you_message: 'Enjoy your digital purchase!',
        support_email: 'support@test.com',
        require_authentication: true,
        require_purchase_verification: true,
        access_expires: false,
        allow_multiple_downloads: true,
        download_tracking: true,
        status: 'draft',
        brand_color: '#3B82F6',
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    console.log(`✅ Created download page: ${downloadPage.title}`);
    
    // Create a digital asset for the page
    const digitalAsset = await db.digital_downloads.upsert({
      where: { id: 'da-test-001' },
      update: {},
      create: {
        id: 'da-test-001',
        tenant_id: 'tid-r6cccpag',
        download_page_id: 'ddp-test-001',
        item_id: 'pid-test-digital-001',
        variant_id: null, // No variant for this asset
        asset_name: 'Test eBook.pdf',
        asset_type: 'file',
        file_size: 1048576, // 1MB
        file_mime_type: 'application/pdf',
        download_method: 'direct',
        requires_license_key: false,
        is_primary: true,
        display_order: 1,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    console.log(`✅ Created digital asset: ${digitalAsset.asset_name}`);
    
    // Create another digital item without a download page
    const digitalItem2 = await db.inventory_items.upsert({
      where: { id: 'pid-test-digital-002' },
      update: {},
      create: {
        id: 'pid-test-digital-002',
        tenant_id: 'tid-r6cccpag',
        sku: 'DIGITAL-002-TEST',
        name: 'Another Digital Product',
        title: 'Another Digital Product',
        description: 'Another test digital product without a download page yet',
        price: 19.99,
        price_cents: 1999,
        currency: 'USD',
        stock: 9999,
        availability: 'in_stock',
        product_type: 'digital',
        digital_delivery_method: 'direct_download',
        item_status: 'active',
        visibility: 'public',
        brand: 'Test Brand',
        source: 'MANUAL',
        enrichment_status: 'COMPLETE',
        missing_images: false,
        missing_description: false,
        missing_specs: false,
        missing_brand: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    console.log(`✅ Created second digital item: ${digitalItem2.name}`);
    
    console.log('\n✅ Digital downloads test data seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Digital Items: 2`);
    console.log(`   - Download Pages: 1`);
    console.log(`   - Digital Assets: 1`);
    
  } catch (error) {
    console.error('❌ Error seeding digital downloads:', error);
  } finally {
    await db.$disconnect();
  }
}

seedDigitalDownloads();
