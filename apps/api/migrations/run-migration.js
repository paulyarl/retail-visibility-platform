#!/usr/bin/env node

/**
 * Migration runner for inventory_items table
 * This script runs the SQL migration to add new fields for variants and digital products
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 Running migration: Add item fields for variants and digital products...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_add_item_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Migration SQL loaded, executing...');
    
    // Execute the migration
    await prisma.$executeRawUnsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Added fields:');
    console.log('   - has_variants (BOOLEAN)');
    console.log('   - default_variant_id (VARCHAR)');
    console.log('   - product_type (VARCHAR) - physical/digital/hybrid');
    console.log('   - digital_delivery_method (VARCHAR)');
    console.log('   - license_type (VARCHAR)');
    console.log('   - access_duration_days (INTEGER)');
    console.log('   - download_limit (INTEGER)');
    console.log('   - payment_gateway_type (VARCHAR)');
    console.log('   - payment_gateway_id (VARCHAR)');
    console.log('📈 Created indexes for performance optimization');
    console.log('🔄 Migrated existing data from metadata to new columns');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
