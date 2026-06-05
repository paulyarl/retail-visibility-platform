#!/usr/bin/env tsx

/**
 * Debug script to check what directory views exist
 */

import { getDirectPool } from '../utils/db-pool';

async function debugDirectoryViews() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Finding directory views...\n');
    
    // Find all views with 'directory' in the name
    try {
      console.log('📊 Searching for directory views...');
      
      const viewsQuery = `
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name ILIKE '%directory%'
        ORDER BY table_name
      `;
      const viewsResult = await pool.query(viewsQuery);
      
      if (viewsResult.rows.length > 0) {
        console.log('✅ Found directory views:');
        viewsResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.table_name}`);
        });
        
        // Check schema of key views
        const keyViews = ['directory_category_listings', 'directory_category_stats', 'directory_category_products'];
        
        for (const viewName of keyViews) {
          const exists = viewsResult.rows.some(row => row.table_name === viewName);
          console.log(`\n📊 ${viewName} exists: ${exists ? '✅ YES' : '❌ NO'}`);
          
          if (exists) {
            try {
              const schemaQuery = `
                SELECT column_name, data_type
                FROM information_schema.columns 
                WHERE table_name = '${viewName}'
                ORDER BY ordinal_position
                LIMIT 10
              `;
              const schemaResult = await pool.query(schemaQuery);
              
              console.log(`   Columns (first 10):`);
              schemaResult.rows.forEach((row, i) => {
                console.log(`     ${i + 1}. ${row.column_name}: ${row.data_type}`);
              });
            } catch (error) {
              console.log(`   ❌ Error checking schema: ${(error as Error).message}`);
            }
          }
        }
        
      } else {
        console.log('❌ No directory views found');
      }
    } catch (error) {
      console.log('❌ Error searching views:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    console.error('Fatal error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugDirectoryViews()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

export { debugDirectoryViews };
