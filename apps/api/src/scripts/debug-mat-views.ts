#!/usr/bin/env tsx

/**
 * Debug script to check materialized views and available category data
 */

import { getDirectPool } from '../utils/db-pool';

async function debugMaterializedViews() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Checking for materialized views...\n');
    
    // Check what materialized views exist
    const mvQuery = `
      SELECT matviewname, definition 
      FROM pg_matviews 
      WHERE matviewname LIKE '%category%' OR matviewname LIKE '%directory%'
      ORDER BY matviewname
    `;
    
    const mvResult = await pool.query(mvQuery);
    console.log('📋 Found materialized views:');
    mvResult.rows.forEach(row => {
      console.log(`  - ${row.matviewname}`);
    });
    
    console.log('\n🔍 Checking platform_categories table...');
    
    // Check platform_categories structure
    try {
      const platformCategoriesQuery = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'platform_categories'
        ORDER BY ordinal_position
      `;
      
      const platformResult = await pool.query(platformCategoriesQuery);
      
      if (platformResult.rows.length > 0) {
        console.log('📊 platform_categories columns:');
        platformResult.rows.forEach(row => {
          console.log(`  - ${row.column_name}: ${row.data_type}`);
        });
        
        // Get sample data
        console.log('\n📄 Sample data from platform_categories:');
        const sampleQuery = 'SELECT * FROM platform_categories LIMIT 5';
        const sampleResult = await pool.query(sampleQuery);
        
        if (sampleResult.rows.length > 0) {
          console.log('  Sample rows:');
          sampleResult.rows.forEach((row, i) => {
            console.log(`    Row ${i + 1}:`, row);
          });
        } else {
          console.log('  No data found');
        }
      } else {
        console.log('❌ platform_categories table not found');
      }
    } catch (error) {
      console.log('❌ Error checking platform_categories:', (error as Error).message);
    }
    
    console.log('\n🔍 Checking directory_listings_list for category data...');
    
    // Check if we can get category data from directory_listings_list
    try {
      const listingsQuery = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'directory_listings_list'
        ORDER BY ordinal_position
      `;
      
      const listingsResult = await pool.query(listingsQuery);
      
      if (listingsResult.rows.length > 0) {
        console.log('📊 directory_listings_list columns (category-related):');
        listingsResult.rows
          .filter(row => row.column_name.toLowerCase().includes('category'))
          .forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
          });
        
        // Get category distribution
        console.log('\n📄 Category distribution in directory_listings_list:');
        const categoryQuery = `
          SELECT 
            category_slug,
            COUNT(*) as store_count,
            COUNT(DISTINCT tenant_id) as tenant_count
          FROM directory_listings_list 
          WHERE category_slug IS NOT NULL 
          GROUP BY category_slug 
          ORDER BY store_count DESC 
          LIMIT 10
        `;
        const categoryResult = await pool.query(categoryQuery);
        
        if (categoryResult.rows.length > 0) {
          console.log('  Top categories:');
          categoryResult.rows.forEach(row => {
            console.log(`    ${row.category_slug}: ${row.store_count} stores (${row.tenant_count} tenants)`);
          });
        } else {
          console.log('  No category data found');
        }
      }
    } catch (error) {
      console.log('❌ Error checking directory_listings_list:', (error as Error).message);
    }
    
  } catch (error) {
    console.error('Fatal error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugMaterializedViews()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

export { debugMaterializedViews };
