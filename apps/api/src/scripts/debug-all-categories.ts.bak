#!/usr/bin/env tsx

/**
 * Debug script to check all primary_category values in directory views
 */

import { getDirectPool } from '../utils/db-pool';

async function debugAllCategories() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging all primary_category values...\n');
    
    // Check all primary categories in both views
    try {
      console.log('📊 All primary categories in directory views...');
      
      const allCategoriesQuery = `
        SELECT DISTINCT primary_category, COUNT(*) as store_count, 'directory_category_listings' as source
        FROM directory_category_listings 
        WHERE is_published = true
        GROUP BY primary_category
        
        UNION ALL
        
        SELECT DISTINCT primary_category, COUNT(*) as store_count, 'directory_gbp_listings' as source
        FROM directory_gbp_listings 
        WHERE is_published = true
        GROUP BY primary_category
        ORDER BY store_count DESC, primary_category ASC
      `;
      const result = await pool.query(allCategoriesQuery);
      
      if (result.rows.length > 0) {
        console.log('✅ Primary categories found:');
        result.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. "${row.primary_category}": ${row.store_count} stores (${row.source})`);
        });
      } else {
        console.log('❌ No primary categories found');
      }
    } catch (error) {
      console.log('❌ Error checking primary categories:', (error as Error).message || String(error));
    }
    
    // Also check if there are any stores with Books & Media in secondary categories
    try {
      console.log('\n📊 Checking for Books & Media in secondary categories...');
      
      const secondaryQuery = `
        SELECT business_name, primary_category, secondary_categories
        FROM directory_category_listings 
        WHERE is_published = true 
        AND (secondary_categories LIKE '%Books & Media%' OR secondary_categories LIKE '%books-media%')
        LIMIT 5
      `;
      const secondaryResult = await pool.query(secondaryQuery);
      
      if (secondaryResult.rows.length > 0) {
        console.log('✅ Found stores with Books & Media in secondary categories:');
        secondaryResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. "${row.business_name}" - Primary: ${row.primary_category}, Secondary: ${row.secondary_categories}`);
        });
      } else {
        console.log('❌ No stores found with Books & Media in secondary categories');
      }
    } catch (error) {
      console.log('❌ Error checking secondary categories:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    console.error('Fatal error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugAllCategories()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

export { debugAllCategories };
