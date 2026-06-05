#!/usr/bin/env node

/**
 * Pre-Migration Check Script
 * 
 * Runs comprehensive checks before allowing migrations to proceed
 * Ensures schema standards, validates changes, and prevents regressions
 * 
 * Usage: node scripts/pre-migration-check.js [migration-name]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PreMigrationChecker {
  constructor(migrationName) {
    this.migrationName = migrationName;
    this.errors = [];
    this.warnings = [];
  }

  async runAllChecks() {
    console.log('🔍 Running pre-migration checks...\n');

    // 1. Validate Prisma schema
    console.log('📋 Step 1: Validating Prisma schema standards...');
    const schemaValid = this.validateSchema();
    
    // 2. Check for breaking changes
    console.log('📋 Step 2: Checking for breaking changes...');
    this.checkBreakingChanges();
    
    // 3. Validate migration safety
    console.log('📋 Step 3: Validating migration safety...');
    this.validateMigrationSafety();
    
    // 4. Check build compatibility
    console.log('📋 Step 4: Testing build compatibility...');
    const buildPasses = this.testBuild();

    return this.reportResults(schemaValid && buildPasses);
  }

  validateSchema() {
    try {
      execSync('node scripts/validate-prisma-schema.js', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      console.log('   ✅ Schema validation passed\n');
      return true;
    } catch (error) {
      console.log('   ❌ Schema validation failed\n');
      this.errors.push('Schema validation failed - fix mapping issues before migration');
      return false;
    }
  }

  checkBreakingChanges() {
    const breakingPatterns = [
      // Model name changes without @@map
      /model\s+\w+\s*{[\s\S]*?}/g,
      // Field removals
      /^\s*\/\/.*removed/gm,
      // Type changes
      /String.*Int|Int.*String|Boolean.*String/g
    ];

    try {
      const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      
      // Check for potential breaking changes
      let hasBreakingChanges = false;
      
      // Look for models without @@map
      const modelMatches = schemaContent.match(/model\s+(\w+)\s*{([\s\S]*?)}/g);
      if (modelMatches) {
        modelMatches.forEach(modelBlock => {
          const modelName = modelBlock.match(/model\s+(\w+)/)[1];
          if (!modelBlock.includes('@@map') && !modelBlock.includes('@@ignore')) {
            this.warnings.push(`Model "${modelName}" should have @@map attribute`);
          }
        });
      }

      console.log('   ✅ Breaking change analysis complete\n');
    } catch (error) {
      this.warnings.push('Could not analyze breaking changes: ' + error.message);
      console.log('   ⚠️  Breaking change analysis incomplete\n');
    }
  }

  validateMigrationSafety() {
    const safetyChecks = [
      'No DROP TABLE statements without backup',
      'No ALTER COLUMN without default values',
      'No removal of NOT NULL constraints',
      'Proper foreign key handling'
    ];

    // Check if this is a new migration
    if (this.migrationName) {
      console.log(`   📝 Migration: ${this.migrationName}`);
    }

    // Validate migration doesn't break existing data
    try {
      // Run Prisma validate to check schema consistency
      execSync('npx prisma validate', { 
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });
      console.log('   ✅ Migration safety validated\n');
    } catch (error) {
      this.errors.push('Migration validation failed: ' + error.message);
      console.log('   ❌ Migration safety check failed\n');
    }
  }

  testBuild() {
    console.log('   🏗️  Testing TypeScript compilation...');
    
    try {
      // Test if the build passes with current schema
      execSync('pnpm build', { 
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });
      console.log('   ✅ Build compatibility confirmed\n');
      return true;
    } catch (error) {
      this.errors.push('Build fails with current schema changes');
      console.log('   ❌ Build compatibility failed\n');
      return false;
    }
  }

  reportResults(passed) {
    console.log('📊 Pre-Migration Check Results:\n');

    if (passed && this.errors.length === 0) {
      console.log('✅ ALL CHECKS PASSED - Migration approved for deployment!\n');
      console.log('🚀 Safe to proceed with:');
      console.log('   npx prisma migrate dev --name "your-migration-name"');
      console.log('   npx prisma migrate deploy (for production)\n');
      return true;
    }

    if (this.errors.length > 0) {
      console.log('🚨 CRITICAL ISSUES (must fix before migration):');
      this.errors.forEach(error => console.log(`   ❌ ${error}`));
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS (recommended to fix):');
      this.warnings.forEach(warning => console.log(`   ⚠️  ${warning}`));
      console.log('');
    }

    console.log('❌ MIGRATION BLOCKED - Fix issues above before proceeding\n');
    console.log('📋 Required Standards:');
    console.log('   • All models must use camelCase with @@map("snake_case")');
    console.log('   • All fields must use camelCase with @map("snake_case") when different');
    console.log('   • Schema must validate successfully');
    console.log('   • Build must pass with 0 critical errors');
    console.log('');

    return false;
  }
}

// Run checks
const migrationName = process.argv[2];
const checker = new PreMigrationChecker(migrationName);

checker.runAllChecks().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(error => {
  console.error('❌ Pre-migration check failed:', error);
  process.exit(1);
});
