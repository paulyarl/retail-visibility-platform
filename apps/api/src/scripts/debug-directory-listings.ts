#!/usr/bin/env tsx

/**
 * Debug script to check directory_listings_list table for individual store pages
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function debugDirectoryListings() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging directory_listings_list table...\n');
    
    // Check all directory listings
    try {
      console.log('📊 Checking all directory listings...');
      
      const listingsQuery = `
        SELECT 
          tenant_id,
          business_name,
          slug,
          is_published
        FROM directory_listings_list
        ORDER BY business_name
      `;
      const listingsResult = await pool.query(listingsQuery);
      
      if (listingsResult.rows.length > 0) {
        console.log('✅ Directory listings found:');
        listingsResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.business_name} (${row.tenant_id})`);
          console.log(`       Slug: ${row.slug}`);
          console.log(`       Published: ${row.is_published}`);
        });
      } else {
        console.log('❌ No directory listings found');
      }
    } catch (error) {
      console.log('❌ Error checking listings:', (error as Error).message || String(error));
    }
    
    // Check Indy Grocery specifically
    try {
      console.log('\n📊 Checking Indy Grocery specifically...');
      
      const indyGroceryQuery = `
        SELECT 
          tenant_id,
          business_name,
          slug,
          is_published
        FROM directory_listings_list
        WHERE slug = 'indy-grocery' OR tenant_id = 't-zjd1o7sm'
      `;
      const indyGroceryResult = await pool.query(indyGroceryQuery);
      
      if (indyGroceryResult.rows.length > 0) {
        console.log('✅ Indy Grocery found:');
        indyGroceryResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.business_name} (${row.tenant_id})`);
          console.log(`       Slug: ${row.slug}`);
          console.log(`       Published: ${row.is_published}`);
        });
      } else {
        console.log('❌ Indy Grocery not found in directory_listings_list');
      }
    } catch (error) {
      console.log('❌ Error checking Indy Grocery:', (error as Error).message || String(error));
    }
    
    // Check Indy International specifically
    try {
      console.log('\n📊 Checking Indy International specifically...');
      
      const indyInternationalQuery = `
        SELECT 
          tenant_id,
          business_name,
          slug,
          is_published
        FROM directory_listings_list
        WHERE slug = 'indy-international' OR tenant_id = 't-rerko4xw'
      `;
      const indyInternationalResult = await pool.query(indyInternationalQuery);
      
      if (indyInternationalResult.rows.length > 0) {
        console.log('✅ Indy International found:');
        indyInternationalResult.rows.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.business_name} (${row.tenant_id})`);
          console.log(`       Slug: ${row.slug}`);
          console.log(`       Published: ${row.is_published}`);
        });
      } else {
        console.log('❌ Indy International not found in directory_listings_list');
      }
    } catch (error) {
      console.log('❌ Error checking Indy International:', (error as Error).message || String(error));
    }
    
  } catch (error) {
    logger.error('Fatal error during debug:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugDirectoryListings()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Debug failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      process.exit(1);
    });
}

export { debugDirectoryListings };
