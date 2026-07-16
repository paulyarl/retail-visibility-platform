#!/usr/bin/env tsx

/**
 * Debug script to check what directory tables exist
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugDirectoryTables() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Finding directory-related tables...\n');
    
    // Find all tables with 'directory' in the name
    try {
      console.log('📊 Searching for directory tables...');
      
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name ILIKE '%directory%'
        ORDER BY table_name
      `;
      const tablesResult = await pool.query(tablesQuery);
      
      if (tablesResult.rows.length > 0) {
        console.log('✅ Found directory-related tables:');
        tablesResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.table_name}`);
        });
        
        // Check if directory_gbp_stats exists
        const hasGbpStats = tablesResult.rows.some(row => row.table_name === 'directory_gbp_stats');
        console.log(`\n📊 directory_gbp_stats exists: ${hasGbpStats ? '✅ YES' : '❌ NO'}`);
        
        // Check what views exist
        const viewsQuery = `
          SELECT table_name 
          FROM information_schema.views 
          WHERE table_schema = 'public' 
          AND table_name ILIKE '%directory%'
          ORDER BY table_name
        `;
        const viewsResult = await pool.query(viewsQuery);
        
        if (viewsResult.rows.length > 0) {
          console.log('\n✅ Found directory views:');
          viewsResult.rows.forEach((row, i) => {
            console.log(`    ${i + 1}. ${row.table_name}`);
          });
        }
        
      } else {
        console.log('❌ No directory-related tables found');
      }
    } catch (error) {
      console.log('❌ Error searching tables:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    logger.error('Fatal error during debug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugDirectoryTables()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugDirectoryTables };
