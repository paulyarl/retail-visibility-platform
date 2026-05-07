/**
 * Smart Sale Tagging MV Refresh Script
 * 
 * This script refreshes the storefront_products_mv materialized view
 * to ensure smart sale tagging is always up-to-date with pricing changes.
 * 
 * Usage: npx ts-node src/scripts/refresh-smart-sale-mv.ts
 */

import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

async function refreshSmartSaleMV() {
  const pool = getDirectPool();
  
  try {
    logger.info('[SMART SALE MV] Starting materialized view refresh...');
    
    // Refresh the materialized view concurrently to avoid blocking
    const result = await pool.query(`
      REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_products_mv
    `);
    
    logger.info('[SMART SALE MV] Materialized view refreshed successfully');
    
    // Get statistics about the refresh
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN is_on_sale = true THEN 1 END) as sale_products,
        COUNT(CASE WHEN auto_tagged_as_sale = true THEN 1 END) as auto_tagged_sales,
        COUNT(CASE WHEN featured_type = 'sale' THEN 1 END) as sale_featured,
        ROUND(AVG(CASE WHEN discount_percentage > 0 THEN discount_percentage END), 2) as avg_discount
      FROM storefront_products_mv
    `);
    
    const statsData = stats.rows[0];
    logger.info('[SMART SALE MV] Refresh statistics: Total products: ' + parseInt(statsData.total_products) + ', Sale products: ' + parseInt(statsData.sale_products) + ', Auto-tagged sales: ' + parseInt(statsData.auto_tagged_sales) + ', Sale featured: ' + parseInt(statsData.sale_featured) + ', Avg discount: ' + (parseFloat(statsData.avg_discount) || 0));
    
    // Log some examples of auto-tagged products for verification
    const examples = await pool.query(`
      SELECT 
        tenant_id,
        sku,
        name,
        price_cents,
        sale_price_cents,
        discount_percentage,
        featured_type,
        auto_tagged_as_sale
      FROM storefront_products_mv 
      WHERE auto_tagged_as_sale = true 
      ORDER BY discount_percentage DESC 
      LIMIT 5
    `);
    
    if (examples.rows.length > 0) {
      logger.info('[SMART SALE MV] Sample auto-tagged sale products:');
      examples.rows.forEach((product, index) => {
        logger.info(`  ${index + 1}. ${product.name} (${product.sku}) - ${product.discount_percentage}% OFF - Auto-tagged: ${product.auto_tagged_as_sale}`);
      });
    }
    
    console.log('✅ Smart Sale MV refresh completed successfully');
    console.log(`📊 Statistics: ${statsData.sale_products}/${statsData.total_products} products on sale`);
    console.log(`🏷️  ${statsData.auto_tagged_sales} products auto-tagged as sale`);
    console.log(`💰 Average discount: ${statsData.avg_discount || 0}%`);
    
  } catch (error) {
    logger.error('[SMART SALE MV] Refresh failed: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    console.error('❌ Smart Sale MV refresh failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the refresh if this script is executed directly
if (require.main === module) {
  refreshSmartSaleMV().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default refreshSmartSaleMV;
