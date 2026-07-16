#!/usr/bin/env tsx

/**
 * Debug script to test the exact SQL query that the search is building
 */

import { getDirectPool } from '../utils/db-pool';

async function debugSearchQuery() {
  const pool = getDirectPool();
  
  try {
    console.log('🔍 Debugging search query construction...\n');
    
    // Test the exact query that should be built for "Dairy & Eggs"
    const category = "Dairy & Eggs";
    
    console.log('📊 Testing manual query for category filter...');
    
    const manualQuery = `
      (
        -- Search directory_category_listings (tenant categories)
        SELECT 
          dcl.tenant_id as id,
          dcl.tenant_id,
          dcl.business_name,
          dcl.slug,
          dcl.address,
          dcl.city,
          dcl.state,
          dcl.zip_code,
          dcl.phone,
          dcl.email,
          dcl.website,
          dcl.latitude,
          dcl.longitude,
          dcl.primary_category as category_name,
          dcl.primary_category as category_slug,
          'gcid:default' as google_category_id,
          '🏪' as category_icon,
          true as is_primary,
          dcl.logo_url,
          dcl.description,
          dcl.rating_avg,
          dcl.rating_count,
          dcl.product_count,
          dcl.is_featured,
          dcl.subscription_tier,
          dcl.use_custom_website,
          dcl.created_at,
          dcl.updated_at,
          null as gbp_primary_category_name
        FROM directory_category_listings dcl
        WHERE is_published = true AND primary_category = $1
      )
      UNION ALL
      (
        -- Search directory_gbp_listings (GBP categories)
        SELECT 
          dgl.tenant_id as id,
          dgl.tenant_id,
          dgl.business_name,
          dgl.slug,
          dgl.address,
          dgl.city,
          dgl.state,
          dgl.zip_code,
          dgl.phone,
          dgl.email,
          dgl.website,
          dgl.latitude,
          dgl.longitude,
          dgl.primary_category as category_name,
          dgl.primary_category as category_slug,
          'gcid:default' as google_category_id,
          '🏪' as category_icon,
          true as is_primary,
          dgl.logo_url,
          dgl.description,
          dgl.rating_avg,
          dgl.rating_count,
          dgl.product_count,
          dgl.is_featured,
          dgl.subscription_tier,
          dgl.use_custom_website,
          dgl.created_at,
          dgl.updated_at,
          dgl.primary_category as gbp_primary_category_name
        FROM directory_gbp_listings dgl
        WHERE is_published = true AND primary_category = $1
      )
      ORDER BY rating_avg DESC NULLS LAST, rating_count DESC
      LIMIT 5 OFFSET 0
    `;
    
    const result = await pool.query(manualQuery, [category]);
    
    console.log(`✅ Manual query returned ${result.rows.length} results`);
    if (result.rows.length > 0) {
      result.rows.forEach((row, i) => {
        console.log(`    ${i + 1}. "${row.business_name}" - ${row.category_name}`);
      });
    }
    
    // Test just the WHERE clause
    console.log('\n📊 Testing WHERE clause only...');
    const whereQuery = `
      SELECT business_name, primary_category, is_published
      FROM directory_category_listings 
      WHERE is_published = true AND primary_category = $1
      LIMIT 3
    `;
    
    const whereResult = await pool.query(whereQuery, [category]);
    console.log(`✅ WHERE clause returned ${whereResult.rows.length} results`);
    whereResult.rows.forEach((row, i) => {
      console.log(`    ${i + 1}. "${row.business_name}" - ${row.primary_category} (Published: ${row.is_published})`);
    });
    
  } catch (error) {
    console.error('Fatal error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugSearchQuery()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

export { debugSearchQuery };
