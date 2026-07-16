#!/usr/bin/env tsx

/**
 * Debug script to check actual product counts for Health & Beauty stores
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugProductCounts() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging product counts for Health & Beauty...\n');
    
    // Check all stores in Health & Beauty category
    try {
      console.log('📊 Checking product counts in directory_category_products...');
      
      const query = `
        SELECT 
          tenant_id,
          tenant_name,
          category_name,
          actual_product_count,
          is_published,
          directory_visible
        FROM directory_category_products
        WHERE category_name = 'Health & Beauty'
          AND is_published = true 
          AND directory_visible = true
        ORDER BY actual_product_count DESC
      `;
      const result = await pool.query(query);
      
      if (result.rows.length > 0) {
        console.log('✅ Found stores in Health & Beauty:');
        result.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.tenant_name} (${row.tenant_id})`);
          console.log(`       Products: ${row.actual_product_count}`);
          console.log(`       Published: ${row.is_published}, Visible: ${row.directory_visible}`);
        });
      } else {
        console.log('❌ No stores found in Health & Beauty');
      }
    } catch (error) {
      console.log('❌ Error checking product counts:', (error as Error).message || String(error));
    }
    
    // Check if there are other product counts in different tables
    try {
      console.log('\n📊 Checking inventory_items table for comparison...');
      
      const inventoryQuery = `
        SELECT 
          tenant_id,
          COUNT(*) as product_count
        FROM inventory_items
        WHERE tenant_id IN ('t-rerko4xw', 't-zjd1o7sm')
          AND is_active = true
        GROUP BY tenant_id
        ORDER BY product_count DESC
      `;
      const inventoryResult = await pool.query(inventoryQuery);
      
      if (inventoryResult.rows.length > 0) {
        console.log('✅ Actual inventory counts:');
        inventoryResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. Tenant ${row.tenant_id}: ${row.product_count} products`);
        });
      } else {
        console.log('❌ No inventory data found');
      }
    } catch (error) {
      console.log('❌ Error checking inventory:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    logger.error('Fatal error during debug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugProductCounts()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugProductCounts };
