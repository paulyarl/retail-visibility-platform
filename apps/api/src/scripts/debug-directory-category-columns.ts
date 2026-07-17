#!/usr/bin/env tsx

/**
 * Debug script to check actual columns in directory_category_products view
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugDirectoryCategoryColumns() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging directory_category_products columns...\n');
    
    // Get column information for directory_category_products view
    try {
      console.log('📊 Checking directory_category_products columns...');
      
      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = 'directory_category_products'
        ORDER BY ordinal_position
      `;
      const columnsResult = await pool.query(columnsQuery);
      
      if (columnsResult.rows.length > 0) {
        console.log('✅ Columns in directory_category_products:');
        columnsResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.column_name} (${row.data_type})${row.is_nullable === 'YES' ? ' NULL' : ' NOT NULL'}`);
        });
      } else {
        console.log('❌ No columns found for directory_category_products');
      }
    } catch (error) {
      console.log('❌ Error checking columns:', (error as Error).message || String(error));
    }
    
    // Sample a few rows to see actual data
    try {
      console.log('\n📊 Sampling actual data from directory_category_products...');
      
      const sampleQuery = `
        SELECT *
        FROM directory_category_products
        LIMIT 2
      `;
      const sampleResult = await pool.query(sampleQuery);
      
      if (sampleResult.rows.length > 0) {
        console.log('✅ Sample rows:');
        sampleResult.rows.forEach((row, i) => {
          console.log(`    Row ${i + 1}:`);
          Object.keys(row).forEach(key => {
            console.log(`      ${key}: ${row[key]}`);
          });
          console.log('');
        });
      } else {
        console.log('❌ No data found in directory_category_products');
      }
    } catch (error) {
      console.log('❌ Error sampling data:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    logger.error('Fatal error during debug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugDirectoryCategoryColumns()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugDirectoryCategoryColumns };
