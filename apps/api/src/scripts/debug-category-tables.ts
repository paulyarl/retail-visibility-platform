#!/usr/bin/env tsx

/**
 * Debug script to check what category tables/views exist and their structure
 */

import { getDirectPool } from '../utils/db-pool';

async function debugCategoryTables() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Checking for category-related tables and views...\n');
    
    // Check what tables/views exist
    const tablesQuery = `
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%category%' OR table_name LIKE '%directory%')
      ORDER BY table_name
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    console.log('📋 Found tables/views:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name} (${row.table_type})`);
    });
    
    console.log('\n🔍 Checking directory_category_stats structure...');
    
    // Try to get structure of directory_category_stats
    try {
      const statsStructureQuery = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'directory_category_stats'
        ORDER BY ordinal_position
      `;
      
      const statsResult = await pool.query(statsStructureQuery);
      
      if (statsResult.rows.length > 0) {
        console.log('📊 directory_category_stats columns:');
        statsResult.rows.forEach(row => {
          console.log(`  - ${row.column_name}: ${row.data_type}`);
        });
        
        // Try to get sample data
        console.log('\n📄 Sample data from directory_category_stats:');
        const sampleQuery = 'SELECT * FROM directory_category_stats LIMIT 3';
        const sampleResult = await pool.query(sampleQuery);
        
        if (sampleResult.rows.length > 0) {
          console.log('  Sample rows:');
          sampleResult.rows.forEach((row, i) => {
            console.log(`    Row ${i + 1}:`, Object.keys(row));
          });
        } else {
          console.log('  No data found');
        }
      } else {
        console.log('❌ directory_category_stats table not found');
      }
    } catch (error) {
      console.log('❌ Error checking directory_category_stats:', (error as Error).message);
    }
    
    console.log('\n🔍 Checking directory_category_products structure...');
    
    // Try to get structure of directory_category_products
    try {
      const productsStructureQuery = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'directory_category_products'
        ORDER BY ordinal_position
      `;
      
      const productsResult = await pool.query(productsStructureQuery);
      
      if (productsResult.rows.length > 0) {
        console.log('📊 directory_category_products columns:');
        productsResult.rows.forEach(row => {
          console.log(`  - ${row.column_name}: ${row.data_type}`);
        });
        
        // Try to get sample data
        console.log('\n📄 Sample data from directory_category_products:');
        const sampleQuery = 'SELECT * FROM directory_category_products LIMIT 3';
        const sampleResult = await pool.query(sampleQuery);
        
        if (sampleResult.rows.length > 0) {
          console.log('  Sample rows:');
          sampleResult.rows.forEach((row, i) => {
            console.log(`    Row ${i + 1}:`, Object.keys(row));
          });
        } else {
          console.log('  No data found');
        }
      } else {
        console.log('❌ directory_category_products table not found');
      }
    } catch (error) {
      console.log('❌ Error checking directory_category_products:', (error as Error).message);
    }
    
  } catch (error) {
    console.error('Fatal error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugCategoryTables()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

export { debugCategoryTables };
