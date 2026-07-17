#!/usr/bin/env tsx

/**
 * Debug script to check what format entity_id should be for stores
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugEntityIdFormat() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging entity_id format in user_behavior_simple...\n');
    
    // Check the schema of user_behavior_simple
    try {
      console.log('📊 Checking user_behavior_simple schema...');
      
      const schemaQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'user_behavior_simple' 
        AND column_name = 'entity_id'
      `;
      const schemaResult = await pool.query(schemaQuery);
      
      if (schemaResult.rows.length > 0) {
        console.log('✅ entity_id column info:', schemaResult.rows[0]);
      } else {
        console.log('❌ Could not find entity_id column');
      }
    } catch (error) {
      console.log('❌ Error checking schema:', (error as Error).message || String(error));
    }
    
    // Check existing data to see what format is used
    try {
      console.log('\n📊 Checking existing entity_id values...');
      
      const dataQuery = `
        SELECT DISTINCT entity_type, entity_id, COUNT(*) as count
        FROM user_behavior_simple 
        WHERE entity_id IS NOT NULL
        GROUP BY entity_type, entity_id
        ORDER BY entity_type, count DESC
        LIMIT 10
      `;
      const dataResult = await pool.query(dataQuery);
      
      if (dataResult.rows.length > 0) {
        console.log('✅ Existing entity_id values:');
        dataResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. Type: ${row.entity_type}, ID: ${row.entity_id}, Count: ${row.count}`);
        });
      } else {
        console.log('❌ No existing data found');
      }
    } catch (error) {
      console.log('❌ Error checking existing data:', (error as Error).message || String(error));
    }
    
    // Check what format tenant_id uses in other tables
    try {
      console.log('\n📊 Checking tenant_id format in other tables...');
      
      const tenantQuery = `
        SELECT tenant_id 
        FROM tenants 
        LIMIT 3
      `;
      const tenantResult = await pool.query(tenantQuery);
      
      if (tenantResult.rows.length > 0) {
        console.log('✅ Sample tenant_id formats:');
        tenantResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.tenant_id}`);
        });
      } else {
        console.log('❌ No tenant data found');
      }
    } catch (error) {
      console.log('❌ Error checking tenant data:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    logger.error('Fatal error during debug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugEntityIdFormat()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugEntityIdFormat };
