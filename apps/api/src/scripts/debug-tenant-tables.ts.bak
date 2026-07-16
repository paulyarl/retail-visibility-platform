#!/usr/bin/env tsx

/**
 * Debug script to find tenant table names
 */

import { getDirectPool } from '../utils/db-pool';

async function debugTenantTables() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Finding tenant-related tables...\n');
    
    // Find all tables with 'tenant' in the name
    try {
      console.log('📊 Searching for tenant tables...');
      
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name ILIKE '%tenant%'
        ORDER BY table_name
      `;
      const tablesResult = await pool.query(tablesQuery);
      
      if (tablesResult.rows.length > 0) {
        console.log('✅ Found tenant-related tables:');
        tablesResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.table_name}`);
        });
        
        // Check schema of first tenant table
        const firstTable = tablesResult.rows[0].table_name;
        console.log(`\n📊 Schema of ${firstTable}:`);
        
        const schemaQuery = `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = '${firstTable}'
          ORDER BY ordinal_position
        `;
        const schemaResult = await pool.query(schemaQuery);
        
        schemaResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.column_name}: ${row.data_type} (${row.is_nullable})`);
        });
        
      } else {
        console.log('❌ No tenant-related tables found');
      }
    } catch (error) {
      console.log('❌ Error searching tables:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    console.error('Fatal error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugTenantTables()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

export { debugTenantTables };
