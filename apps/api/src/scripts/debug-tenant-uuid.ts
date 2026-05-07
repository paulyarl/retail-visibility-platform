#!/usr/bin/env tsx

/**
 * Debug script to check if tenants have UUID columns
 */

import { getDirectPool } from '../utils/db-pool';

async function debugTenantUuid() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging tenant UUID columns...\n');
    
    // Check tenant table schema
    try {
      console.log('📊 Checking tenant table schema...');
      
      const schemaQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'Tenant' 
        ORDER BY ordinal_position
      `;
      const schemaResult = await pool.query(schemaQuery);
      
      if (schemaResult.rows.length > 0) {
        console.log('✅ Tenant table columns:');
        schemaResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.column_name}: ${row.data_type} (${row.is_nullable})`);
        });
      } else {
        console.log('❌ Could not find Tenant table');
      }
    } catch (error) {
      console.log('❌ Error checking schema:', (error as Error).message || String(error));
    }
    
    // Check sample tenant data
    try {
      console.log('\n📊 Checking sample tenant data...');
      
      const dataQuery = `
        SELECT * FROM "Tenant" LIMIT 2
      `;
      const dataResult = await pool.query(dataQuery);
      
      if (dataResult.rows.length > 0) {
        console.log('✅ Sample tenant data:');
        dataResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ID: ${row.id}, Name: ${row.name}`);
          console.log(`       Keys: Object.keys(row)`);
        });
      } else {
        console.log('❌ No tenant data found');
      }
    } catch (error) {
      console.log('❌ Error checking tenant data:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    console.error('Fatal error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugTenantUuid()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

export { debugTenantUuid };
