#!/usr/bin/env tsx

/**
 * Script to refresh materialized views and check their status
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function refreshMaterializedViews() {
  const pool = getDirectPool();
  
  try {
    console.log('🔄 Refreshing materialized views...\n');
    
    // List of materialized views to refresh
    const viewsToRefresh = [
      'directory_category_stats',
      'directory_category_products',
      'directory_category_listings'
    ];
    
    for (const viewName of viewsToRefresh) {
      try {
        console.log(`📋 Refreshing ${viewName}...`);
        
        // Try to refresh the view
        const refreshQuery = `REFRESH MATERIALIZED VIEW ${viewName}`;
        await pool.query(refreshQuery);
        console.log(`✅ ${viewName} refreshed successfully`);
        
        // Check if it's now accessible
        const checkQuery = `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = '${viewName}'
          ORDER BY ordinal_position
        `;
        
        const checkResult = await pool.query(checkQuery);
        
        if (checkResult.rows.length > 0) {
          console.log(`📊 ${viewName} columns:`);
          checkResult.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
          });
          
          // Get sample data
          const sampleQuery = `SELECT * FROM ${viewName} LIMIT 2`;
          const sampleResult = await pool.query(sampleQuery);
          
          if (sampleResult.rows.length > 0) {
            console.log(`📄 Sample data from ${viewName}:`);
            sampleResult.rows.forEach((row, i) => {
              console.log(`    Row ${i + 1}:`, Object.keys(row).join(', '));
            });
          } else {
            console.log(`📄 ${viewName} has no data`);
          }
        } else {
          console.log(`❌ ${viewName} still not accessible after refresh`);
        }
        
      } catch (error) {
        console.log(`❌ Error refreshing ${viewName}:`, (error as Error).message || String(error));
        
        // Try concurrent refresh if regular refresh fails
        try {
          console.log(`🔄 Trying concurrent refresh for ${viewName}...`);
          const concurrentRefreshQuery = `REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`;
          await pool.query(concurrentRefreshQuery);
          console.log(`✅ ${viewName} refreshed concurrently`);
        } catch (concurrentError) {
          console.log(`❌ Concurrent refresh also failed for ${viewName}:`, (concurrentError as Error).message || String(concurrentError));
        }
      }
      
      console.log(''); // Add spacing
    }
    
  } catch (error) {
    logger.error('Fatal error during refresh:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
      logger.error('❌ Refresh failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { refreshMaterializedViews };
