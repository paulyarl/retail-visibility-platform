#!/usr/bin/env tsx

/**
 * Debug script to check directory listing data and category structure
 */

import { getDirectPool } from '../utils/db-pool';

async function debugDirectoryListing() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging directory listing data...\n');
    
    // Check a specific tenant's directory listing
    const tenantId = 't-zjd1o7sm'; // Indy Grocery from earlier
    
    console.log(`📋 Checking directory listing for tenant: ${tenantId}`);
    
    // Check directory_listings_list structure
    try {
      const listingsQuery = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'directory_listings_list'
        ORDER BY ordinal_position
      `;
      
      const listingsResult = await pool.query(listingsQuery);
      
      console.log('📊 directory_listings_list columns:');
      listingsResult.rows
        .filter(row => row.column_name.toLowerCase().includes('category') || 
                     row.column_name.toLowerCase().includes('type'))
        .forEach(row => {
          console.log(`  - ${row.column_name}: ${row.data_type}`);
        });
      
      // Get the actual listing data
      const listingQuery = `
        SELECT * FROM directory_listings_list 
        WHERE tenant_id = $1
      `;
      
      const listingResult = await pool.query(listingQuery, [tenantId]);
      
      if (listingResult.rows.length > 0) {
        const listing = listingResult.rows[0];
        console.log('\n📄 Directory listing data:');
        console.log('  All columns:', Object.keys(listing).join(', '));
        
        // Show category-related fields
        console.log('\n🏷️ Category-related fields:');
        Object.keys(listing)
          .filter(key => key.toLowerCase().includes('category') || key.toLowerCase().includes('type'))
          .forEach(key => {
            console.log(`  ${key}: ${listing[key]}`);
          });
        
        // Show business name and other key fields
        console.log('\n🏪 Key listing fields:');
        console.log(`  business_name: ${listing.business_name}`);
        console.log(`  primary_category: ${listing.primary_category}`);
        console.log(`  store_type: ${listing.store_type}`);
        console.log(`  is_published: ${listing.is_published}`);
        console.log(`  directory_visible: ${listing.directory_visible}`);
        
      } else {
        console.log('❌ No directory listing found for this tenant');
      }
      
    } catch (error) {
      console.log('❌ Error checking directory listings:', (error as Error).message || String(error));
    }
    
    console.log('\n🔍 Checking platform_categories for missing data...');
    
    // Check if platform_categories has all expected categories
    try {
      const categoriesQuery = `
        SELECT COUNT(*) as total_count,
               COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
        FROM platform_categories
      `;
      
      const categoriesResult = await pool.query(categoriesQuery);
      const stats = categoriesResult.rows[0];
      
      console.log(`📊 Platform categories: ${stats.active_count}/${stats.total_count} active`);
      
      // Show some sample categories
      const sampleQuery = `
        SELECT name, slug, is_active, sort_order 
        FROM platform_categories 
        WHERE is_active = true 
        ORDER BY sort_order ASC 
        LIMIT 10
      `;
      
      const sampleResult = await pool.query(sampleQuery);
      
      console.log('\n📄 Sample active categories:');
      sampleResult.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.name} (${row.slug}) - Order: ${row.sort_order}`);
      });
      
    } catch (error) {
      console.log('❌ Error checking platform_categories:', (error as Error).message || String(error));
    }
    
    console.log('\n🔍 Checking store types...');
    
    // Check store types
    try {
      const storeTypesQuery = `
        SELECT DISTINCT store_type 
        FROM directory_listings_list 
        WHERE store_type IS NOT NULL 
        AND is_published = true
        ORDER BY store_type
      `;
      
      const storeTypesResult = await pool.query(storeTypesQuery);
      
      console.log('📊 Available store types:');
      storeTypesResult.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.store_type}`);
      });
      
    } catch (error) {
      console.log('❌ Error checking store types:', (error as Error).message || String(error));
    }
    
    console.log('\n🔍 Checking the API endpoint that serves directory listings...');
    
    // Test the directory listings API endpoint
    try {
      const apiQuery = `
        SELECT 
          tenant_id,
          business_name,
          primary_category,
          store_type,
          city,
          state,
          is_published,
          directory_visible
        FROM directory_listings_list 
        WHERE is_published = true 
        AND directory_visible = true
        ORDER BY business_name
        LIMIT 5
      `;
      
      const apiResult = await pool.query(apiQuery);
      
      console.log('📄 Sample directory listings (API view):');
      apiResult.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.business_name} - ${row.primary_category} / ${row.store_type}`);
      });
      
    } catch (error) {
      console.log('❌ Error checking API view:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    console.error('Fatal error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugDirectoryListing()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

export { debugDirectoryListing };
