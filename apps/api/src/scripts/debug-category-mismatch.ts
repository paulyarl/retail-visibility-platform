#!/usr/bin/env tsx

/**
 * Debug script to check category name mismatches between APIs
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugCategoryMismatch() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging category name mismatches...\n');
    
    // Check what categories exist in directory_category_products
    try {
      console.log('📊 Checking categories in directory_category_products...');
      
      const categoriesQuery = `
        SELECT DISTINCT category_name, COUNT(*) as store_count
        FROM directory_category_products
        WHERE is_published = true AND directory_visible = true
        GROUP BY category_name
        ORDER BY store_count DESC
      `;
      const categoriesResult = await pool.query(categoriesQuery);
      
      if (categoriesResult.rows.length > 0) {
        console.log('✅ Categories found in directory_category_products:');
        categoriesResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. "${row.category_name}": ${row.store_count} stores`);
        });
      } else {
        console.log('❌ No categories found in directory_category_products');
      }
    } catch (error) {
      console.log('❌ Error checking categories:', (error as Error).message || String(error));
    }
    
    // Check Books & Media specifically
    try {
      console.log('\n📊 Checking "Books & Media" category specifically...');
      
      const booksMediaQuery = `
        SELECT 
          tenant_id,
          tenant_name,
          category_name,
          is_published,
          directory_visible
        FROM directory_category_products
        WHERE category_name = 'Books & Media'
        ORDER BY tenant_name
      `;
      const booksMediaResult = await pool.query(booksMediaQuery);
      
      if (booksMediaResult.rows.length > 0) {
        console.log('✅ Found stores in "Books & Media":');
        booksMediaResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.tenant_name} (${row.tenant_id})`);
          console.log(`       Published: ${row.is_published}, Visible: ${row.directory_visible}`);
        });
      } else {
        console.log('❌ No stores found in "Books & Media" category');
      }
    } catch (error) {
      console.log('❌ Error checking Books & Media:', (error as Error).message || String(error));
    }
    
    // Check what the search API is looking for
    try {
      console.log('\n📊 Checking what search API filters by...');
      
      const searchDebugQuery = `
        SELECT 
          dcp.tenant_id,
          dcp.tenant_name,
          dcp.category_name,
          dcp.is_published,
          dcp.directory_visible
        FROM directory_category_products dcp
        WHERE dcp.category_name = $1
          AND dcp.is_published = true 
          AND dcp.directory_visible = true
        ORDER BY dcp.tenant_name
      `;
      const searchDebugResult = await pool.query(searchDebugQuery, ['Books & Media']);
      
      if (searchDebugResult.rows.length > 0) {
        console.log('✅ Search API would find:');
        searchDebugResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.tenant_name} (${row.tenant_id})`);
        });
      } else {
        console.log('❌ Search API would find no stores for "Books & Media"');
      }
    } catch (error) {
      console.log('❌ Error checking search logic:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    logger.error('Fatal error during debug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugCategoryMismatch()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugCategoryMismatch };
