/**
 * Apply MFA columns migration to database
 * Run with: doppler run -- npx tsx prisma/apply-mfa-migration.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔧 Applying MFA columns migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'add_mfa_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolon and filter out comments and empty lines
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`   Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await prisma.$executeRawUnsafe(statement + ';');
        console.log(`   ✅ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          console.log(`   ⚠️  Statement ${i + 1} skipped (already exists)`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('\n✅ MFA migration completed successfully!');
    console.log('\n📋 Added columns to users table:');
    console.log('   - mfa_enabled (BOOLEAN)');
    console.log('   - mfa_secret (TEXT)');
    console.log('   - mfa_backup_codes (TEXT[])');
    console.log('   - mfa_method (VARCHAR)');
    console.log('   - mfa_verified_at (TIMESTAMP)');
    console.log('\n🔍 Created index: idx_users_mfa_enabled');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => {
    console.log('\n✨ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });
