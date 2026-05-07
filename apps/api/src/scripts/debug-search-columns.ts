#!/usr/bin/env tsx

/**
 * Debug script to check columns in directory views used for search
 */

import { getDirectPool } from '../utils/db-pool';

async function debugSearchColumns() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging search view columns...\n');
    
    // Check directory_category_listings columns
    try {
      console.log('📊 Checking directory_category_listings...');
      
      const categoryQuery = 'SELECT * FROM directory_category_listings LIMIT 1';
      const categoryResult = await pool.query(categoryQuery);
      
      if (categoryResult.rows.length > 0) {
        console.log('✅ directory_category_listings columns:', Object.keys(categoryResult.rows[0]));
      } else {
        console.log('❌ directory_category_listings is empty');
      }
    } catch (error) {
      console.log('❌ Error checking directory_category_listings:', (error as Error).message || String(error));
    }
    
    // Check directory_gbp_listings columns
    try {
      console.log('\n📊 Checking directory_gbp_listings...');
      
      const gbpQuery = 'SELECT * FROM directory_gbp_listings LIMIT 1';
      const gbpResult = await pool.query(gbpQuery);
      
      if (gbpResult.rows.length > 0) {
        console.log('✅ directory_gbp_listings columns:', Object.keys(gbpResult.rows[0]));
      } else {
        console.log('❌ directory_gbp_listings is empty');
      }
    } catch (error) {
      console.log('❌ Error checking directory_gbp_listings:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    console.error('Fatal error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugSearchColumns()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

export { debugSearchColumns };
