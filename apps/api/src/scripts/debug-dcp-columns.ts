#!/usr/bin/env tsx

/**
 * Debug script to check columns in directory_category_products view
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugDCPColumns() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging directory_category_products columns...\n');
    
    // Check directory_category_products columns
    try {
      console.log('📊 Checking directory_category_products...');
      
      const dcpQuery = 'SELECT * FROM directory_category_products LIMIT 1';
      const dcpResult = await pool.query(dcpQuery);
      
      if (dcpResult.rows.length > 0) {
        console.log('✅ directory_category_products columns:', Object.keys(dcpResult.rows[0]));
      } else {
        console.log('❌ directory_category_products is empty');
      }
    } catch (error) {
      console.log('❌ Error checking directory_category_products:', (error as Error).message || String(error));
    }
    
    // Check sample data to see what's available
    try {
      console.log('\n📊 Sample data from directory_category_products...');
      
      const sampleQuery = `
        SELECT category_name, tenant_id, google_category_id, is_published, directory_visible
        FROM directory_category_products 
        WHERE category_name = 'Books & Media'
        LIMIT 3
      `;
      const sampleResult = await pool.query(sampleQuery);
      
      if (sampleResult.rows.length > 0) {
        console.log('✅ Found Books & Media entries:');
        sampleResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. Tenant: ${row.tenant_id}, Category: ${row.category_name}, Published: ${row.is_published}`);
        });
      } else {
        console.log('❌ No Books & Media entries found');
      }
    } catch (error) {
      console.log('❌ Error checking sample data:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    logger.error('Fatal error during debug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugDCPColumns()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugDCPColumns };
