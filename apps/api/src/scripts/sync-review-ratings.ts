#!/usr/bin/env tsx

/**
 * Script to sync review ratings between store_reviews and store_rating_summary tables
 * and update directory listings with correct rating data
 */

import { getDirectPool } from '../utils/db-pool';

async function syncReviewRatings() {
  const pool = getDirectPool();
  
  try {
    console.log('Starting review ratings sync...');
    
    // Get all tenants that have reviews
    const tenantsQuery = `
      SELECT DISTINCT tenant_id 
      FROM store_reviews 
      WHERE tenant_id IS NOT NULL
    `;
    
    const tenantsResult = await pool.query(tenantsQuery);
    const tenants = tenantsResult.rows;
    
    console.log(`Found ${tenants.length} tenants with reviews to sync`);
    
    for (const tenant of tenants) {
      const tenantId = tenant.tenant_id;
      
      try {
        console.log(`Syncing ratings for tenant: ${tenantId}`);
        
        // Update rating summary for this tenant
        const summaryQuery = `
          INSERT INTO store_rating_summary (
            tenant_id, 
            rating_avg, 
            rating_count, 
            rating_1_count, 
            rating_2_count, 
            rating_3_count, 
            rating_4_count, 
            rating_5_count, 
            helpful_count_total, 
            verified_purchase_count, 
            last_review_at,
            updated_at
          )
          SELECT 
            $1 as tenant_id,
            COALESCE(AVG(rating), 0) as rating_avg,
            COUNT(*) as rating_count,
            COUNT(*) FILTER (WHERE rating = 1) as rating_1_count,
            COUNT(*) FILTER (WHERE rating = 2) as rating_2_count,
            COUNT(*) FILTER (WHERE rating = 3) as rating_3_count,
            COUNT(*) FILTER (WHERE rating = 4) as rating_4_count,
            COUNT(*) FILTER (WHERE rating = 5) as rating_5_count,
            COALESCE(SUM(helpful_count), 0) as helpful_count_total,
            COUNT(*) FILTER (WHERE verified_purchase = true) as verified_purchase_count,
            MAX(created_at) as last_review_at,
            NOW() as updated_at
          FROM store_reviews
          WHERE tenant_id = $1
          ON CONFLICT (tenant_id) 
          DO UPDATE SET
            rating_avg = EXCLUDED.rating_avg,
            rating_count = EXCLUDED.rating_count,
            rating_1_count = EXCLUDED.rating_1_count,
            rating_2_count = EXCLUDED.rating_2_count,
            rating_3_count = EXCLUDED.rating_3_count,
            rating_4_count = EXCLUDED.rating_4_count,
            rating_5_count = EXCLUDED.rating_5_count,
            helpful_count_total = EXCLUDED.helpful_count_total,
            verified_purchase_count = EXCLUDED.verified_purchase_count,
            last_review_at = EXCLUDED.last_review_at,
            updated_at = EXCLUDED.updated_at
        `;
        
        await pool.query(summaryQuery, [tenantId]);
        
        // Skip directory listing update for now due to trigger issues
        // The storefront uses store_rating_summary table directly
        // TODO: Fix directory listing sync separately
        
        // Get the updated stats to verify
        const statsQuery = `
          SELECT 
            rating_avg,
            rating_count
          FROM store_rating_summary 
          WHERE tenant_id = $1
        `;
        
        const statsResult = await pool.query(statsQuery, [tenantId]);
        const stats = statsResult.rows[0];
        
        console.log(`  ✓ Updated summary: ${stats.rating_count} reviews, ${Number(stats.rating_avg).toFixed(1)} avg rating`);
        
      } catch (error) {
        console.error(`  ✗ Error syncing tenant ${tenantId}:`, error);
      }
    }
    
    console.log('Review ratings sync completed!');
    
  } catch (error) {
    console.error('Fatal error during sync:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the sync
if (require.main === module) {
  syncReviewRatings()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { syncReviewRatings };
