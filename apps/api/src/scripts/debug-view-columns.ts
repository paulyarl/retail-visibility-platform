#!/usr/bin/env tsx

/**
 * Debug script to check actual columns in directory_category_stats view
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugViewColumns() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Checking directory_category_stats view structure...\n');
    
    // Get actual column names from the view
    const structureQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'directory_category_stats'
      ORDER BY ordinal_position
    `;
    
    const structureResult = await pool.query(structureQuery);
    
    if (structureResult.rows.length > 0) {
      console.log('📊 directory_category_stats actual columns:');
      structureResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
      
      // Get sample data to see what's actually available
      console.log('\n📄 Sample data from directory_category_stats:');
      const sampleQuery = 'SELECT * FROM directory_category_stats LIMIT 3';
      const sampleResult = await pool.query(sampleQuery);
      
      if (sampleResult.rows.length > 0) {
        console.log('  Sample rows:');
        sampleResult.rows.forEach((row, i) => {
          console.log(`    Row ${i + 1}:`, Object.keys(row).join(', '));
          console.log(`    Data:`, row);
        });
      } else {
        console.log('  No data found');
      }
    } else {
      console.log('❌ directory_category_stats not found');
    }
    
    console.log('\n🔍 Checking directory_category_products view structure...\n');
    
    // Check directory_category_products as well
    const productsStructureQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'directory_category_products'
      ORDER BY ordinal_position
    `;
    
    const productsStructureResult = await pool.query(productsStructureQuery);
    
    if (productsStructureResult.rows.length > 0) {
      console.log('📊 directory_category_products actual columns:');
      productsStructureResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
      
      // Get sample data
      console.log('\n📄 Sample data from directory_category_products:');
      const sampleQuery = 'SELECT * FROM directory_category_products LIMIT 3';
      const sampleResult = await pool.query(sampleQuery);
      
      if (sampleResult.rows.length > 0) {
        console.log('  Sample rows:');
        sampleResult.rows.forEach((row, i) => {
          console.log(`    Row ${i + 1}:`, Object.keys(row).join(', '));
          console.log(`    Data:`, row);
        });
      } else {
        console.log('  No data found');
      }
    } else {
      console.log('❌ directory_category_products not found');
    }
    
  } catch (error) {
    logger.error('Fatal error during debug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugViewColumns()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugViewColumns };
