const { Pool } = require('pg');

// Disable SSL verification for Supabase
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('Dropping existing table...');
    await pool.query('DROP TABLE IF EXISTS location_status_logs CASCADE');
    
    console.log('Creating table with proper SERIAL ID...');
    await pool.query(`
      CREATE TABLE location_status_logs (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        old_status location_status NOT NULL,
        new_status location_status NOT NULL,
        changed_by VARCHAR(255),
        reason TEXT,
        reopening_date TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    console.log('Creating indexes...');
    await pool.query('CREATE INDEX idx_location_status_logs_tenant_id ON location_status_logs(tenant_id)');
    await pool.query('CREATE INDEX idx_location_status_logs_created_at ON location_status_logs(created_at DESC)');
    
    console.log('✅ Table recreated successfully with proper SERIAL ID');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    pool.end();
  }
})();
