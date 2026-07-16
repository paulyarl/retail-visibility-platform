#!/usr/bin/env tsx

/**
 * Debug script to check item_status and visibility values in inventory_items
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugItemStatus() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging item_status and visibility values...\n');
    
    // Check distinct values in inventory_items
    try {
      console.log('📊 Checking distinct item_status values...');
      
      const statusQuery = `
        SELECT DISTINCT item_status, COUNT(*) as count
        FROM inventory_items
        WHERE tenant_id IN ('t-rerko4xw', 't-zjd1o7sm')
        GROUP BY item_status
        ORDER BY count DESC
      `;
      const statusResult = await pool.query(statusQuery);
      
      if (statusResult.rows.length > 0) {
        console.log('✅ item_status values:');
        statusResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.item_status}: ${row.count} items`);
        });
      } else {
        console.log('❌ No item_status data found');
      }
    } catch (error) {
      console.log('❌ Error checking item_status:', (error as Error).message || String(error));
    }
    
    // Check distinct visibility values
    try {
      console.log('\n📊 Checking distinct visibility values...');
      
      const visibilityQuery = `
        SELECT DISTINCT visibility, COUNT(*) as count
        FROM inventory_items
        WHERE tenant_id IN ('t-rerko4xw', 't-zjd1o7sm')
        GROUP BY visibility
        ORDER BY count DESC
      `;
      const visibilityResult = await pool.query(visibilityQuery);
      
      if (visibilityResult.rows.length > 0) {
        console.log('✅ visibility values:');
        visibilityResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.visibility}: ${row.count} items`);
        });
      } else {
        console.log('❌ No visibility data found');
      }
    } catch (error) {
      console.log('❌ Error checking visibility:', (error as Error).message || String(error));
    }
    
    // Check what would be counted by the view vs actual counts
    try {
      console.log('\n📊 Comparing view filter vs actual counts...');
      
      const comparisonQuery = `
        SELECT 
          tenant_id,
          COUNT(*) as total_items,
          COUNT(*) FILTER (WHERE item_status = 'active') as active_items,
          COUNT(*) FILTER (WHERE visibility = 'public') as public_items,
          COUNT(*) FILTER (WHERE item_status = 'active' AND visibility = 'public') as view_items
        FROM inventory_items
        WHERE tenant_id IN ('t-rerko4xw', 't-zjd1o7sm')
        GROUP BY tenant_id
        ORDER BY total_items DESC
      `;
      const comparisonResult = await pool.query(comparisonQuery);
      
      if (comparisonResult.rows.length > 0) {
        console.log('✅ Comparison by tenant:');
        comparisonResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. Tenant ${row.tenant_id}:`);
          console.log(`       Total items: ${row.total_items}`);
          console.log(`       Active items: ${row.active_items}`);
          console.log(`       Public items: ${row.public_items}`);
          console.log(`       View items (active + public): ${row.view_items}`);
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
  debugItemStatus()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugItemStatus };
