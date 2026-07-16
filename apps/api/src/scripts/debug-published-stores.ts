#!/usr/bin/env tsx

/**
 * Debug script to check if there are any published stores in directory views
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugPublishedStores() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging published stores in directory views...\n');
    
    // Check directory_category_listings total published stores
    try {
      console.log('📊 Checking total published stores in directory_category_listings...');
      
      const categoryQuery = `
        SELECT COUNT(*) as total_stores
        FROM directory_category_listings 
        WHERE is_published = true
      `;
      const categoryResult = await pool.query(categoryQuery);
      
      console.log(`✅ Total published stores: ${categoryResult.rows[0].total_stores}`);
      
      // Show sample data
      const sampleQuery = `
        SELECT business_name, primary_category, is_published, city, state
        FROM directory_category_listings 
        LIMIT 3
      `;
      const sampleResult = await pool.query(sampleQuery);
      
      if (sampleResult.rows.length > 0) {
        console.log('Sample stores:');
        sampleResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. "${row.business_name}" - ${row.primary_category} (${row.city}, ${row.state}) - Published: ${row.is_published}`);
        });
      }
    } catch (error) {
      console.log('❌ Error checking directory_category_listings:', (error as Error).message || String(error));
    }
    
    // Check directory_gbp_listings total published stores
    try {
      console.log('\n📊 Checking total published stores in directory_gbp_listings...');
      
      const gbpQuery = `
        SELECT COUNT(*) as total_stores
        FROM directory_gbp_listings 
        WHERE is_published = true
      `;
      const gbpResult = await pool.query(gbpQuery);
      
      console.log(`✅ Total published GBP stores: ${gbpResult.rows[0].total_stores}`);
      
      // Show sample data
      const sampleQuery = `
        SELECT business_name, primary_category, is_published, city, state
        FROM directory_gbp_listings 
        LIMIT 3
      `;
      const sampleResult = await pool.query(sampleQuery);
      
      if (sampleResult.rows.length > 0) {
        console.log('Sample GBP stores:');
        sampleResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. "${row.business_name}" - ${row.primary_category} (${row.city}, ${row.state}) - Published: ${row.is_published}`);
        });
      }
    } catch (error) {
      console.log('❌ Error checking directory_gbp_listings:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    logger.error('Fatal error during debug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugPublishedStores()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugPublishedStores };
