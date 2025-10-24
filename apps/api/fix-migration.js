// Temporary script to fix failed migration in Railway database
const { Client } = require('pg');

async function fixMigration() {
  // You need to get the public DATABASE_URL from Railway dashboard
  // Go to Railway > Database > Connect > Public URL
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    console.log('Please set it to the PUBLIC database URL from Railway dashboard');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Mark the failed migration as rolled back
    const result = await client.query(
      `UPDATE "_prisma_migrations" 
       SET finished_at = NULL, 
           applied_steps_count = 0,
           logs = 'Manually marked as rolled back to allow redeployment'
       WHERE migration_name = '20251024093000_add_photo_asset_fields'
       RETURNING *`
    );

    if (result.rowCount > 0) {
      console.log('✓ Successfully marked migration as rolled back');
      console.log('Migration details:', result.rows[0]);
    } else {
      console.log('⚠ Migration not found in database');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixMigration();
