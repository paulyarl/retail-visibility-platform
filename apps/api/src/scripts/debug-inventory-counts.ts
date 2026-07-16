#!/usr/bin/env tsx

/**
 * Debug script to check actual inventory counts
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugInventoryCounts() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging actual inventory counts...\n');
    
    // Check inventory_items table structure first
    try {
      console.log('📊 Checking inventory_items table structure...');
      
      const schemaQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_name = 'inventory_items'
        ORDER BY ordinal_position
        LIMIT 10
      `;
      const schemaResult = await pool.query(schemaQuery);
      
      if (schemaResult.rows.length > 0) {
        console.log('✅ inventory_items columns (first 10):');
        schemaResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.column_name}: ${row.data_type}`);
        });
      }
    } catch (error) {
      console.log('❌ Error checking schema:', (error as Error).message || String(error));
    }
    
    // Check actual product counts
    try {
      console.log('\n📊 Checking actual inventory counts...');
      
      const inventoryQuery = `
        SELECT 
          tenant_id,
          COUNT(*) as product_count
        FROM inventory_items
        WHERE tenant_id IN ('t-rerko4xw', 't-zjd1o7sm')
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
    
    // Check what's in directory_category_products vs actual inventory
    try {
      console.log('\n📊 Comparing directory_category_products vs inventory_items...');
      
      const comparisonQuery = `
        SELECT 
          dcp.tenant_id,
          dcp.tenant_name,
          dcp.actual_product_count as dcp_count,
          COALESCE(ii.actual_count, 0) as inventory_count
        FROM directory_category_products dcp
        LEFT JOIN (
          SELECT 
            tenant_id, 
            COUNT(*) as actual_count
          FROM inventory_items
          WHERE tenant_id IN ('t-rerko4xw', 't-zjd1o7sm')
          GROUP BY tenant_id
        ) ii ON dcp.tenant_id = ii.tenant_id
        WHERE dcp.category_name = 'Health & Beauty'
          AND dcp.tenant_id IN ('t-rerko4xw', 't-zjd1o7sm')
        ORDER BY dcp.tenant_id
      `;
      const comparisonResult = await pool.query(comparisonQuery);
      
      if (comparisonResult.rows.length > 0) {
        console.log('✅ Comparison:');
        comparisonResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.tenant_name} (${row.tenant_id})`);
          console.log(`       Directory view: ${row.dcp_count}`);
          console.log(`       Actual inventory: ${row.inventory_count}`);
          console.log(`       Difference: ${parseInt(row.dcp_count) - row.inventory_count}`);
        });
      } else {
        console.log('❌ No comparison data found');
      }
    } catch (error) {
      console.log('❌ Error checking comparison:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    logger.error('Fatal error during debug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugInventoryCounts()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugInventoryCounts };
