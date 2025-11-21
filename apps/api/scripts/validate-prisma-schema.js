#!/usr/bin/env node

/**
 * Prisma Schema Validation Script
 * 
 * Enforces camelCase model names with @map attributes for snake_case tables
 * Enforces camelCase field names with @map attributes for snake_case columns
 * 
 * Usage: node scripts/validate-prisma-schema.js
 * Exit codes: 0 = valid, 1 = validation errors found
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');

class PrismaSchemaValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validateSchema() {
    console.log('🔍 Validating Prisma schema for mapping standards...\n');

    if (!fs.existsSync(SCHEMA_PATH)) {
      this.errors.push('❌ Prisma schema file not found at: ' + SCHEMA_PATH);
      return false;
    }

    const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const lines = schemaContent.split('\n');

    this.validateModels(lines);
    this.validateFields(lines);
    this.validateRelations(lines);

    return this.reportResults();
  }

  validateModels(lines) {
    const modelRegex = /^model\s+(\w+)\s*{/;
    const mapRegex = /@@map\("([^"]+)"\)/;
    let currentModel = null;
    let modelHasMap = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Start of model
      const modelMatch = line.match(modelRegex);
      if (modelMatch) {
        currentModel = modelMatch[1];
        modelHasMap = false;
        
        // Check if model name is PascalCase
        if (!this.isPascalCase(currentModel)) {
          this.errors.push(`❌ Model "${currentModel}" should use PascalCase (line ${i + 1})`);
        }
        continue;
      }

      // End of model
      if (line === '}' && currentModel) {
        // Check if model has @@map attribute
        if (!modelHasMap && !line.includes('@@ignore')) {
          const expectedTableName = this.camelToSnake(currentModel);
          this.errors.push(`❌ Model "${currentModel}" missing @@map("${expectedTableName}") attribute`);
        }
        currentModel = null;
        continue;
      }

      // Check for @@map in model
      if (currentModel && mapRegex.test(line)) {
        modelHasMap = true;
        const mapMatch = line.match(mapRegex);
        const tableName = mapMatch[1];
        
        // Verify table name is snake_case
        if (!this.isSnakeCase(tableName)) {
          this.warnings.push(`⚠️  Table name "${tableName}" should use snake_case (line ${i + 1})`);
        }
      }
    }
  }

  validateFields(lines) {
    const fieldRegex = /^\s*(\w+)\s+(\w+)(\?|\[\])?\s*(@.*)?$/;
    const mapRegex = /@map\("([^"]+)"\)/;
    let inModel = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('model ')) {
        inModel = true;
        continue;
      }
      
      if (line === '}') {
        inModel = false;
        continue;
      }

      if (!inModel) continue;

      const fieldMatch = line.match(fieldRegex);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const attributes = fieldMatch[4] || '';
        
        // Skip relation fields and special fields
        if (this.isRelationField(fieldMatch[2]) || this.isSpecialField(fieldName)) {
          continue;
        }

        // Check if field name is camelCase
        if (!this.isCamelCaseField(fieldName)) {
          this.errors.push(`❌ Field "${fieldName}" should use camelCase (line ${i + 1})`);
        }

        // Check if field needs @map attribute
        const expectedColumnName = this.camelToSnake(fieldName);
        if (fieldName !== expectedColumnName) {
          const hasMap = mapRegex.test(attributes);
          if (!hasMap) {
            this.errors.push(`❌ Field "${fieldName}" missing @map("${expectedColumnName}") attribute (line ${i + 1})`);
          } else {
            // Verify @map value is correct
            const mapMatch = attributes.match(mapRegex);
            if (mapMatch && mapMatch[1] !== expectedColumnName) {
              this.warnings.push(`⚠️  Field "${fieldName}" @map should be "${expectedColumnName}", got "${mapMatch[1]}" (line ${i + 1})`);
            }
          }
        }
      }
    }
  }

  validateRelations(lines) {
    const relationRegex = /^\s*(\w+)\s+(\w+)(\?|\[\])?\s*@relation/;
    let inModel = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('model ')) {
        inModel = true;
        continue;
      }
      
      if (line === '}') {
        inModel = false;
        continue;
      }

      if (!inModel) continue;

      const relationMatch = line.match(relationRegex);
      if (relationMatch) {
        const fieldName = relationMatch[1];
        const modelName = relationMatch[2].replace(/\?|\[\]$/, '');
        
        // Check if relation field is camelCase
        if (!this.isCamelCaseField(fieldName)) {
          this.errors.push(`❌ Relation field "${fieldName}" should use camelCase (line ${i + 1})`);
        }

        // Check if referenced model is PascalCase
        if (!this.isPascalCase(modelName)) {
          this.warnings.push(`⚠️  Referenced model "${modelName}" should use PascalCase (line ${i + 1})`);
        }
      }
    }
  }

  isCamelCase(str) {
    // For models: PascalCase (starts with uppercase)
    // For fields: camelCase (starts with lowercase)
    // This function handles both cases
    return /^[a-zA-Z][a-zA-Z0-9]*$/.test(str) && !str.includes('_');
  }

  isPascalCase(str) {
    // Must start with uppercase letter, can contain uppercase letters
    return /^[A-Z][a-zA-Z0-9]*$/.test(str) && !str.includes('_');
  }

  isCamelCaseField(str) {
    // Must start with lowercase letter, can contain uppercase letters
    return /^[a-z][a-zA-Z0-9]*$/.test(str) && !str.includes('_');
  }

  isSnakeCase(str) {
    // Must be lowercase with underscores
    return /^[a-z][a-z0-9_]*$/.test(str);
  }

  camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  isRelationField(type) {
    // Common relation types (should be camelCase model names)
    return /^[A-Z]/.test(type) || type.includes('[]');
  }

  isSpecialField(fieldName) {
    // Fields that don't need mapping (already match database)
    const specialFields = ['id', 'name', 'email', 'role', 'status', 'type', 'data', 'metadata'];
    return specialFields.includes(fieldName);
  }

  reportResults() {
    console.log('📊 Validation Results:\n');

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ Schema validation passed! All models and fields follow mapping standards.\n');
      return true;
    }

    if (this.errors.length > 0) {
      console.log('🚨 ERRORS (must fix before deployment):');
      this.errors.forEach(error => console.log(`   ${error}`));
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS (recommended fixes):');
      this.warnings.forEach(warning => console.log(`   ${warning}`));
      console.log('');
    }

    console.log('📋 Standards Summary:');
    console.log('   • Model names: camelCase with @@map("snake_case_table")');
    console.log('   • Field names: camelCase with @map("snake_case_column") when different');
    console.log('   • Relations: camelCase field names and model references');
    console.log('   • Database: snake_case tables and columns');
    console.log('');

    return this.errors.length === 0;
  }
}

// Run validation
const validator = new PrismaSchemaValidator();
const isValid = validator.validateSchema();

process.exit(isValid ? 0 : 1);
