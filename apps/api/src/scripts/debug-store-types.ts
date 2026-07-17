#!/usr/bin/env tsx

/**
 * Debug script to check store type materialized views and data
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugStoreTypes() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging store type data...\n');
    
    // Check directory_store_type_stats view
    try {
      console.log('📊 Checking directory_store_type_stats...');
      
      const statsQuery = 'SELECT * FROM directory_store_type_stats LIMIT 5';
      const statsResult = await pool.query(statsQuery);
      
      if (statsResult.rows.length > 0) {
        console.log('✅ directory_store_type_stats has data:');
        console.log('  Columns:', Object.keys(statsResult.rows[0]));
        statsResult.rows.forEach((row, i) => {
          console.log(`    Row ${i + 1}:`, row);
        });
      } else {
        console.log('❌ directory_store_type_stats is empty');
      }
    } catch (error) {
      console.log('❌ Error checking directory_store_type_stats:', (error as Error).message || String(error));
    }
    
    // Check directory_gbp_listings view
    try {
      console.log('\n📊 Checking directory_gbp_listings...');
      
      const gbpQuery = 'SELECT * FROM directory_gbp_listings LIMIT 3';
      const gbpResult = await pool.query(gbpQuery);
      
      if (gbpResult.rows.length > 0) {
        console.log('✅ directory_gbp_listings has data:');
        console.log('  Columns:', Object.keys(gbpResult.rows[0]));
        gbpResult.rows.forEach((row, i) => {
          console.log(`    Row ${i + 1}:`, row);
        });
      } else {
        console.log('❌ directory_gbp_listings is empty');
      }
    } catch (error) {
      console.log('❌ Error checking directory_gbp_listings:', (error as Error).message || String(error));
    }
    
    // Check what GBP categories actually exist in directory_category_products
    try {
      console.log('\n📊 Checking GBP categories in directory_category_products...');
      
      const gbpCategoriesQuery = `
        SELECT DISTINCT 
          google_category_id,
          category_name,
          COUNT(DISTINCT tenant_id) as store_count
        FROM directory_category_products 
        WHERE google_category_id LIKE 'gcid:%'
        GROUP BY google_category_id, category_name
        ORDER BY store_count DESC
      `;
      
      const gbpCategoriesResult = await pool.query(gbpCategoriesQuery);
      
      if (gbpCategoriesResult.rows.length > 0) {
        console.log('✅ Found GBP categories:');
        gbpCategoriesResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.category_name} (${row.google_category_id}): ${row.store_count} stores`);
        });
      } else {
        console.log('❌ No GBP categories found');
      }
    } catch (error) {
      console.log('❌ Error checking GBP categories:', (error as Error).message || String(error));
    }
    
    // Check what's in the actual directory listing
    try {
      console.log('\n📊 Checking directory_listings_list for store types...');
      
      const listingQuery = `
        SELECT DISTINCT 
          primary_category,
          COUNT(*) as store_count
        FROM directory_listings_list 
        WHERE is_published = true
        GROUP BY primary_category
        ORDER BY store_count DESC
      `;
      
      const listingResult = await pool.query(listingQuery);
      
      if (listingResult.rows.length > 0) {
        console.log('✅ Found primary categories:');
        listingResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.primary_category}: ${row.store_count} stores`);
        });
      } else {
        console.log('❌ No primary categories found');
      }
    } catch (error) {
      console.log('❌ Error checking primary categories:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    logger.error('Fatal error during debug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugStoreTypes()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugStoreTypes };
