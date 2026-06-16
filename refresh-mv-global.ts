import { getDirectPool } from './apps/api/src/utils/db-pool';

async function refreshMvGlobalDiscovery() {
  const pool = getDirectPool();
  
  try {
    console.log('🔄 Refreshing mv_global_discovery...');
    
    // Try concurrent refresh first
    try {
      await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_discovery');
      console.log('✅ mv_global_discovery refreshed successfully (CONCURRENTLY)');
    } catch (error) {
      console.log('⚠️  Concurrent refresh failed, trying regular refresh...');
      console.log('Error:', (error as Error).message);
      
      // Fall back to regular refresh
      await pool.query('REFRESH MATERIALIZED VIEW mv_global_discovery');
      console.log('✅ mv_global_discovery refreshed successfully (regular)');
    }
    
    // Verify the refresh worked
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM mv_global_discovery
      WHERE tenant_id = 'tid-m8ijkrnk'
    `);
    console.log('📊 Products in mv_global_discovery for tid-m8ijkrnk:', result.rows[0].count);
    
  } catch (error) {
    console.error('❌ Failed to refresh mv_global_discovery:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

refreshMvGlobalDiscovery()
  .then(() => {
    console.log('\n✅ Refresh completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Refresh failed:', error);
    process.exit(1);
  });
