#!/usr/bin/env node

/**
 * Migration Wrapper Script
 * 
 * Wraps Prisma migrate commands with pre-checks and post-validation
 * Ensures all migrations follow standards before deployment
 * 
 * Usage: 
 *   node scripts/migration-wrapper.js dev "migration-name"
 *   node scripts/migration-wrapper.js deploy
 */

const { execSync } = require('child_process');
const path = require('path');

class MigrationWrapper {
  constructor() {
    this.command = process.argv[2];
    this.migrationName = process.argv[3];
  }

  async run() {
    console.log('🛡️  Prisma Migration Wrapper - Enforcing Standards\n');

    if (!this.command || !['dev', 'deploy', 'reset'].includes(this.command)) {
      this.showUsage();
      process.exit(1);
    }

    try {
      // Always run pre-checks
      console.log('🔍 Running pre-migration checks...');
      await this.runPreChecks();

      // Execute the migration
      console.log('🚀 Executing migration...');
      await this.executeMigration();

      // Run post-checks
      console.log('✅ Running post-migration validation...');
      await this.runPostChecks();

      console.log('\n🎉 Migration completed successfully with all standards enforced!\n');

    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      console.log('\n📋 Standards Reminder:');
      console.log('   • All models: camelCase with @@map("snake_case_table")');
      console.log('   • All fields: camelCase with @map("snake_case_column")');
      console.log('   • All relations: camelCase field and model names');
      console.log('   • Schema must validate and build must pass\n');
      process.exit(1);
    }
  }

  async runPreChecks() {
    try {
      execSync(`node scripts/pre-migration-check.js ${this.migrationName || ''}`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
    } catch (error) {
      throw new Error('Pre-migration checks failed - fix issues before proceeding');
    }
  }

  async executeMigration() {
    let command;
    
    switch (this.command) {
      case 'dev':
        if (!this.migrationName) {
          throw new Error('Migration name required for dev command');
        }
        command = `npx prisma migrate dev --name "${this.migrationName}"`;
        break;
      
      case 'deploy':
        command = 'npx prisma migrate deploy';
        break;
      
      case 'reset':
        command = 'npx prisma migrate reset --force';
        break;
    }

    try {
      execSync(command, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
    } catch (error) {
      throw new Error(`Migration command failed: ${command}`);
    }
  }

  async runPostChecks() {
    try {
      // Validate schema after migration
      execSync('npx prisma validate', {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });

      // Generate client to ensure compatibility
      execSync('npx prisma generate', {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });

      // Test build to ensure no breaking changes
      execSync('pnpm build', {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });

      console.log('   ✅ Post-migration validation passed');
    } catch (error) {
      throw new Error('Post-migration validation failed - migration may have introduced issues');
    }
  }

  showUsage() {
    console.log('Usage:');
    console.log('  node scripts/migration-wrapper.js dev "migration-name"');
    console.log('  node scripts/migration-wrapper.js deploy');
    console.log('  node scripts/migration-wrapper.js reset');
    console.log('');
    console.log('This wrapper ensures all migrations follow Prisma mapping standards.');
  }
}

// Run the wrapper
const wrapper = new MigrationWrapper();
wrapper.run();
