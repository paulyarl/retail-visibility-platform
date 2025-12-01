#!/usr/bin/env tsx

/**
 * Direct query to materialized views to see their actual structure
 */

import { getDirectPool } from '../utils/db-pool';

async function directViewQuery() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Direct query to materialized views...\n');
    
    // Try to query directory_category_stats directly
    try {
      console.log('📊 Querying directory_category_stats directly...');
      const statsQuery = 'SELECT * FROM directory_category_stats LIMIT 3';
      const statsResult = await pool.query(statsQuery);
      
      if (statsResult.rows.length > 0) {
        console.log('✅ directory_category_stats is accessible!');
        console.log('📋 Columns found:', Object.keys(statsResult.rows[0]));
        
        console.log('📄 Sample data:');
        statsResult.rows.forEach((row, i) => {
          console.log(`  Row ${i + 1}:`, row);
        });
        
        // Now we know the actual columns, let's fix the query
        console.log('\n🔧 The correct query should use these columns:');
        const columns = Object.keys(statsResult.rows[0]);
        console.log('Available columns:', columns.join(', '));
        
      } else {
        console.log('❌ directory_category_stats returned no data');
      }
    } catch (error) {
      console.log('❌ Error querying directory_category_stats:', (error as Error).message || String(error));
    }
    
    console.log('\n📊 Querying directory_category_products directly...');
    
    // Try to query directory_category_products directly
    try {
      const productsQuery = 'SELECT * FROM directory_category_products LIMIT 3';
      const productsResult = await pool.query(productsQuery);
      
      if (productsResult.rows.length > 0) {
        console.log('✅ directory_category_products is accessible!');
        console.log('📋 Columns found:', Object.keys(productsResult.rows[0]));
        
        console.log('📄 Sample data:');
        productsResult.rows.forEach((row, i) => {
          console.log(`  Row ${i + 1}:`, row);
        });
      } else {
        console.log('❌ directory_category_products returned no data');
      }
    } catch (error) {
      console.log('❌ Error querying directory_category_products:', (error as Error).message || String(error));
    }
    
    console.log('\n🔍 Checking if we can create a simple category query...');
    
    // Create a simple fallback query using platform_categories
    try {
      const simpleQuery = `
        SELECT 
          pc.id,
          pc.name,
          pc.slug,
          pc.icon_emoji,
          pc.sort_order,
          0 as store_count,
          0 as product_count
        FROM platform_categories pc
        WHERE pc.is_active = true
        ORDER BY pc.sort_order ASC
        LIMIT 10
      `;
      
      const simpleResult = await pool.query(simpleQuery);
      
      if (simpleResult.rows.length > 0) {
        console.log('✅ Simple platform_categories query works!');
        console.log('📄 Sample categories:');
        simpleResult.rows.forEach((row, i) => {
          console.log(`  ${i + 1}. ${row.name} (${row.slug}) - ${row.store_count} stores, ${row.product_count} products`);
        });
      }
    } catch (error) {
      console.log('❌ Error with simple query:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    console.error('Fatal error during direct query:', error);
  } finally {
    await pool.end();
  }
}

// Run the direct query
if (require.main === module) {
  directViewQuery()
    .then(() => {
      console.log('\n✅ Direct query completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Direct query failed:', error);
      process.exit(1);
    });
}

export { directViewQuery };
