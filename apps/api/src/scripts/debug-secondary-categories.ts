#!/usr/bin/env tsx

/**
 * Debug script to check the actual content of secondary_categories arrays
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugSecondaryCategories() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging secondary_categories array content...\n');
    
    // Check the actual secondary_categories data
    try {
      console.log('📊 Checking secondary_categories array content...');
      
      const secondaryQuery = `
        SELECT business_name, primary_category, secondary_categories
        FROM directory_category_listings 
        WHERE is_published = true
        LIMIT 3
      `;
      const result = await pool.query(secondaryQuery);
      
      if (result.rows.length > 0) {
        console.log('✅ Secondary categories data:');
        result.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. "${row.business_name}"`);
          console.log(`       Primary: ${row.primary_category}`);
          console.log(`       Secondary: ${JSON.stringify(row.secondary_categories)}`);
          console.log('');
        });
      } else {
        console.log('❌ No stores found');
      }
    } catch (error) {
      console.log('❌ Error checking secondary categories:', (error as Error).message || String(error));
    }
    
    // Check if any store has Books & Media in any category
    try {
      console.log('📊 Looking for any mention of Books & Media...');
      
      const booksQuery = `
        SELECT business_name, primary_category, secondary_categories
        FROM directory_category_listings 
        WHERE is_published = true 
        AND (
          primary_category ILIKE '%books%' 
          OR array_to_string(secondary_categories, ',') ILIKE '%books%'
        )
        LIMIT 5
      `;
      const booksResult = await pool.query(booksQuery);
      
      if (booksResult.rows.length > 0) {
        console.log('✅ Found stores with Books in categories:');
        booksResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. "${row.business_name}" - Primary: ${row.primary_category}`);
          console.log(`       Secondary: ${JSON.stringify(row.secondary_categories)}`);
        });
      } else {
        console.log('❌ No stores found with Books in any category');
      }
    } catch (error) {
      console.log('❌ Error searching for Books:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    logger.error('Fatal error during debug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugSecondaryCategories()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugSecondaryCategories };
