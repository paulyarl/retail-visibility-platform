#!/usr/bin/env tsx

/**
 * Debug script to check what category names actually exist in directory views
 */

import { getDirectPool } from '../utils/db-pool';

async function debugCategoryNames() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging category names in directory views...\n');
    
    // Check directory_category_listings category names
    try {
      console.log('📊 Checking primary_category in directory_category_listings...');
      
      const categoryQuery = `
        SELECT DISTINCT primary_category, COUNT(*) as count
        FROM directory_category_listings 
        WHERE is_published = true
        GROUP BY primary_category
        ORDER BY count DESC
      `;
      const categoryResult = await pool.query(categoryQuery);
      
      if (categoryResult.rows.length > 0) {
        console.log('✅ Primary categories found:');
        categoryResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. "${row.primary_category}": ${row.count} stores`);
        });
      } else {
        console.log('❌ No primary categories found');
      }
    } catch (error) {
      console.log('❌ Error checking primary categories:', (error as Error).message || String(error));
    }
    
    // Check directory_gbp_listings category names
    try {
      console.log('\n📊 Checking primary_category in directory_gbp_listings...');
      
      const gbpQuery = `
        SELECT DISTINCT primary_category, COUNT(*) as count
        FROM directory_gbp_listings 
        WHERE is_published = true
        GROUP BY primary_category
        ORDER BY count DESC
      `;
      const gbpResult = await pool.query(gbpQuery);
      
      if (gbpResult.rows.length > 0) {
        console.log('✅ GBP primary categories found:');
        gbpResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. "${row.primary_category}": ${row.count} stores`);
        });
      } else {
        console.log('❌ No GBP primary categories found');
      }
    } catch (error) {
      console.log('❌ Error checking GBP primary categories:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    console.error('Fatal error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugCategoryNames()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

export { debugCategoryNames };
