#!/usr/bin/env tsx

/**
 * Script to refresh materialized views to fix stale data
 */

import { getDirectPool } from '../utils/db-pool';

async function refreshMaterializedViews() {
  const pool = getDirectPool();
  
  try {
    console.log('🔄 Refreshing materialized views...\n');
    
    // Refresh directory_category_products to fix product counts
    try {
      console.log('📊 Refreshing directory_category_products...');
      
      await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_products');
      console.log('✅ directory_category_products refreshed successfully');
    } catch (error) {
      console.log('❌ Error refreshing directory_category_products:', (error as Error).message || String(error));
      
      // Try without CONCURRENTLY if that fails
      try {
        console.log('🔄 Trying refresh without CONCURRENTLY...');
        await pool.query('REFRESH MATERIALIZED VIEW directory_category_products');
        console.log('✅ directory_category_products refreshed successfully (without CONCURRENTLY)');
      } catch (error2) {
        console.log('❌ Still failed:', (error2 as Error).message || String(error2));
      }
    }
    
    // Also refresh other directory views for consistency
    const viewsToRefresh = [
      'directory_category_listings',
      'directory_category_stats',
      'directory_gbp_listings'
    ];
    
    for (const viewName of viewsToRefresh) {
      try {
        console.log(`📊 Refreshing ${viewName}...`);
        await pool.query(`REFRESH MATERIALIZED VIEW ${viewName}`);
        console.log(`✅ ${viewName} refreshed successfully`);
      } catch (error) {
        console.log(`❌ Error refreshing ${viewName}:`, (error as Error).message || String(error));
      }
    }
    
  } catch (error) {
    console.error('Fatal error during refresh:', error);
  } finally {
    await pool.end();
  }
}

// Run the refresh
if (require.main === module) {
  refreshMaterializedViews()
    .then(() => {
      console.log('\n✅ Refresh completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Refresh failed:', error);
      process.exit(1);
    });
}

export { refreshMaterializedViews };
