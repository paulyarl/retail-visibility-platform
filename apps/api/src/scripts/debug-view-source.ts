#!/usr/bin/env tsx

/**
 * Debug script to check the source definition of directory_category_products view
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugViewSource() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging directory_category_products view source...\n');
    
    // Get the materialized view definition
    try {
      console.log('📊 Getting view definition...');
      
      const defQuery = `
        SELECT definition
        FROM pg_matviews
        WHERE matviewname = 'directory_category_products'
      `;
      const defResult = await pool.query(defQuery);
      
      if (defResult.rows.length > 0 && defResult.rows[0].definition) {
        console.log('✅ View definition:');
        console.log(defResult.rows[0].definition);
        
        // Look for how actual_product_count is calculated
        const definition = defResult.rows[0].definition;
        if (definition.includes('actual_product_count')) {
          console.log('\n🔍 Found actual_product_count in definition');
          
          // Extract the part around actual_product_count
          const lines = definition.split('\n');
          const productCountLines = lines.filter((line: string) => 
            line.includes('actual_product_count') || 
            line.includes('COUNT(') || 
            line.includes('inventory_items')
          );
          
          if (productCountLines.length > 0) {
            console.log('✅ Relevant lines for product count:');
            productCountLines.forEach((line: string, i: number) => {
              console.log(`    ${i + 1}. ${line.trim()}`);
            });
          }
        }
      } else {
        console.log('❌ No definition found');
      }
    } catch (error) {
      console.log('❌ Error getting view definition:', (error as Error).message || String(error));
    }
    
    // Check what categories each store actually has in inventory_items
    try {
      console.log('\n📊 Checking actual inventory data by store...');
      
      const inventoryQuery = `
        SELECT 
          ii.tenant_id,
          t.name as tenant_name,
          COUNT(*) as total_products,
          COUNT(DISTINCT ii.metadata->>'category') as unique_categories
        FROM inventory_items ii
        LEFT JOIN tenants t ON ii.tenant_id = t.id
        WHERE ii.tenant_id IN ('t-rerko4xw', 't-zjd1o7sm')
        GROUP BY ii.tenant_id, t.name
        ORDER BY total_products DESC
      `;
      const inventoryResult = await pool.query(inventoryQuery);
      
      if (inventoryResult.rows.length > 0) {
        console.log('✅ Actual inventory by store:');
        inventoryResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.tenant_name} (${row.tenant_id})`);
          console.log(`       Total products: ${row.total_products}`);
          console.log(`       Unique categories: ${row.unique_categories}`);
        });
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
  debugViewSource()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugViewSource };
