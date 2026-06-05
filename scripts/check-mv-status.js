// ============================================================================
// MATERIALIZED VIEW STATUS CHECKER
// Checks if MVs are populated and ready for use
// ============================================================================

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.nbwsiobosqawrugnqddo:2481RVP-Ascent@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

async function checkMVStatus() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    console.log(`${colors.bright}Checking Materialized View Status...${colors.reset}\n`);
    
    // Check each MV
    const mvs = [
      { name: 'trending_stores_mv', description: 'Trending Stores (Last 7 Days)' },
      { name: 'popular_stores_by_category_mv', description: 'Popular Stores by Category' },
      { name: 'user_favorite_categories_mv', description: 'User Favorite Categories' },
      { name: 'directory_home_summary_mv', description: 'Directory Home Summary' }
    ];
    
    for (const mv of mvs) {
      console.log(`${colors.blue}${colors.bright}${mv.description}${colors.reset}`);
      console.log(`Table: ${mv.name}`);
      
      // Check if MV exists
      const existsQuery = `
        SELECT EXISTS (
          SELECT FROM pg_matviews 
          WHERE schemaname = 'public' AND matviewname = $1
        );
      `;
      const existsResult = await pool.query(existsQuery, [mv.name]);
      
      if (!existsResult.rows[0].exists) {
        console.log(`${colors.red}✗ MV does not exist${colors.reset}\n`);
        continue;
      }
      
      // Get row count
      const countQuery = `SELECT COUNT(*) as count FROM ${mv.name};`;
      const countResult = await pool.query(countQuery);
      const rowCount = parseInt(countResult.rows[0].count);
      
      // Get sample data
      const sampleQuery = `SELECT * FROM ${mv.name} LIMIT 1;`;
      const sampleResult = await pool.query(sampleQuery);
      
      // Check last refresh time
      const refreshQuery = `
        SELECT 
          last_refresh_at,
          refresh_count,
          NOW() - last_refresh_at as time_since_refresh
        FROM mv_refresh_throttle
        WHERE mv_name = $1;
      `;
      const refreshResult = await pool.query(refreshQuery, [mv.name]);
      
      // Display results
      if (rowCount === 0) {
        console.log(`${colors.red}✗ MV is EMPTY (0 rows)${colors.reset}`);
      } else if (rowCount < 10) {
        console.log(`${colors.yellow}⚠ MV has only ${rowCount} rows${colors.reset}`);
      } else {
        console.log(`${colors.green}✓ MV is populated with ${rowCount} rows${colors.reset}`);
      }
      
      if (refreshResult.rows.length > 0) {
        const refresh = refreshResult.rows[0];
        console.log(`  Last Refresh: ${refresh.last_refresh_at}`);
        console.log(`  Refresh Count: ${refresh.refresh_count}`);
        console.log(`  Time Since Refresh: ${refresh.time_since_refresh}`);
      }
      
      if (sampleResult.rows.length > 0) {
        console.log(`  Sample Data: ${JSON.stringify(sampleResult.rows[0]).substring(0, 100)}...`);
      }
      
      console.log('');
    }
    
    // Check triggers
    console.log(`${colors.blue}${colors.bright}Checking Triggers${colors.reset}`);
    const triggerQuery = `
      SELECT 
        trigger_name,
        event_object_table,
        action_statement
      FROM information_schema.triggers
      WHERE trigger_name LIKE '%refresh%mv%'
      ORDER BY event_object_table, trigger_name;
    `;
    const triggerResult = await pool.query(triggerQuery);
    
    if (triggerResult.rows.length === 0) {
      console.log(`${colors.red}✗ No MV refresh triggers found${colors.reset}\n`);
    } else {
      console.log(`${colors.green}✓ Found ${triggerResult.rows.length} MV refresh triggers${colors.reset}`);
      triggerResult.rows.forEach(trigger => {
        console.log(`  - ${trigger.trigger_name} on ${trigger.event_object_table}`);
      });
      console.log('');
    }
    
    // Check refresh functions
    console.log(`${colors.blue}${colors.bright}Checking Refresh Functions${colors.reset}`);
    const functionQuery = `
      SELECT 
        routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name LIKE '%refresh%mv%'
      ORDER BY routine_name;
    `;
    const functionResult = await pool.query(functionQuery);
    
    if (functionResult.rows.length === 0) {
      console.log(`${colors.red}✗ No MV refresh functions found${colors.reset}\n`);
    } else {
      console.log(`${colors.green}✓ Found ${functionResult.rows.length} MV refresh functions${colors.reset}`);
      functionResult.rows.forEach(func => {
        console.log(`  - ${func.routine_name}()`);
      });
      console.log('');
    }
    
    console.log(`${colors.bright}Status Check Complete${colors.reset}\n`);
    
  } catch (error) {
    console.error(`${colors.red}Error checking MV status:${colors.reset}`, error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkMVStatus();
