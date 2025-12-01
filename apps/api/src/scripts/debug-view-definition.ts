#!/usr/bin/env tsx

/**
 * Debug script to check how directory_category_products view is defined
 */

import { getDirectPool } from '../utils/db-pool';

async function debugViewDefinition() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging directory_category_products view definition...\n');
    
    // Check if it's a view or table
    try {
      console.log('📊 Checking if directory_category_products is a view...');
      
      const viewQuery = `
        SELECT table_name, table_type
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'directory_category_products'
      `;
      const viewResult = await pool.query(viewQuery);
      
      if (viewResult.rows.length > 0) {
        console.log(`✅ directory_category_products is a: ${viewResult.rows[0].table_type}`);
        
        if (viewResult.rows[0].table_type === 'VIEW') {
          // Get the view definition
          const defQuery = `
            SELECT definition
            FROM information_schema.views
            WHERE table_schema = 'public' 
            AND table_name = 'directory_category_products'
          `;
          const defResult = await pool.query(defQuery);
          
          if (defResult.rows.length > 0) {
            console.log('✅ View definition:');
            console.log(defResult.rows[0].definition);
          }
        }
      } else {
        console.log('❌ directory_category_products not found');
      }
    } catch (error) {
      console.log('❌ Error checking view definition:', (error as Error).message || String(error));
    }
    
    // Check if there are materialized views
    try {
      console.log('\n📊 Checking for materialized views...');
      
      const matViewQuery = `
        SELECT matviewname, definition
        FROM pg_matviews
        WHERE matviewname ILIKE '%category%' OR matviewname ILIKE '%directory%'
        ORDER BY matviewname
      `;
      const matViewResult = await pool.query(matViewQuery);
      
      if (matViewResult.rows.length > 0) {
        console.log('✅ Found materialized views:');
        matViewResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.matviewname}`);
          if (row.definition && row.definition.length < 200) {
            console.log(`       Definition: ${row.definition.substring(0, 100)}...`);
          }
        });
      } else {
        console.log('❌ No materialized views found');
      }
    } catch (error) {
      console.log('❌ Error checking materialized views:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    console.error('Fatal error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugViewDefinition()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

export { debugViewDefinition };
