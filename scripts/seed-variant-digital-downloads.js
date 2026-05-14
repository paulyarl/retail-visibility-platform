const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function seedVariantDigitalDownloads() {
  console.log('🌱 Seeding variant-aware digital downloads test data...');

  try {
    // Find the tenant
    const tenant = await db.tenants.findFirst({
      where: { name: 'ATOBABS AFRICA INTERNATIONAL MARKET' }
    });

    if (!tenant) {
      console.error('❌ Tenant not found');
      return;
    }

    console.log(`✅ Found tenant: ${tenant.name}`);

    // Create a product with variants
    const productWithVariants = await db.inventory_items.upsert({
      where: { id: 'pid-digital-variants-001' },
      update: {},
      create: {
        id: 'pid-digital-variants-001',
        tenant_id: tenant.id,
        sku: 'DIGITAL-VARIANT-001',
        name: 'Digital Product with Variants',
        title: 'Digital Product with Variants',
        description: 'A digital product that has multiple variants',
        marketing_description: 'Test product for variant-specific downloads',
        price: 29.99,
        price_cents: 2999,
        stock: 100,
        availability: 'in_stock',
        image_url: 'https://example.com/product-image.jpg',
        brand: 'Test Brand',
        category_path: ['Digital Products'],
        condition: 'brand_new',
        currency: 'USD',
        item_status: 'active',
        visibility: 'public',
        manufacturer: 'Test Manufacturer',
        product_type: 'digital',
        digital_delivery_method: 'direct_download',
        has_variants: true,
        image_gallery: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        enrichment_status: 'COMPLETE',
        missing_images: false,
        missing_description: false,
        missing_specs: false,
        missing_brand: false,
        source: 'MANUAL',
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`✅ Created product with variants: ${productWithVariants.name}`);

    // Create variants
    const variant1 = await db.product_variants.upsert({
      where: { id: 'pvar-digital-001' },
      update: {},
      create: {
        id: 'pvar-digital-001',
        parent_item_id: productWithVariants.id,
        tenant_id: tenant.id,
        sku: 'DIGITAL-VARIANT-001-PDF',
        variant_name: 'PDF Version',
        price_cents: 2999,
        stock: 50,
        image_url: 'https://example.com/pdf-variant.jpg',
        attributes: {
          format: 'PDF',
          size: 'Standard',
          pages: 250
        },
        sort_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    const variant2 = await db.product_variants.upsert({
      where: { id: 'pvar-digital-002' },
      update: {},
      create: {
        id: 'pvar-digital-002',
        parent_item_id: productWithVariants.id,
        tenant_id: tenant.id,
        sku: 'DIGITAL-VARIANT-001-EPUB',
        variant_name: 'EPUB Version',
        price_cents: 3499,
        stock: 50,
        image_url: 'https://example.com/epub-variant.jpg',
        attributes: {
          format: 'EPUB',
          size: 'Standard',
          pages: 250,
          drm: 'No DRM'
        },
        sort_order: 2,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`✅ Created variants: ${variant1.variant_name} and ${variant2.variant_name}`);

    // Create a download page for the product
    const downloadPage = await db.digital_download_pages.upsert({
      where: { id: 'ddp-variant-test-001' },
      update: {},
      create: {
        id: 'ddp-variant-test-001',
        tenant_id: tenant.id,
        item_id: productWithVariants.id,
        slug: 'variant-digital-product-download',
        title: 'Download Page for Variant Digital Product',
        description: 'Thank you for purchasing our digital product with variants!',
        page_type: 'standard',
        custom_css: null,
        custom_js: null,
        logo_url: null,
        banner_url: null,
        brand_color: '#3B82F6',
        instructions: 'Click the download button below to get your files.',
        thank_you_message: 'Enjoy your digital purchase!',
        support_email: 'support@test.com',
        support_url: null,
        require_authentication: true,
        require_purchase_verification: true,
        access_expires: false,
        access_duration_days: null,
        allow_multiple_downloads: true,
        download_limit: null,
        download_tracking: true,
        custom_download_limit: null,
        custom_access_duration_days: null,
        seo_title: null,
        seo_description: null,
        status: 'published',
        published_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null
      }
    });

    console.log(`✅ Created download page: ${downloadPage.title}`);

    // Create variant-specific assets
    const pdfAsset = await db.digital_downloads.upsert({
      where: { id: 'da-pdf-variant-001' },
      update: {},
      create: {
        id: 'da-pdf-variant-001',
        tenant_id: tenant.id,
        download_page_id: downloadPage.id,
        item_id: productWithVariants.id,
        variant_id: variant1.id, // PDF variant
        asset_name: 'Product Guide - PDF Version.pdf',
        asset_type: 'file',
        file_size: 2097152, // 2MB
        file_mime_type: 'application/pdf',
        download_method: 'direct',
        requires_license_key: false,
        is_primary: true,
        display_order: 1,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    const epubAsset = await db.digital_downloads.upsert({
      where: { id: 'da-epub-variant-001' },
      update: {},
      create: {
        id: 'da-epub-variant-001',
        tenant_id: tenant.id,
        download_page_id: downloadPage.id,
        item_id: productWithVariants.id,
        variant_id: variant2.id, // EPUB variant
        asset_name: 'Product Guide - EPUB Version.epub',
        asset_type: 'file',
        file_size: 1048576, // 1MB
        file_mime_type: 'application/epub+zip',
        download_method: 'direct',
        requires_license_key: false,
        is_primary: true,
        display_order: 1,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    // Create a generic asset (no variant) for fallback
    const genericAsset = await db.digital_downloads.upsert({
      where: { id: 'da-generic-001' },
      update: {},
      create: {
        id: 'da-generic-001',
        tenant_id: tenant.id,
        download_page_id: downloadPage.id,
        item_id: productWithVariants.id,
        variant_id: null, // No variant - generic asset
        asset_name: 'Product Introduction - All Versions.txt',
        asset_type: 'file',
        file_size: 10240, // 10KB
        file_mime_type: 'text/plain',
        download_method: 'direct',
        requires_license_key: false,
        is_primary: false,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`✅ Created variant-specific assets:`);
    console.log(`   - PDF: ${pdfAsset.asset_name}`);
    console.log(`   - EPUB: ${epubAsset.asset_name}`);
    console.log(`   - Generic: ${genericAsset.asset_name}`);

    // Create a test customer if not exists
    let customer = await db.customers.findFirst({
      where: { email: 'test@example.com' }
    });

    if (!customer) {
      customer = await db.customers.create({
        data: {
          id: 'cust-test-variant-001',
          tenant_id: tenant.id,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'Customer',
          phone: '+1234567890',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      console.log(`✅ Created test customer: ${customer.email}`);
    }

    // Create a test order if not exists
    let order = await db.orders.findFirst({
      where: { customer_id: customer.id }
    });

    if (!order) {
      order = await db.orders.create({
        data: {
          id: 'ord-test-variant-001',
          tenant_id: tenant.id,
          customer_id: customer.id,
          order_number: 'TEST-VAR-001',
          status: 'delivered',
          currency: 'USD',
          subtotal_cents: variant1.price_cents,
          tax_cents: 0,
          shipping_cents: 0,
          total_cents: variant1.price_cents,
          order_date: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      console.log(`✅ Created test order: ${order.order_number}`);
    }

    if (order) {
        const orderItem = await db.order_items.upsert({
          where: { id: 'oi-variant-test-001' },
          update: {},
          create: {
            id: 'oi-variant-test-001',
            order_id: order.id,
            inventory_item_id: productWithVariants.id,
            sku: variant1.sku,
            name: productWithVariants.name,
            description: `Variant: ${variant1.variant_name}`,
            image_url: variant1.image_url,
            quantity: 1,
            unit_price_cents: variant1.price_cents,
            subtotal_cents: variant1.price_cents,
            tax_cents: 0,
            discount_cents: 0,
            total_cents: variant1.price_cents,
            quantity_fulfilled: 1,
            quantity_refunded: 0,
            is_refundable: true,
            metadata: {},
            notes: null,
            created_at: new Date(),
            updated_at: new Date(),
            list_price_cents: variant1.price_cents,
            product_type: 'digital',
            digital_delivery_status: 'pending',
            variant_id: variant1.id,
            variant_name: variant1.variant_name,
            variant_attributes: variant1.attributes
          }
        });

        console.log(`✅ Created order item with variant: ${variant1.variant_name}`);

        // Create digital access grant for the variant purchase
        const accessGrant = await db.digital_access_grants.upsert({
          where: { access_token: 'variant-test-token-001' },
          update: {},
          create: {
            id: 'dag-variant-test-001',
            order_id: order.id,
            order_item_id: orderItem.id,
            inventory_item_id: productWithVariants.id,
            customer_email: customer.email,
            access_token: 'variant-test-token-001',
            download_count: 0,
            max_downloads: 5,
            access_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            download_page_id: downloadPage.id,
            tenant_id: tenant.id,
            customer_id: customer.id,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        console.log(`✅ Created access grant with token: ${accessGrant.access_token}`);
    }

    console.log('\n✅ Variant-aware digital downloads test data seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Product with Variants: 1`);
    console.log(`   - Variants: 2 (PDF, EPUB)`);
    console.log(`   - Download Pages: 1`);
    console.log(`   - Digital Assets: 3 (2 variant-specific, 1 generic)`);
    console.log(`   - Access Grants: 1`);
    console.log('\n🧪 Test URLs:');
    console.log(`   - Download Page: http://localhost:3000/downloads/${tenant.id}/${downloadPage.slug}?token=variant-test-token-001`);
    console.log(`   - Should show: PDF asset + Generic asset (for PDF variant purchase)`);

  } catch (error) {
    console.error('❌ Error seeding variant digital downloads:', error);
  } finally {
    await db.$disconnect();
  }
}

seedVariantDigitalDownloads();
